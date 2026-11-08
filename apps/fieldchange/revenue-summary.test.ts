import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const dataDir = mkdtempSync(join(tmpdir(), "fieldchange-revenue-test-"));
const port = 21000 + Math.floor(Math.random() * 20000);
const readToken = "fieldchange-sina-integration-test-token-0123456789abcdef";
const base = "http://127.0.0.1:" + port;
let processHandle: Bun.Subprocess<"ignore", "pipe", "ignore">;

beforeAll(async () => {
  processHandle = Bun.spawn(["bun", "run", "server.ts"], {
    cwd: import.meta.dir,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(dataDir, "test.sqlite"),
      ADMIN_TOKEN: "fieldchange-admin-test-token",
      SINA_FOUNDER_OS_REVENUE_READ_TOKEN: readToken
    },
    stdout: "ignore",
    stderr: "pipe"
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) { ready = true; break; }
    } catch {}
    await Bun.sleep(100);
  }
  if (!ready) {
    processHandle.kill();
    throw new Error("FieldChange test server did not become ready");
  }
}, 10000);

afterAll(async () => {
  processHandle?.kill();
  if (processHandle) await processHandle.exited;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("Sina read-only revenue summary", () => {
  it("requires its dedicated token", async () => {
    const missing = await fetch(base + "/api/integrations/sina/revenue-summary");
    expect(missing.status).toBe(401);
    const wrong = await fetch(base + "/api/integrations/sina/revenue-summary", {
      headers: { Authorization: "Bearer wrong-token-that-is-long-enough-to-test-123" }
    });
    expect(wrong.status).toBe(401);
  });

  it("returns aggregate pilot demand without customer PII or invented revenue", async () => {
    const intake = await fetch(base + "/api/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: "Sina Test Plumbing",
        contactName: "Private Test Contact",
        trade: "Plumbing",
        email: "private-test@example.invalid",
        phone: "555-0100",
        monthlyVolume: "1-5",
        currentProcess: "Paper",
        problem: "Test-only request",
        consent: true
      })
    });
    expect(intake.status).toBe(201);

    const response = await fetch(base + "/api/integrations/sina/revenue-summary", {
      headers: { Authorization: "Bearer " + readToken }
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.schema).toBe("buildworkflow.fieldchange.revenue-summary.v1");
    expect(body.lead_count).toBe(1);
    expect(body.status_counts.new).toBe(1);
    expect(body.trade_counts[0].trade).toBe("Plumbing");
    expect(body.recent_7d_requests).toBe(1);
    expect(body.contracted_value.state).toBe("NOT_TRACKED");
    expect(body.collected_revenue.state).toBe("NOT_TRACKED");
    expect(body.privacy.personal_data_returned).toBe(false);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Private Test Contact");
    expect(serialized).not.toContain("private-test@example.invalid");
    expect(serialized).not.toContain("555-0100");
  });
});
