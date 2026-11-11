import { describe, expect, test } from "bun:test";
import { canonicalRedirect } from "../src/canonical.ts";

describe("canonical domain routing", () => {
  test("www GET redirects to apex, preserving path and query", () => {
    expect(canonicalRedirect("GET", "www.buildworkflow.ca", "https://www.buildworkflow.ca/calculator?from=trade"))
      .toBe("https://buildworkflow.ca/calculator?from=trade");
  });
  test("www HEAD redirects to apex", () => {
    expect(canonicalRedirect("HEAD", "www.buildworkflow.ca:443", "https://www.buildworkflow.ca/"))
      .toBe("https://buildworkflow.ca/");
  });
  test("Railway hostname and apex remain reachable", () => {
    expect(canonicalRedirect("GET", "fieldchange-desk-production.up.railway.app", "https://fieldchange-desk-production.up.railway.app/")).toBeNull();
    expect(canonicalRedirect("GET", "buildworkflow.ca", "https://buildworkflow.ca/")).toBeNull();
  });
  test("non-GET, including signed payment webhooks, are never redirected", () => {
    expect(canonicalRedirect("POST", "www.buildworkflow.ca", "https://www.buildworkflow.ca/api/stripe/webhook")).toBeNull();
    expect(canonicalRedirect("POST", "www.buildworkflow.ca", "https://www.buildworkflow.ca/api/orders")).toBeNull();
  });
  test("untrusted hosts do not generate redirects", () => {
    expect(canonicalRedirect("GET", "www.buildworkflow.ca.attacker.test", "https://evil.example/")).toBeNull();
    expect(canonicalRedirect("GET", null, "https://www.buildworkflow.ca/")).toBeNull();
  });
});
