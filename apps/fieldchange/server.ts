import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { calculateChangeOrder } from "./src/pricing.ts";

const port = Number(process.env.PORT || 8080);
const dbPath = process.env.DATABASE_PATH || "/tmp/fieldchange.sqlite";
const adminToken = process.env.ADMIN_TOKEN || "";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
db.exec("CREATE TABLE IF NOT EXISTS pilot_requests (id TEXT PRIMARY KEY, company TEXT NOT NULL, contact_name TEXT NOT NULL, trade TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', monthly_volume TEXT NOT NULL DEFAULT '', current_process TEXT NOT NULL DEFAULT '', problem TEXT NOT NULL DEFAULT '', consent INTEGER NOT NULL CHECK(consent = 1), ip_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL)");
db.exec("CREATE INDEX IF NOT EXISTS pilot_created_idx ON pilot_requests(created_at DESC)");
const insertLead = db.query("INSERT INTO pilot_requests (id,company,contact_name,trade,email,phone,monthly_volume,current_process,problem,consent,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)");
const recentLeads = db.query("SELECT id,company,contact_name,trade,email,phone,monthly_volume,current_process,problem,status,created_at FROM pilot_requests ORDER BY created_at DESC LIMIT 200");
const removeLead = db.query("DELETE FROM pilot_requests WHERE id = ?");
const rateLimits = new Map<string, number[]>();

function clean(value: unknown, max = 500): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function json(data: unknown, status = 200, type = "application/json; charset=utf-8") {
  return new Response(type.startsWith("application/json") ? JSON.stringify(data) : String(data), {
    status, headers: {
      "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff",
      "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
    }
  });
}
function ipHash(req: Request) {
  const ip = clean((req.headers.get("x-forwarded-for") || "unknown").split(",")[0], 80);
  return createHash("sha256").update(ip + ":" + adminToken).digest("hex");
}
function allowed(req: Request) {
  const key = ipHash(req), now = Date.now();
  const times = (rateLimits.get(key) || []).filter(t => now - t < 600000);
  if (times.length >= 4) return false;
  times.push(now); rateLimits.set(key, times);
  if (rateLimits.size > 5000) rateLimits.clear();
  return true;
}
function admin(req: Request) {
  return Boolean(adminToken) && req.headers.get("authorization") === "Bearer " + adminToken;
}
const sinaRevenueReadToken = process.env.SINA_FOUNDER_OS_REVENUE_READ_TOKEN || "";
function sinaRevenueReader(req: Request) {
  const supplied = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "").trim();
  if (sinaRevenueReadToken.length < 32 || supplied.length < 32 || supplied.length !== sinaRevenueReadToken.length) return false;
  const expectedDigest = createHash("sha256").update(sinaRevenueReadToken).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}
