/**
 * Bounded Company OS QA feedback slice. Real product HTTP, synthetic personas.
 * No pilot/CRM writes; optional AI critique is advisory, never acceptance proof.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { qaPersonas, type QaPersona } from "./personas.ts";

const local = !Bun.env.QA_TARGET_URL;
const url = (Bun.env.QA_TARGET_URL || "").replace(/\/+$/, "");
const workspace = resolve(import.meta.dir, "..");
const scratch = local ? mkdtempSync(join(tmpdir(), "bw-loop-")) : "";
const port = 22000 + Math.floor(Math.random() * 15000);
const base = local ? "http://127.0.0.1:" + port : url;
const reportFile = resolve(Bun.env.QA_REPORT_FILE || join(workspace, "qa-out", "latest.json"));
const sha = (input: string) => createHash("sha256").update(input).digest("hex");
let worker: ReturnType<typeof Bun.spawn> | undefined;
type Result = {
  persona_id: string; classification: "SYNTHETIC_QA"; role: string;
  severity_if_failed: "HIGH" | "MEDIUM"; verdict: "PASS" | "FAIL" | "BLOCKED";
  expected_http: number; actual_http: number | null;
  mismatches: { field: string; expected: unknown; actual: unknown }[];
  observed: Record<string, unknown>;
};
type AiReview = {
  persona_id: string; state: "ADVISORY" | "UNAVAILABLE" | "FAILED";
  model?: string; tokens_in?: number; tokens_out?: number;
  advice?: Record<string, unknown>;
};
async function launchLocal() {
  if (!local) return;
  worker = Bun.spawn(["bun", "run", "server.ts"], {
    cwd: workspace, env: { ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(scratch, "isolated-qa.sqlite"),
      ADMIN_TOKEN: "synthetic-qa-isolated-only",
      SINA_FOUNDER_OS_REVENUE_READ_TOKEN: "synthetic-qa-local-revenue-token-long-enough",
    }, stdout: "ignore", stderr: "pipe",
  });
  for (let t = 0; t < 70; t++) {
    try { if ((await fetch(base + "/api/health")).ok) return; } catch {}
    await Bun.sleep(100);
  }
  throw new Error("Local FieldChange QA server did not become healthy");
}
async function evaluate(persona: QaPersona): Promise<Result> {
  const result: Result = {
    persona_id: persona.id, classification: "SYNTHETIC_QA", role: persona.role,
    severity_if_failed: persona.severity_if_failed, verdict: "BLOCKED",
    expected_http: persona.expected_http, actual_http: null, mismatches: [], observed: {},
  };
  try {
    const res = await fetch(base + persona.endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persona.input), signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as Record<string, unknown>;
    result.actual_http = res.status;
    result.observed = Object.fromEntries(
      Object.keys(persona.expected).map(field => [field, data[field] === undefined ? null : data[field]])
    );
    if (res.status !== persona.expected_http) {
      result.mismatches.push({ field: "HTTP_STATUS", expected: persona.expected_http, actual: res.status });
    }
    for (const [field, expected] of Object.entries(persona.expected)) {
      if (data[field] !== expected) result.mismatches.push({ field, expected, actual: data[field] ?? null });
    }
    result.verdict = result.mismatches.length ? "FAIL" : "PASS";
  } catch (err) {
    result.mismatches.push({ field: "REQUEST", expected: "HTTP response", actual: err instanceof Error ? err.name : "unknown" });
  }
  return result;
}
async function modelReview(persona: QaPersona, observed: Result): Promise<AiReview> {
  if (Bun.env.QA_AI_REVIEW !== "true") return { persona_id: persona.id, state: "UNAVAILABLE" };
  const key = Bun.env.DEEPSEEK_API_KEY || "";
  if (!key) return { persona_id: persona.id, state: "UNAVAILABLE" };
  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(35000),
      body: JSON.stringify({
        model: "deepseek-flash", temperature: 0, max_tokens: 240,
        response_format: { type: "json_object" }, thinking: { type: "disabled" },
        messages: [
          { role: "system", content: "You are one synthetic QA persona testing a construction quote workflow. Review only measured HTTP evidence. Answer strict JSON {finding, severity, actionable_recommendation, uncertainty}. Never invent a buyer, user session, sale, permission or completed fix. Advisory only." },
          { role: "user", content: JSON.stringify({ persona_role: persona.role, job_to_be_done: persona.job_to_be_done, expected: persona.expected, observation: observed }) },
        ],
      }),
    });
    if (!resp.ok) return { persona_id: persona.id, state: "FAILED" };
    const payload = await resp.json() as any;
    const advice = JSON.parse(String(payload.choices?.[0]?.message?.content || "{}"));
    if (!advice || typeof advice !== "object" || Array.isArray(advice))
      return { persona_id: persona.id, state: "FAILED" };
    return {
      persona_id: persona.id, state: "ADVISORY", model: String(payload.model || "deepseek-flash"),
      tokens_in: payload.usage?.prompt_tokens, tokens_out: payload.usage?.completion_tokens,
      advice: Object.fromEntries(["finding", "severity", "actionable_recommendation", "uncertainty"]
        .map(k => [k, String(advice[k] || "").slice(0, 420)])),
    };
  } catch { return { persona_id: persona.id, state: "FAILED" }; }
}
try {
  await launchLocal();
  const health = await fetch(base + "/api/health", { signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error("PRODUCT_HEALTH_FAILED:" + health.status);
  const checked: Result[] = [];
  const aiReviews: AiReview[] = [];
  for (const persona of qaPersonas) {
    const result = await evaluate(persona);
    checked.push(result);
    aiReviews.push(await modelReview(persona, result));
  }
  const work = checked.filter(r => r.verdict !== "PASS").map(r => ({
    schema: "noetfield.company.workpacket.candidate.v1",
    workpacket_id: "bw-qa-" + sha(r.persona_id + "|" + JSON.stringify(r.mismatches)).slice(0, 16),
    source: "synthetic_fieldchange_qa",
    product_id: "noetfield.buildworkflow.fieldchange",
    tenant_id: "tenant-buildworkflow",
    owner_domain: "Company OS / Product Engineering",
    requested_action: "REPAIR_AND_RERUN_REPRODUCTION",
    status: "CANDIDATE_NOT_EXECUTED",
    severity: r.severity_if_failed,
    objective: "Fix " + r.persona_id + " regression in FieldChange pricing API",
    evidence: { persona_id: r.persona_id, expected_http: r.expected_http, actual_http: r.actual_http, mismatches: r.mismatches },
    acceptance: "Reproduce the same QA scenario and pass isolated Bun tests before any promotion",
    external_customer_contact: false,
    production_deployment_authorized: false,
  }));
  const report = {
    schema: "noetfield.company.fieldchange.qa-feedback.v1",
    source: local ? "isolated_local_fieldchange_http" : "read_only_live_price_api",
    source_url: local ? "isolated-local" : base,
    classification: "SYNTHETIC_QA_NOT_CUSTOMERS",
    created_at: new Date().toISOString(),
    product_id: "noetfield.buildworkflow.fieldchange",
    personas: qaPersonas.length,
    passed: checked.filter(x => x.verdict === "PASS").length,
    failed: checked.filter(x => x.verdict === "FAIL").length,
    blocked: checked.filter(x => x.verdict === "BLOCKED").length,
    measured_results: checked,
    ai_reviews: aiReviews,
    company_workpacket_candidates: work,
    commercial: { real_buyer_evidence_included: false, qualified_leads: "NOT_MEASURED_BY_QA", revenue: "NOT_MEASURED_BY_QA" },
    execution: { customer_records_created: 0, outbound_messages_sent: 0, production_mutations: 0 },
  };
  const digest = sha(JSON.stringify(report.measured_results));
  mkdirSync(dirname(reportFile), { recursive: true });
  await Bun.write(reportFile, JSON.stringify({ ...report, measured_evidence_sha256: digest }, null, 2) + "\n");
  console.log("FIELDCHANGE_QA_RESULT " + JSON.stringify({
    product: report.product_id, personas: report.personas, passed: report.passed,
    failed: report.failed, blocked: report.blocked, workpackets: work.length,
    model_reviews: aiReviews.filter(x => x.state === "ADVISORY").length,
    evidence_sha256: digest, qa_report: reportFile, synthetic_not_customers: true,
  }));
  if (report.failed || report.blocked) process.exitCode = 1;
} finally {
  worker?.kill();
  if (worker) await worker.exited;
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
