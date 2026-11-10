import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  SINA_EVENT_URL, buildPilotObservedEvent, initSinaEventOutbox,
  enqueuePilotObserved, relayConfigured, dispatchSinaEventOutbox
} from "./sina-org-events.ts";

const TOKEN = "s".repeat(48);
const LEAD = "01234567-89ab-4cde-8abc-0123456789ab";
const NOW = new Date("2026-11-09T23:00:00Z");

function makeDb(): Database {
  const db = new Database(":memory:");
  initSinaEventOutbox(db);
  return db;
}
function row(db: Database): Record<string, any> {
  return db.query("SELECT * FROM sina_event_outbox LIMIT 1").get() as Record<string, any>;
}

describe("Sina organization transport outbox", () => {
  it("constructs only a safe anonymous intake observation", () => {
    const obj = buildPilotObservedEvent(LEAD, NOW.toISOString());
    expect(obj.event_type).toBe("commercial_intake");
    expect(obj.source_id).toBe("buildworkflow");
    expect(obj.source_event_id).toBe("pilot:" + LEAD);
    expect(obj.metrics).toEqual({});
    expect(obj.confidence).toBe(0);
    expect(JSON.stringify(obj)).not.toContain("email");
    expect(JSON.stringify(obj)).not.toContain("contact_name");
    expect(JSON.stringify(obj)).not.toContain("test@example");
    expect(() => buildPilotObservedEvent("bad", NOW.toISOString())).toThrow();
  });

  it("requires the exact approved Founder OS endpoint and a long separate bearer", () => {
    expect(relayConfigured(SINA_EVENT_URL, TOKEN)).toBe(true);
    expect(relayConfigured("https://evil.example/api/v1/organization/events", TOKEN)).toBe(false);
    expect(relayConfigured(SINA_EVENT_URL + "?url=evil", TOKEN)).toBe(false);
    expect(relayConfigured(SINA_EVENT_URL, "short")).toBe(false);
  });

  it("persists while unconfigured, then sends idempotently without exposing lead PII", async () => {
    const db = makeDb();
    try {
      enqueuePilotObserved(db, LEAD, NOW.toISOString());
      enqueuePilotObserved(db, LEAD, NOW.toISOString());
      expect(db.query("SELECT COUNT(*) AS n FROM sina_event_outbox").get()).toEqual({ n: 1 });
      const disabled = await dispatchSinaEventOutbox(db, {url:"", token:""});
      expect(disabled.state).toBe("NOT_CONFIGURED");
      expect(row(db).state).toBe("PENDING");
      const calls: any[] = [];
      const outcome = await dispatchSinaEventOutbox(db, {
        url: SINA_EVENT_URL, token: TOKEN, now: () => NOW,
        transport: async (url, opts) => {
          calls.push([url, opts]);
          return new Response(JSON.stringify({created:true}), {status:201});
        },
      });
      expect(outcome.delivered).toBe(1);
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe(SINA_EVENT_URL);
      const payload = JSON.parse(calls[0][1].body as string);
      expect(payload.source_event_id).toBe("pilot:" + LEAD);
      expect(JSON.stringify(payload)).not.toContain("email");
      expect(row(db).state).toBe("DELIVERED");
      const replay = await dispatchSinaEventOutbox(db, {
        url:SINA_EVENT_URL,token:TOKEN,now:()=>NOW,
        transport:async()=>{ throw Error("must not resend delivered"); }
      });
      expect(replay.attempted).toBe(0);
    } finally { db.close(); }
  });

  it("retries transport failures with a bounded backoff; isolates auth failures", async () => {
    const db = makeDb();
    try {
      enqueuePilotObserved(db, LEAD, NOW.toISOString());
      await dispatchSinaEventOutbox(db, {
        url:SINA_EVENT_URL,token:TOKEN,now:()=>NOW,
        transport:async()=>new Response("", {status:503})
      });
      expect(row(db).state).toBe("PENDING");
      expect(row(db).attempts).toBe(1);
      expect(new Date(row(db).next_attempt_at).getTime()).toBeGreaterThan(NOW.getTime());
      const skipped = await dispatchSinaEventOutbox(db, {
        url:SINA_EVENT_URL,token:TOKEN,now:()=>NOW,
        transport:async()=>{ throw Error("premature retry"); }
      });
      expect(skipped.attempted).toBe(0);
      await dispatchSinaEventOutbox(db, {
        url:SINA_EVENT_URL,token:TOKEN,now:()=>new Date(NOW.getTime()+120000),
        transport:async()=>new Response("", {status:401})
      });
      expect(row(db).state).toBe("AUTH_HOLD");
      expect(row(db).last_http_status).toBe(401);
    } finally { db.close(); }
  });

  it("places conflicting duplicate event IDs into review without false delivery", async () => {
    const db = makeDb();
    try {
      enqueuePilotObserved(db, LEAD, NOW.toISOString());
      await dispatchSinaEventOutbox(db, {
        url:SINA_EVENT_URL,token:TOKEN,now:()=>NOW,
        transport:async()=>new Response("", {status:409})
      });
      expect(row(db).state).toBe("CONFLICT_REVIEW");
      expect(row(db).last_http_status).toBe(409);
    } finally { db.close(); }
  });
});
