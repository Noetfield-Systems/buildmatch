import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { qaPersonas } from "./personas.ts";

const cwd = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "bw-synthetic-personas-"));
const port = 24000 + Math.floor(Math.random() * 15000);
const base = "http://127.0.0.1:" + port;
const revenueToken = "fieldchange-persona-qa-revenue-token-long-enough-for-tests";
let worker: ReturnType<typeof Bun.spawn> | undefined;

beforeAll(async () => {
  worker = Bun.spawn(["bun", "run", "server.ts"], {
    cwd,
    env: {
      ...process.env, PORT: String(port),
      DATABASE_PATH: join(dir, "qa-isolated.sqlite"),
      ADMIN_TOKEN: "qa-only-do-not-use-in-production",
      SINA_FOUNDER_OS_REVENUE_READ_TOKEN: revenueToken,
    },
    stdout: "ignore", stderr: "pipe",
  });
  for (let attempt = 0; attempt < 65; attempt++) {
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return;
    } catch { /* local server has not started */ }
    await Bun.sleep(100);
  }
  throw new Error("Isolated FieldChange QA server failed to start.");
}, 12000);

afterAll(async () => {
  worker?.kill();
  if (worker) await worker.exited;
  rmSync(dir, { recursive: true, force: true });
});

test("synthetic QA identities stay separate from real customers", () => {
  expect(qaPersonas).toHaveLength(5);
  expect(new Set(qaPersonas.map(p => p.id)).size).toBe(5);
  for (const persona of qaPersonas) {
    expect(persona.classification).toBe("SYNTHETIC_QA");
    expect(persona.endpoint).toBe("/api/price");
    expect(persona.role.length).toBeGreaterThan(7);
  }
});

for (const persona of qaPersonas) {
  test("QA persona: " + persona.id, async () => {
    const response = await fetch(base + persona.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persona.input),
    });
    const actual = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(persona.expected_http);
    for (const [field, expected] of Object.entries(persona.expected)) {
      expect(actual[field]).toEqual(expected);
    }
    if (persona.expected_http === 400) {
      expect(actual.recommendedPrice).toBeUndefined();
    }
  });
}

test("QA never creates buyer records or synthetic traction", async () => {
  const response = await fetch(base + "/api/integrations/sina/revenue-summary", {
    headers: { Authorization: "Bearer " + revenueToken },
  });
  expect(response.status).toBe(200);
  const report = await response.json() as { lead_count: number; recent_7d_requests: number };
  expect(report.lead_count).toBe(0);
  expect(report.recent_7d_requests).toBe(0);
});
