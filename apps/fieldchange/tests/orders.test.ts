import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHmac } from "node:crypto";
import { initOrders, handleOrderRoute, revenueFromOrders, verifyStripeWebhookSignature } from "../src/orders.ts";

const post = (url: string, data: unknown) => new Request("https://buildworkflow.ca" + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
const sample = {
  project: "North mechanical room", scope: "Additional ductwork requested after final coordination walk.",
  jobNumber: "N-104", customer: "Example GC", requestedBy: "Site superintendent",
  trade: "HVAC", scheduleDays: 2, evidence: ["Site photos / video", "Written direction"],
  pricing: { labourHours: 16, labourRate: 58, materials: 840, equipment: 120, travel: 55, overheadPct: 12, contingencyPct: 5, targetMarginPct: 30 }
};
const signature = (data: unknown, secret = "whsec_for_fieldchange_tests") => {
  const raw = JSON.stringify(data), t = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(t + "." + raw).digest("hex");
  return new Request("https://buildworkflow.ca/api/stripe/webhook", { method: "POST", body: raw, headers: { "stripe-signature": "t=" + t + ",v1=" + digest, "content-type": "application/json" } });
};

describe("paid change order flow", () => {
  test("rejects anonymous approval, rejects unsigned payment, activates only exact paid Stripe link and records one immutable decision", async () => {
    const old = {
      ADMIN_TOKEN: process.env.ADMIN_TOKEN, ORDER_LINK_SECRET: process.env.ORDER_LINK_SECRET,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_PACK_PAYMENT_LINK: process.env.STRIPE_PACK_PAYMENT_LINK,
      STRIPE_PACK_PAYMENT_LINK_ID: process.env.STRIPE_PACK_PAYMENT_LINK_ID
    };
    const db = new Database(":memory:");
    try {
      process.env.ORDER_LINK_SECRET = "fieldchange-test-link-secret-32-chars";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_for_fieldchange_tests";
      process.env.STRIPE_PACK_PAYMENT_LINK = "https://buy.stripe.com/test_fieldchange";
      process.env.STRIPE_PACK_PAYMENT_LINK_ID = "plink_fieldchange_test";
      initOrders(db);
      const created = await handleOrderRoute(post("/api/orders", sample), db);
      expect(created?.status).toBe(201);
      const receipt = await created!.json();
      expect(receipt.checkoutUrl).toContain("client_reference_id=" + receipt.id);
      expect(receipt.approvalUrl).toContain("/order?order=");
      const approval = new URL(receipt.approvalUrl), manage = new URL(receipt.manageUrl);
      const unsigned = await handleOrderRoute(post("/api/orders/" + receipt.id + "/respond?token=" + approval.searchParams.get("token"), { decision: "approved", signedName: "Taylor Builder", acknowledged: true }), db);
      expect(unsigned?.status).toBe(402);
      const unauthorized = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders/" + receipt.id + "?token=wrong"), db);
      expect(unauthorized?.status).toBe(403);
      const forged = await handleOrderRoute(new Request("https://buildworkflow.ca/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=123,v1=" + "0".repeat(64) }, body: "{}" }), db);
      expect(forged?.status).toBe(400);
      const event = { id: "evt_fieldchange001", type: "checkout.session.completed", data: { object: { id: "cs_live_fieldchange", payment_status: "paid", client_reference_id: receipt.id, payment_link: "plink_other", currency: "cad", amount_subtotal: 900, amount_total: 900, payment_intent: "pi_live_fieldchange" } } };
      const wrongLink = await handleOrderRoute(signature(event), db);
      expect(wrongLink?.status).toBe(200);
      expect(revenueFromOrders(db).active_paid_orders).toBe(0);
      event.id = "evt_fieldchange002"; event.data.object.payment_link = "plink_fieldchange_test";
      const paid = await handleOrderRoute(signature(event), db);
      expect(paid?.status).toBe(200);
      expect(revenueFromOrders(db).active_paid_orders).toBe(1);
      const replay = await handleOrderRoute(signature(event), db);
      expect(replay?.status).toBe(200);
      expect(revenueFromOrders(db).active_paid_orders).toBe(1);
      const view = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders/" + receipt.id + "?token=" + manage.searchParams.get("token")), db);
      expect(view?.status).toBe(200);
      const contractor = await view!.json();
      expect(contractor.approvalUrl).toContain(receipt.id);
      expect(contractor.status).toBe("pending");
      expect(contractor.marginPct).toBe(30);
      const recipient = await handleOrderRoute(new Request("https://buildworkflow.ca/api/orders/" + receipt.id + "?token=" + approval.searchParams.get("token")), db);
      const recipientBody = await recipient!.json();
      expect(recipientBody.cost).toBeUndefined();
      expect(recipientBody.marginPct).toBeUndefined();
      const accept = await handleOrderRoute(post("/api/orders/" + receipt.id + "/respond?token=" + approval.searchParams.get("token"), { decision: "approved", signedName: "Taylor Builder", note: "Approved per scope.", acknowledged: true }), db);
      expect(accept?.status).toBe(200);
      expect((await accept!.json()).status).toBe("approved");
      expect(revenueFromOrders(db).approved_orders).toBe(1);
      const doubleSign = await handleOrderRoute(post("/api/orders/" + receipt.id + "/respond?token=" + approval.searchParams.get("token"), { decision: "declined", signedName: "Other Reviewer", acknowledged: true }), db);
      expect(doubleSign?.status).toBe(409);
    } finally {
      db.close();
      for (const [k, v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
  test("rejects price caps that cannot achieve target margin and deficient scopes", async () => {
    const db = new Database(":memory:");
    initOrders(db);
    const invalid = await handleOrderRoute(post("/api/orders", { ...sample, scope: "short" }), db);
    expect(invalid?.status).toBe(400);
    const cap = await handleOrderRoute(post("/api/orders", { ...sample, pricing: { ...sample.pricing, maxPrice: 1000 } }), db);
    expect(cap?.status).toBe(400);
    db.close();
  });
  test("rejects expired Stripe signatures", () => {
    const t = Math.floor(Date.now() / 1000) - 900;
    const raw = JSON.stringify({ id: "evt_old" });
    const v1 = createHmac("sha256", "secret").update(t + "." + raw).digest("hex");
    expect(verifyStripeWebhookSignature(raw, "t=" + t + ",v1=" + v1, "secret")).toBe(false);
  });
});
