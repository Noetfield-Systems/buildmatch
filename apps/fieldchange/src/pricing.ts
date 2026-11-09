export type PricingInput = {
  labourHours?: unknown; labourRate?: unknown; materials?: unknown; equipment?: unknown;
  subcontractors?: unknown; travel?: unknown; overheadPct?: unknown; contingencyPct?: unknown;
  targetMarginPct?: unknown; maxPrice?: unknown;
};
function number(value: unknown, name: string, fallback = 0, max = 10_000_000): number {
  if (value === undefined || value === null || value === "") return fallback;
  // Never silently coerce boolean, arrays or objects into a customer-facing CAD quote.
  // HTML number inputs produce decimal strings, which are explicitly supported.
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(name + " must be a non-negative decimal number.");
  }
  if (typeof value === "string" && !/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(value.trim())) {
    throw new Error(name + " must be a non-negative decimal number.");
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(name + " must be between 0 and " + max + ".");
  return n;
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calculateChangeOrder(input: PricingInput) {
  const hours = number(input.labourHours, "Labour hours", 0, 100_000);
  const rate = number(input.labourRate, "Loaded labour rate", 0, 2_000);
  const materials = number(input.materials, "Materials");
  const equipment = number(input.equipment, "Equipment");
  const subs = number(input.subcontractors, "Subcontractors");
  const travel = number(input.travel, "Travel and disposal");
  const overheadPct = number(input.overheadPct, "Overhead", 12, 100);
  const contingencyPct = number(input.contingencyPct, "Contingency", 5, 100);
  const targetMarginPct = number(input.targetMarginPct, "Target margin", 30, 75);
  const maxPrice = input.maxPrice === undefined || input.maxPrice === null || input.maxPrice === ""
    ? null : number(input.maxPrice, "Maximum price");
  if (targetMarginPct >= 80) throw new Error("Target gross margin must be below 80%.");
  const labourCost = hours * rate;
  const directCost = labourCost + materials + equipment + subs + travel;
  const overhead = directCost * overheadPct / 100;
  const contingency = (directCost + overhead) * contingencyPct / 100;
  const loadedCost = directCost + overhead + contingency;
  const recommendedPrice = loadedCost === 0 ? 0 : loadedCost / (1 - targetMarginPct / 100);
  const grossProfit = recommendedPrice - loadedCost;
  const achievable = maxPrice === null || recommendedPrice <= maxPrice + 0.01;
  return {
    currency: "CAD", labourCost: round(labourCost), directCost: round(directCost),
    overhead: round(overhead), contingency: round(contingency), loadedCost: round(loadedCost),
    recommendedPrice: round(recommendedPrice), grossProfit: round(grossProfit),
    targetMarginPct: round(targetMarginPct),
    achievedMarginPct: round(loadedCost === 0 ? 0 : grossProfit / (recommendedPrice || 1) * 100),
    maxPrice: maxPrice === null ? null : round(maxPrice),
    achievedMarginAtCapPct: maxPrice === null || maxPrice === 0 ? null : round((maxPrice - loadedCost) / maxPrice * 100),
    budgetGap: maxPrice === null ? null : round(Math.max(0, recommendedPrice - maxPrice)),
    targetAchievable: achievable,
    status: achievable ? "TARGET MARGIN ACHIEVABLE" : "TARGET MARGIN NOT ACHIEVABLE"
  };
}