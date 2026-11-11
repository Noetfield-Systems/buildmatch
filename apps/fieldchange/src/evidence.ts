import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { orderAccess } from "./orders.ts";

/** Private, immutable evidence gallery on the existing Railway persistent volume. */
const ROOT = process.env.FIELDCHANGE_EVIDENCE_DIR || "/data/fieldchange-evidence";
const MAX_UPLOAD = 3_000_000;
const MAX_BODY = 3_500_000;
const MAX_FILES = 8;
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
    "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" }
});
const fail = (reason: string, status = 400) => reply({ error: reason }, status);
const isUUID = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

export function initAttachments(db: Database) {
  mkdirSync(ROOT, { recursive: true });
  db.exec("CREATE TABLE IF NOT EXISTS change_order_attachments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL)");
  db.exec("CREATE INDEX IF NOT EXISTS change_order_attachments_order ON change_order_attachments(order_id, created_at)");
}

function classify(b: Buffer): { mime: string; ext: string } | null {
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return { mime: "image/jpeg", ext: ".jpg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", ext: ".png" };
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: ".webp" };
  return null;
}
function safeName(value: string, ext: string) {
  const stem = (value.split(/[\\/]/).pop() || "Site photo").replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9 _.-]/g, "").trim().slice(0, 65) || "Site photo";
  return stem + ext;
}
async function limited(req: Request): Promise<Buffer> {
  const parts: Buffer[] = [];
  let bytes = 0;
  if (!req.body) throw Error("Missing upload data.");
  for await (const chunk of req.body) {
    const part = Buffer.from(chunk);
    bytes += part.length;
    if (bytes > MAX_BODY) throw Error("Image too large. Maximum photo size is 3 MB.");
    parts.push(part);
  }
  return Buffer.concat(parts);
}

export async function handleEvidenceRoute(req: Request, db: Database): Promise<Response | null> {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/api\/orders\/([0-9a-f-]{36})\/(attachments|history)(?:\/([0-9a-f-]{36}))?$/i);
  if (!m) return null;
  const [, orderId, kind, attachmentId] = m;
  if (!isUUID(orderId) || (attachmentId && !isUUID(attachmentId))) return fail("Invalid record ID.");
  const access = orderAccess(db, orderId, url.searchParams.get("token") || "");
  if (!access?.role) return fail("Private link invalid.", 403);
  if (access.role === "approve" && !access.paid) return fail("Approval link is not active.", 402);
  if (kind === "history") {
    if (req.method !== "GET" || attachmentId) return fail("Not found.", 404);
    if (access.role !== "manage") return fail("Contractor access required.", 403);
    const events = db.query("SELECT event_type, actor, occurred_at FROM change_order_events WHERE order_id = ? ORDER BY occurred_at ASC LIMIT 100").all(orderId);
    return reply({ events });
  }
  if (req.method === "GET" && !attachmentId) {
    const files = db.query("SELECT id, filename, mime, bytes, created_at AS createdAt FROM change_order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(orderId);
    return reply({ attachments: files });
  }
  if (req.method === "GET" && attachmentId) {
    const file = db.query("SELECT id, mime FROM change_order_attachments WHERE id = ? AND order_id = ?").get(attachmentId, orderId) as { id: string; mime: string } | null;
    if (!file) return fail("File not found.", 404);
    const ext = file.mime === "image/jpeg" ? ".jpg" : file.mime === "image/png" ? ".png" : ".webp";
    return new Response(Bun.file(join(ROOT, file.id + ext)), { headers: {
      "content-type": file.mime, "cache-control": "private, no-store", "content-disposition": "inline",
      "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; sandbox"
    } });
  }
  if (req.method !== "POST" || attachmentId) return fail("Not found.", 404);
  if (access.role !== "manage") return fail("Contractor access required.", 403);
  const existing = db.query("SELECT COUNT(*) AS total FROM change_order_attachments WHERE order_id = ?").get(orderId) as { total: number };
  if (existing.total >= MAX_FILES) return fail("Maximum eight site photos per change order.", 409);
  const mime = req.headers.get("content-type") || "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(mime)) return fail("Upload a site photo using multipart/form-data.");
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return fail("Image too large.", 413);
  let raw: Buffer;
  try { raw = await limited(req); } catch { return fail("Image too large or invalid.", 413); }
  let form: FormData;
  try {
    form = await new Request("https://local.invalid/upload", { method: "POST", headers: { "content-type": mime }, body: new Uint8Array(raw) }).formData();
  } catch { return fail("Invalid multipart photo."); }
  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("Choose an image.");
  if (photo.size < 10 || photo.size > MAX_UPLOAD) return fail("Photo must be under 3 MB.", 413);
  const bytes = Buffer.from(await photo.arrayBuffer());
  const identified = classify(bytes);
  if (!identified) return fail("Only JPEG, PNG or WebP photos are allowed.");
  const id = randomUUID(), at = new Date().toISOString(), path = join(ROOT, id + identified.ext);
  try {
    writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    db.transaction(() => {
      const count = db.query("SELECT COUNT(*) AS total FROM change_order_attachments WHERE order_id = ?").get(orderId) as { total: number };
      if (count.total >= MAX_FILES) throw Error("Maximum eight site photos per change order.");
      db.query("INSERT INTO change_order_attachments (id,order_id,filename,mime,bytes,created_at) VALUES (?,?,?,?,?,?)")
        .run(id, orderId, safeName(photo.name, identified.ext), identified.mime, bytes.length, at);
      db.query("INSERT INTO change_order_events (id,order_id,event_type,actor,detail,occurred_at) VALUES (?,?,?,?,?,?)")
        .run(randomUUID(), orderId, "photo_added", "contractor", id, at);
    })();
  } catch {
    try { unlinkSync(path); } catch {}
    return fail("Unable to save evidence. Please retry.", 500);
  }
  return reply({ ok: true, attachment: { id, filename: safeName(photo.name, identified.ext), mime: identified.mime, bytes: bytes.length, createdAt: at } }, 201);
}
