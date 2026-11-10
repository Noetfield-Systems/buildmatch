/** Source-scoped, PII-free delivery from genuine pilot intake into Sina Founder OS.
 * The product owns its SQLite outbox; Sina owns signal projection; Company OS
 * owns consequential WorkPackets. This is transport, NOT another brain/agent scheduler.
 */
import { Database } from "bun:sqlite";

export const SINA_EVENT_URL = "https://sina-founder-os-staging-staging.up.railway.app/api/v1/organization/events";
export const EVENT_SCHEMA = "sina.organization.signal-transport.v1";

export function initSinaEventOutbox(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS sina_event_outbox (event_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_http_status INTEGER)");
  db.exec("CREATE INDEX IF NOT EXISTS sina_event_outbox_pending_idx ON sina_event_outbox(state,next_attempt_at,created_at)");
}

export function buildPilotObservedEvent(pilotId: string, observedAt: string) {
  if (!/^[0-9a-f-]{36}$/i.test(pilotId)) throw new Error("invalid pilot id");
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("invalid observedAt");
  return {
    source_id: "buildworkflow",
    source_event_id: "pilot:" + pilotId,
    project_id: "buildworkflow-field-change-handoff",
    company_id: "noetfield-systems-inc",
    event_type: "commercial_intake",
    observed_at: observedAt,
    summary: "Opt-in BuildWorkflow pilot request recorded; buyer qualification remains unverified",
    evidence_ref: "receipt:buildworkflow/pilot/" + pilotId,
    metrics: {},
    confidence: 0,
    impact: 2,
  };
}

export function enqueuePilotObserved(db: Database, pilotId: string, observedAt: string): void {
  const event = buildPilotObservedEvent(pilotId, observedAt);
  db.query("INSERT OR IGNORE INTO sina_event_outbox (event_id,payload_json,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?)")
    .run(event.source_event_id, JSON.stringify(event), observedAt, observedAt, observedAt);
}

export function relayConfigured(url = process.env.SINA_ORGANIZATION_EVENT_URL || "",
                                token = process.env.SINA_ORGANIZATION_EVENT_TOKEN || ""): boolean {
  return url === SINA_EVENT_URL && token.length >= 40 && !/\s/.test(token);
}

type Transport = (url: string, init: RequestInit) => Promise<Response>;
type RelayOptions = { url?: string; token?: string; transport?: Transport; now?: () => Date };
export async function dispatchSinaEventOutbox(db: Database, options: RelayOptions = {}) {
  const url = options.url ?? process.env.SINA_ORGANIZATION_EVENT_URL ?? "";
  const token = options.token ?? process.env.SINA_ORGANIZATION_EVENT_TOKEN ?? "";
  if (!relayConfigured(url, token)) {
    return { schema: EVENT_SCHEMA, state: "NOT_CONFIGURED", attempted: 0, delivered: 0 };
  }
  const transport: Transport = options.transport || fetch;
  const now = options.now || (() => new Date());
  const rows = db.query(
    "SELECT event_id,payload_json,attempts FROM sina_event_outbox WHERE state='PENDING' AND next_attempt_at <= ? ORDER BY created_at ASC LIMIT 5"
  ).all(now().toISOString()) as Array<{event_id: string; payload_json: string; attempts: number}>;
  let delivered = 0;
  for (const row of rows) {
    let code = 0;
    try {
      const res = await transport(url, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: row.payload_json,
        redirect: "error",
        signal: AbortSignal.timeout(5000)
      });
      code = res.status;
    } catch {
      code = 0; // Never log body, token, or customer details.
    }
    const attempt = row.attempts + 1;
    const stamp = now().toISOString();
    if (code === 200 || code === 201) {
      db.query("UPDATE sina_event_outbox SET state='DELIVERED',attempts=?,last_http_status=?,updated_at=? WHERE event_id=? AND state='PENDING'")
        .run(attempt, code, stamp, row.event_id);
      delivered++;
    } else if (code === 409) {
      db.query("UPDATE sina_event_outbox SET state='CONFLICT_REVIEW',attempts=?,last_http_status=?,updated_at=? WHERE event_id=? AND state='PENDING'")
        .run(attempt, code, stamp, row.event_id);
    } else if (code === 401 || code === 403) {
      db.query("UPDATE sina_event_outbox SET state='AUTH_HOLD',attempts=?,last_http_status=?,updated_at=? WHERE event_id=? AND state='PENDING'")
        .run(attempt, code, stamp, row.event_id);
    } else {
      const delaySeconds = Math.min(3600, 15 * Math.pow(2, Math.min(attempt, 8)));
      const nextAt = new Date(now().getTime() + delaySeconds * 1000).toISOString();
      db.query("UPDATE sina_event_outbox SET attempts=?,last_http_status=?,updated_at=?,next_attempt_at=? WHERE event_id=? AND state='PENDING'")
        .run(attempt, code || null, stamp, nextAt, row.event_id);
    }
  }
  return { schema: EVENT_SCHEMA, state: "DELIVERY_ATTEMPTED", attempted: rows.length, delivered };
}
