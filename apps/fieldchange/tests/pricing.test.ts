import { describe, expect, test } from "bun:test";
import { calculateChangeOrder } from "../src/pricing.ts";
describe("change-order pricing", () => {
  test("uses gross margin rather than markup", () => {
    const r = calculateChangeOrder({ labourHours:10, labourRate:100, materials:1000, overheadPct:10, contingencyPct:0, targetMarginPct:25 });
    expect(r.loadedCost).toBe(2200);
    expect(r.recommendedPrice).toBe(2933.33);
    expect(r.achievedMarginPct).toBe(25);
  });
  test("flags a price cap that cannot support the target margin", () => {
    const r = calculateChangeOrder({ labourHours:10, labourRate:100, materials:1000, overheadPct:10, contingencyPct:0, targetMarginPct:25, maxPrice:2500 });
    expect(r.targetAchievable).toBe(false);
    expect(r.achievedMarginAtCapPct).toBe(12);
    expect(r.budgetGap).toBe(433.33);
  });
  test("rejects an invalid margin", () => {
    expect(() => calculateChangeOrder({targetMarginPct:85})).toThrow();
  });
  test("treats a blank cap as no cap", () => {
    expect(calculateChangeOrder({labourHours:1,labourRate:50,maxPrice:""}).maxPrice).toBe(null);
  });
});