import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOrders, handleOrderRoute } from "../src/orders.ts";

describe("private field evidence and invoice handoff", () => {
  test("uploads only authenticated photos, keeps review links private, and blocks premature invoice handoff", async () => {
    const old = { ORDER_LINK_SECRET: process.env.ORDER_LINK_SECRET, FIELDCHANGE_EVIDENCE_DIR: process.env.FIELDCHANGE_EVIDENCE_DIR };
    const dir = mkdtempSync(join(tmpdir(), "fieldchange-evidence-"));
    const db = new Database(":memory:");
    try {
      process.env.ORDER_LINK_SECRET = "test-fieldchange-photo-token-32chars";
      process.env.FIELDCHANGE_EVIDENCE_DIR = dir;
      const { initAttachments, handleEvidenceRoute } = await import("../src/evidence.ts");
      initOrders(db);
      initAttachments(db);
      const payload = {
        project: "Job 42", scope: "Additional electrical conduit due to requested owner design changes.",
        customer: "Test GC", customerEmail: "review@example.com",
        pricing: { labourHours: 8, labourRate: 75, materials: 110, targetMarginPct: 30 }
      };
      const created = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), db);
      expect(created?.status).toBe(201);
      const pack = await created!.json();
      const manage = new URL(pack.manageUrl).searchParams.get("token");
      const approve = new URL(pack.approvalUrl).searchParams.get("token");
      const endpoint = "https://buildworkflow.ca/api/orders/" + pack.id + "/attachments";
      const form = new FormData();
      form.append("photo", new File([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,1,2,3,4])], "site.png", { type: "image/png" }));
      const unauthorized = await handleEvidenceRoute(new Request(endpoint + "?token=wrong", { method: "POST", body: form }), db);
      expect(unauthorized?.status).toBe(403);
      const createdPhoto = await handleEvidenceRoute(new Request(endpoint + "?token=" + manage, { method: "POST", body: form }), db);
      expect(createdPhoto?.status).toBe(201);
      const photo = (await createdPhoto!.json()).attachment;
      expect(photo.filename).toBe("site.png");
      const privateReview = await handleEvidenceRoute(new Request(endpoint + "?token=" + approve), db);
      expect(privateReview?.status).toBe(402);
      const list = await handleEvidenceRoute(new Request(endpoint + "?token=" + manage), db);
      expect((await list!.json()).attachments.length).toBe(1);
      const image = await handleEvidenceRoute(new Request(endpoint + "/" + photo.id + "?token=" + manage), db);
      expect(image?.headers.get("content-type")).toBe("image/png");
      const csv = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders/" + pack.id + "/invoice.csv?token=" + manage), db);
      expect(csv?.status).toBe(409);
      const wrongType = new FormData();
      wrongType.append("photo", new File([Buffer.from("definitely not an image")], "danger.svg", { type: "image/svg+xml" }));
      const refused = await handleEvidenceRoute(new Request(endpoint + "?token=" + manage, { method: "POST", body: wrongType }), db);
      expect(refused?.status).toBe(400);
      const view = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders/" + pack.id + "?token=" + manage), db);
      expect((await view!.json()).customerEmail).toBe("review@example.com");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
      for (const [k, v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});