function revenueSummary() {
  const total = db.query("SELECT COUNT(*) AS total FROM pilot_requests").get() as { total: number };
  const statusRows = db.query("SELECT status, COUNT(*) AS count FROM pilot_requests GROUP BY status ORDER BY status").all() as Array<{ status: string; count: number }>;
  const tradeRows = db.query("SELECT trade, COUNT(*) AS count FROM pilot_requests GROUP BY trade ORDER BY count DESC, trade ASC LIMIT 10").all() as Array<{ trade: string; count: number }>;
  const recent7d = db.query("SELECT COUNT(*) AS count FROM pilot_requests WHERE created_at >= ?").get(new Date(Date.now() - 7 * 86400000).toISOString()) as { count: number };
  const recent30d = db.query("SELECT COUNT(*) AS count FROM pilot_requests WHERE created_at >= ?").get(new Date(Date.now() - 30 * 86400000).toISOString()) as { count: number };
  const first = db.query("SELECT MIN(created_at) AS first FROM pilot_requests").get() as { first: string | null };
  const last = db.query("SELECT MAX(created_at) AS last FROM pilot_requests").get() as { last: string | null };
  return {
    schema: "buildworkflow.fieldchange.revenue-summary.v1",
    source: "fieldchange-desk",
    generated_at: new Date().toISOString(),
    freshness: "LIVE",
    lead_count: Number(total.total || 0),
    status_counts: Object.fromEntries(statusRows.map(row => [clean(row.status, 40) || "unknown", Number(row.count || 0)])),
    trade_counts: tradeRows.map(row => ({ trade: clean(row.trade, 80), count: Number(row.count || 0) })),
    recent_7d_requests: Number(recent7d.count || 0),
    recent_30d_requests: Number(recent30d.count || 0),
    first_request_at: first.first,
    latest_request_at: last.last,
    contracted_value: { state: "NOT_TRACKED" },
    collected_revenue: { state: "NOT_TRACKED" },
    privacy: { personal_data_returned: false, customer_records_returned: false }
  };
}
function csvCell(v: unknown) { return '"' + String(v ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ") + '"'; }

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method === "GET" && (path === "/" || path === "/index.html"))
      return new Response(Bun.file("public/index.html"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (req.method === "GET" && path === "/admin")
      return new Response(Bun.file("public/admin.html"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (req.method === "GET" && path === "/privacy")
      return new Response(Bun.file("public/privacy.html"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    if (req.method === "GET" && path === "/api/integrations/sina/revenue-summary") {
      if (!sinaRevenueReader(req)) return json({ error: "Unauthorized." }, 401);
      try { return json(revenueSummary()); }
      catch { return json({ error: "Revenue summary unavailable." }, 503); }
    }
    if (req.method === "GET" && path === "/api/health") {
      try { db.query("SELECT 1").get(); return json({ ok: true, app: "fieldchange-desk", storage: "connected" }); }
      catch { return json({ ok: false, storage: "unavailable" }, 503); }
    }
    if (req.method === "POST" && path === "/api/price") {
      try { return json(calculateChangeOrder(await req.json() as Record<string, unknown>)); }
      catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid pricing input." }, 400); }
    }
    if (req.method === "POST" && path === "/api/pilot") {
      const raw = await req.text();
      if (raw.length > 12000) return json({ error: "Request too large." }, 413);
      if (!allowed(req)) return json({ error: "Too many requests. Try again later." }, 429);
      let b: Record<string, unknown>;
      try { b = JSON.parse(raw); } catch { return json({ error: "Submit a valid form." }, 400); }
      if (clean(b.website, 200)) return json({ ok: true, message: "Request received." }, 201);
      const company = clean(b.company, 140), contact = clean(b.contactName, 120);
      const trade = clean(b.trade, 80), email = clean(b.email, 254).toLowerCase();
      const phone = clean(b.phone, 50), volume = clean(b.monthlyVolume, 80);
      const process = clean(b.currentProcess, 120), problem = clean(b.problem, 1200);
      if (!company || !contact || !trade || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || b.consent !== true)
        return json({ error: "Company, contact name, trade, valid email and consent are required." }, 400);
      try {
        insertLead.run(randomUUID(), company, contact, trade, email, phone, volume, process, problem, ipHash(req), new Date().toISOString());
        return json({ ok: true, message: "Pilot request received." }, 201);
      } catch { return json({ error: "The request could not be saved." }, 500); }
    }
    if (req.method === "GET" && path === "/api/admin/leads") {
      if (!admin(req)) return json({ error: "Unauthorized." }, 401);
      const leads = recentLeads.all();
      return json({ leads, count: leads.length });
    }
    if (req.method === "GET" && path === "/api/admin/export.csv") {
      if (!admin(req)) return json({ error: "Unauthorized." }, 401);
      const leads = recentLeads.all() as Array<Record<string, unknown>>;
      const keys = ["created_at","company","contact_name","trade","email","phone","monthly_volume","current_process","problem","status"];
      const rows = [keys.join(",")];
      for (const lead of leads) rows.push(keys.map(k => csvCell(lead[k])).join(","));
      return json(rows.join("\r\n"), 200, "text/csv; charset=utf-8");
    }
    const match = path.match(/^\/api\/admin\/leads\/([a-f0-9-]+)$/i);
    if (req.method === "DELETE" && match) {
      if (!admin(req)) return json({ error: "Unauthorized." }, 401);
      removeLead.run(match[1]); return json({ ok: true });
    }
    return json({ error: "Not found." }, 404);
  }
});
console.log("FieldChange Desk listening on " + port);