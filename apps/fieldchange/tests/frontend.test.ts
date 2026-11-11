import { describe, test, expect } from "bun:test";

const pages = ["calculator.html", "order.html", "workspace.html", "index.html"];
describe("FieldChange customer-facing release", () => {
  for(const page of pages){
    test(page + " inline JavaScript compiles", async () => {
      const html = await Bun.file("public/" + page).text();
      const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
      for(const [, source] of scripts){
        if(!source.trim())continue;
        const transpiler = new Bun.Transpiler({ loader: "js", target: "browser" });
        expect(transpiler.transformSync(source).length).toBeGreaterThan(0);
      }
    });
  }
  test("guided workflow includes all steps, upload, progress, and payment context", async () => {
    const html = await Bun.file("public/calculator.html").text();
    expect((html.match(/class="wizardStep/g)||[]).length).toBe(4);
    expect(html).toContain('id="sitePhotos"');
    expect(html).toContain('id="reviewSummary"');
    expect(html).toContain("Create approval-ready pack");
  });
  test("customer pack exposes secure evidence and approved invoice export", async () => {
    const html = await Bun.file("public/order.html").text();
    expect(html).toContain('id="evidenceGrid"');
    expect(html).toContain('id="invoiceHandoff"');
    expect(html).toContain('id="eventHistory"');
  });
});
