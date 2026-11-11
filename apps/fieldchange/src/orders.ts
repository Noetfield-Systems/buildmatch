import { Database } from "bun:sqlite";
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { calculateChangeOrder } from "./pricing.ts";

type Row = Record<string, any>;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");
function secretKey() {
  const s = process.env.ORDER_LINK_SECRET || process.env.ADMIN_TOKEN || "";
  if (s.length < 24) throw new Error("ORDER_LINK_SECRET or ADMIN_TOKEN must contain at least 24 characters.");
  return createHash("sha256").update("buildworkflow-approval-v1:" + s).digest();
}
function seal(s: string) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secretKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(s, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function unseal(s: string) {
  const b = Buffer.from(s, "base64url"), decipher = createDecipheriv("aes-256-gcm", secretKey(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString("utf8");
}
const tidy = (v: unknown, max = 400) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const mail = (v: unknown) => tidy(v, 254).toLowerCase();
const money = (v: unknown) => Number(v ?? 0);
const orderRates = new Map<string, { count: number; expires: number }>();
function allowOrder(req: Request) {
  const client = hash((req.headers.get("x-forwarded-for") || "unknown").split(",")[0]);
  const now = Date.now();
  const current = orderRates.get(client);
  const next = !current || current.expires < now ? { count: 1, expires: now + 30 * 60 * 1000 } : { count: current.count + 1, expires: current.expires };
  orderRates.set(client, next);
  if (orderRates.size > 10000) orderRates.clear();
  return next.count <= 15;
}
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const failure = (message: string, status = 400) => response({ error: message }, status);

export function initOrders(db: Database) {
  db.exec("CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, manage_hash TEXT NOT NULL, approve_hash TEXT NOT NULL, approve_secret TEXT NOT NULL, record_json TEXT NOT NULL, pricing_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', paid INTEGER NOT NULL DEFAULT 0, paid_at TEXT, payment_session TEXT, payment_intent TEXT, signed_name TEXT, signed_note TEXT, signed_at TEXT, created_at TEXT NOT NULL)");
  db.exec("CREATE TABLE IF NOT EXISTS change_order_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, event_type TEXT NOT NULL, actor TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL)");
  db.exec("CREATE TABLE IF NOT EXISTS fieldchange_stripe_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, received_at TEXT NOT NULL)");
  db.exec("CREATE INDEX IF NOT EXISTS change_orders_created ON change_orders(created_at DESC)");
}

function getOrder(db: Database, id: string): Row | null {
  return (db.query("SELECT * FROM change_orders WHERE id = ?").get(id) as Row | null) || null;
}
function permit(row: Row, supplied: string): "manage" | "approve" | null {
  if (!supplied || supplied.length > 128) return null;
  const digest = hash(supplied);
  const equal = (other: string) => timingSafeEqual(Buffer.from(digest), Buffer.from(other));
  if (equal(row.manage_hash)) return "manage";
  if (equal(row.approve_hash)) return "approve";
  return null;
}
function publicView(row: Row, role: "manage" | "approve", url: URL, accessToken: string) {
  const data = JSON.parse(row.record_json);
  const priced = JSON.parse(row.pricing_json);
  const base = url.origin;
  const view: Row = {
    id: row.id, project: data.project, jobNumber: data.jobNumber, customer: data.customer,
    requestedBy: data.requestedBy, trade: data.trade, changeType: data.changeType,
    workDate: data.workDate, scope: data.scope, scheduleDays: data.scheduleDays,
    notes: data.notes, evidence: data.evidence, total: priced.recommendedPrice, currency: "CAD",
    status: row.status, paid: row.paid === 1, createdAt: row.created_at,
    signedName: row.signed_name, signedNote: row.signed_note, signedAt: row.signed_at
  };
  if (role === "manage") {
    const approveToken = unseal(row.approve_secret);
    view.cost = priced.loadedCost;
    view.marginPct = priced.achievedMarginPct;
    view.manageUrl = base + "/order?order=" + row.id + "&token=" + encodeURIComponent(accessToken);
    if (row.paid === 1) {
      view.approvalUrl = base + "/order?order=" + row.id + "&token=" + encodeURIComponent(approveToken);
    } else {
      view.checkoutUrl = getCheckoutUrl(row.id);
    }
  }
  return view;
}
function getCheckoutUrl(orderId: string) {
  const value = (process.env.STRIPE_PACK_PAYMENT_LINK || "").trim();
  if (!/^https:\/\/buy\.stripe\.com\//.test(value)) return null;
  const parsed = new URL(value);
  parsed.searchParams.set("client_reference_id", orderId);
  return parsed.toString();
}
async function body(req: Request, max = 20000): Promise<Row> {
  const raw = await req.text();
  if (raw.length > max) throw new Error("Request exceeds size limit.");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON object.");
  return parsed as Row;
}
function recordEvent(db: Database, orderId: string, type: string, actor: string, detail = "") {
  db.query("INSERT INTO change_order_events (id,order_id,event_type,actor,detail,occurred_at) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(), orderId, type, actor, detail, new Date().toISOString());
}
function parseOrder(data: Row) {
  const project = tidy(data.project, 120), scope = tidy(data.scope, 2200);
  if (project.length < 2 || scope.length < 15) throw new Error("Project and a detailed change scope (15+ characters) are required.");
  const scheduleDays = Number(data.scheduleDays ?? 0);
  if (!Number.isSafeInteger(scheduleDays) || scheduleDays < 0 || scheduleDays > 365) throw new Error("Schedule impact must be 0–365 working days.");
  const priced = calculateChangeOrder(data.pricing ?? {});
  if (priced.recommendedPrice <= 0) throw new Error("Enter billable costs before creating a change order.");
  if (!priced.targetAchievable) throw new Error("The target margin is not achievable under this price cap. Adjust the cap or pricing before proceeding.");
  const evidence = Array.isArray(data.evidence) ? data.evidence.filter((x: unknown) => typeof x === "string").map((x: string) => tidy(x, 80)).slice(0, 12) : [];
  return {
    priced, record: {
      project, scope, jobNumber: tidy(data.jobNumber, 80), customer: tidy(data.customer, 120),
      requestedBy: tidy(data.requestedBy, 120), trade: tidy(data.trade, 60),
      changeType: tidy(data.changeType, 120), workDate: tidy(data.workDate, 20),
      scheduleDays, notes: tidy(data.notes, 1200), evidence
    }
  };
}
function validSignature(raw: string, header: string, secret: string): boolean {
  const stamp = header.match(/(?:^|,)\s*t=(\d+)/)?.[1];
  if (!stamp || Math.abs(Date.now() / 1000 - Number(stamp)) > 300) return false;
  const signatures = [...header.matchAll(/(?:^|,)\s*v1=([0-9a-f]{64})/gi)].map(x => x[1]);
  const expected = createHmac("sha256", secret).update(stamp + "." + raw).digest();
  return signatures.some(x => timingSafeEqual(expected, Buffer.from(x, "hex")));
}
export { validSignature as verifyStripeWebhookSignature };

async function webhook(req: Request, db: Database) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) return failure("Webhook not configured.", 503);
  const raw = await req.text();
  if (raw.length > 200000) return failure("Payload too large.", 413);
  if (!validSignature(raw, req.headers.get("stripe-signature") || "", secret)) return failure("Invalid signature.", 400);
  let event: Row;
  try { event = JSON.parse(raw); } catch { return failure("Invalid payload.", 400); }
  if (!/^evt_[a-zA-Z0-9]+$/.test(String(event.id || ""))) return failure("Invalid event id.");
  const obj = event?.data?.object || {};
  const type = String(event.type || "");
  try {
    db.transaction(() => {
      const added = db.query("INSERT OR IGNORE INTO fieldchange_stripe_events (event_id,event_type,received_at) VALUES (?,?,?)").run(event.id, type, new Date().toISOString());
      if (!added.changes) return;
      if ((type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded")
        && obj.payment_status === "paid" && typeof obj.client_reference_id === "string"
        && Boolean(process.env.STRIPE_PACK_PAYMENT_LINK_ID)
        && obj.payment_link === process.env.STRIPE_PACK_PAYMENT_LINK_ID
        && String(obj.currency).toLowerCase() === "cad" && money(obj.amount_subtotal) === 900 && money(obj.amount_total) >= 900) {
        const updated = db.query("UPDATE change_orders SET paid = 1, status = CASE WHEN status IN ('draft','refunded') THEN 'pending' ELSE status END, paid_at = COALESCE(paid_at, ?), payment_session = ?, payment_intent = ? WHERE id = ? AND paid = 0")
          .run(new Date().toISOString(), tidy(obj.id, 120), tidy(obj.payment_intent, 120), obj.client_reference_id);
        if (updated.changes) recordEvent(db, obj.client_reference_id, "payment_confirmed", "stripe", tidy(obj.id, 120));
      }
      if (type === "charge.refunded" && obj.refunded === true && obj.payment_intent) {
        const order = db.query("SELECT id FROM change_orders WHERE payment_intent = ? AND paid = 1").get(String(obj.payment_intent)) as Row | null;
        if (order) {
          db.query("UPDATE change_orders SET paid = 0, status = CASE WHEN status = 'pending' THEN 'refunded' ELSE status END WHERE id = ?").run(order.id);
          recordEvent(db, order.id, "payment_refunded", "stripe", tidy(obj.id, 120));
        }
      }
    })();
  } catch (e) {
    console.error("fieldchange_stripe_processing_error", e instanceof Error ? e.message : "unknown");
    return failure("Webhook processing failed.", 500);
  }
  return response({ received: true });
}
export function revenueFromOrders(db: Database) {
  const d = db.query("SELECT COUNT(*) AS created, SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS active_paid, SUM(CASE WHEN paid = 1 THEN 900 ELSE 0 END) AS active_paid_cents, COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved FROM change_orders").get() as Row;
  return { created_orders: Number(d.created || 0), active_paid_orders: Number(d.active_paid || 0),
    paid_gross_cad_cents: Number(d.active_paid_cents || 0), approved_orders: Number(d.approved || 0),
    revenue_basis: "signed_stripe_webhook_records_less_refunds; not net profit, Stripe balance or payout reconciliation" };
}
export async function handleOrderRoute(req: Request, db: Database): Promise<Response | null> {
  const url = new URL(req.url), path = url.pathname;
  if (req.method === "GET" && path === "/api/commercial/status")
    return response({ approval_workflow: true, checkout_configured: Boolean(getCheckoutUrl("sample")), webhook_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET), currency: "CAD", pack_price_cents: 900 });
  if (req.method === "POST" && path === "/api/stripe/webhook") return webhook(req, db);
  if (req.method === "POST" && path === "/api/orders") {
    if (!allowOrder(req)) return failure("Too many new packs. Try again later.", 429);
    try {
      const payload = await body(req);
      const { record, priced } = parseOrder(payload);
      const id = randomUUID(), manageToken = token(), approveToken = token(), now = new Date().toISOString();
      db.transaction(() => {
        db.query("INSERT INTO change_orders (id,manage_hash,approve_hash,approve_secret,record_json,pricing_json,created_at) VALUES (?,?,?,?,?,?,?)")
          .run(id, hash(manageToken), hash(approveToken), seal(approveToken), JSON.stringify(record), JSON.stringify(priced), now);
        recordEvent(db, id, "created", "contractor");
      })();
      const approvalUrl = url.origin + "/order?order=" + id + "&token=" + encodeURIComponent(approveToken);
      const manageUrl = url.origin + "/order?order=" + id + "&token=" + encodeURIComponent(manageToken);
      return response({ id, status: "draft", approvalUrl, manageUrl, checkoutUrl: getCheckoutUrl(id), amountCAD: 9, currency: "CAD", note: "Approval activates only after a verified payment webhook." }, 201);
    } catch (e) { return failure(e instanceof Error ? e.message : "Could not create order."); }
  }
  const m = path.match(/^\/api\/orders\/([0-9a-f-]{36})(\/respond)?$/);
  if (m) {
    const row = getOrder(db, m[1]);
    if (!row) return failure("Order not found.", 404);
    const accessToken = url.searchParams.get("token") || "";
    const role = permit(row, accessToken);
    if (!role) return failure("Invalid access link.", 403);
    if (req.method === "GET" && !m[2]) return response(publicView(row, role, url, accessToken));
    if (req.method === "POST" && m[2] && role === "approve") {
      if (row.paid !== 1) return failure("This approval link is not activated yet.", 402);
      if (row.status !== "pending") return failure("This change order already has a recorded decision.", 409);
      let data: Row;
      try { data = await body(req, 4000); } catch { return failure("Invalid response."); }
      const decision = data.decision === "approved" ? "approved" : data.decision === "declined" ? "declined" : null;
      const signedName = tidy(data.signedName, 120), note = tidy(data.note, 500);
      if (!decision || signedName.length < 2 || data.acknowledged !== true) return failure("Decision, full name and acknowledgement are required.");
      const now = new Date().toISOString();
      let changed = 0;
      db.transaction(() => {
        const outcome = db.query("UPDATE change_orders SET status = ?, signed_name = ?, signed_note = ?, signed_at = ? WHERE id = ? AND status = 'pending' AND paid = 1")
          .run(decision, signedName, note, now, row.id);
        changed = outcome.changes;
        if (changed) recordEvent(db, row.id, decision, "customer", hash(req.headers.get("x-forwarded-for") || "unknown"));
      })();
      if (!changed) return failure("This order was already decided.", 409);
      return response({ ok: true, status: decision, signedAt: now });
    }
    return failure("Not found.", 404);
  }
  return null;
}
