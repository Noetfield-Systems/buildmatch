/**
 * Synthetic operator QA — not registered users, leads, prospects, or evidence
 * of product-market fit. Never submit these personas to /api/pilot or the CRM.
 *
 * Five distinct operator workflows exercise the actual quote API. Results
 * drive an engineering work packet, not fake traction or customer feedback.
 */
export type QaPersona = {
  id: string;
  classification: "SYNTHETIC_QA";
  role: string;
  job_to_be_done: string;
  endpoint: "/api/price";
  input: Record<string, unknown>;
  expected_http: 200 | 400;
  expected: Record<string, string | number | boolean | null>;
  severity_if_failed: "HIGH" | "MEDIUM";
};
export const qaPersonas: readonly QaPersona[] = [
  {
    id: "qa-plumbing-field",
    classification: "SYNTHETIC_QA",
    role: "Plumbing field supervisor",
    job_to_be_done: "Price ten hours of extra work without confusing gross margin with markup.",
    endpoint: "/api/price",
    input: { labourHours: 10, labourRate: 100, materials: 1000, overheadPct: 10, contingencyPct: 0, targetMarginPct: 25 },
    expected_http: 200,
    expected: { currency: "CAD", loadedCost: 2200, recommendedPrice: 2933.33, achievedMarginPct: 25 },
    severity_if_failed: "HIGH",
  },
  {
    id: "qa-hvac-foreman",
    classification: "SYNTHETIC_QA",
    role: "HVAC foreman",
    job_to_be_done: "Flag an impossible target gross margin under a fixed customer budget.",
    endpoint: "/api/price",
    input: { labourHours: 10, labourRate: 100, materials: 1000, overheadPct: 10, contingencyPct: 0, targetMarginPct: 25, maxPrice: 2500 },
    expected_http: 200,
    expected: { targetAchievable: false, budgetGap: 433.33, status: "TARGET MARGIN NOT ACHIEVABLE" },
    severity_if_failed: "HIGH",
  },
  {
    id: "qa-electrical-estimator",
    classification: "SYNTHETIC_QA",
    role: "Electrical estimator",
    job_to_be_done: "Prevent malformed quantities from becoming legitimate CAD prices.",
    endpoint: "/api/price",
    input: { labourHours: true, labourRate: 65, materials: 100, targetMarginPct: 30 },
    expected_http: 400,
    expected: { error: "Labour hours must be a non-negative decimal number." },
    severity_if_failed: "HIGH",
  },
  {
    id: "qa-general-contractor",
    classification: "SYNTHETIC_QA",
    role: "General contractor PM",
    job_to_be_done: "Show that a zero price cap cannot sustain paid extra work.",
    endpoint: "/api/price",
    input: { labourHours: 2, labourRate: 75, materials: 50, targetMarginPct: 25, maxPrice: 0 },
    expected_http: 200,
    expected: { targetAchievable: false, maxPrice: 0, achievedMarginAtCapPct: null, budgetGap: 313.6 },
    severity_if_failed: "MEDIUM",
  },
  {
    id: "qa-office-admin",
    classification: "SYNTHETIC_QA",
    role: "Office administrator",
    job_to_be_done: "Handle a blank optional price cap and maintain the correct gross margin.",
    endpoint: "/api/price",
    input: { labourHours: 1, labourRate: 50, materials: 0, targetMarginPct: 30, maxPrice: "" },
    expected_http: 200,
    expected: { currency: "CAD", maxPrice: null, targetAchievable: true, recommendedPrice: 84 },
    severity_if_failed: "MEDIUM",
  },
] as const;
