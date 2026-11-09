/**
 * FieldChange Company OS: deterministic, evidence-grounded 4-role work cycle.
 * Reuses existing native five-persona QA and GitHub Issue handoff.
 * This module is NOT an LLM, an authorization issuer, a second queue or proof of customers.
 */
export const PRODUCT = "noetfield.buildworkflow.fieldchange";
export const PROD_URL = "https://fieldchange-desk-production.up.railway.app";
export const SCHEMA = "buildworkflow.fieldchange.company-ops.v1";
export type Check = { id: "health"|"privacy"|"homepage"|"admin-denial"|"revenue-denial"; status: number|null; passed: boolean; latency_ms: number; error?: string };
export type QaSummary = {
  schema: string; classification: string; source: string; source_url: string;
  product_id: string; created_at: string; personas: number; passed: number; failed: number; blocked: number;
  measured_evidence_sha256: string; company_workpacket_candidates: unknown[];
  execution: { customer_records_created: number; outbound_messages_sent: number; production_mutations: number };
};
export type Role = "developer"|"tester"|"monitor"|"growth";
export type Action = {
  id: string; role: Role; priority: "P0"|"P1"|"P2";
  objective: string; evidence_ref: string;
  authority: "CANDIDATE_NOT_EXECUTED"; external_effects_authorized: false;
};
const hex64=/^[0-9a-f]{64}$/;
export function checkQa(x: unknown, clock: Date): asserts x is QaSummary {
  if (!x || typeof x!=="object" || Array.isArray(x)) throw Error("QA_EVIDENCE_MISSING");
  const q=x as Partial<QaSummary>;
  if (q.schema!=="noetfield.company.fieldchange.qa-feedback.v1" ||
      q.classification!=="SYNTHETIC_QA_NOT_CUSTOMERS" ||
      q.product_id!==PRODUCT || q.source!=="read_only_live_price_api" ||
      q.source_url!==PROD_URL || q.personas!==5 ||
      !Number.isInteger(q.passed) || !Number.isInteger(q.failed) || !Number.isInteger(q.blocked) ||
      (q.passed!+q.failed!+q.blocked!)!==5 ||
      !hex64.test(q.measured_evidence_sha256||"") ||
      !Array.isArray(q.company_workpacket_candidates) || q.company_workpacket_candidates.length>5 ||
      !q.execution || q.execution.customer_records_created!==0 ||
      q.execution.outbound_messages_sent!==0 || q.execution.production_mutations!==0)
    throw Error("QA_PROVENANCE_OR_COUNTERS_INVALID");
  const t=Date.parse(q.created_at||"");
  if (!Number.isFinite(t) || Math.abs(clock.getTime()-t)>24*60*60*1000)
    throw Error("QA_EVIDENCE_EXPIRED");
}
export function compileCycle(qa: unknown, checks: Check[], clock = new Date()) {
  checkQa(qa,clock);
  if (checks.length!==5 || new Set(checks.map(c=>c.id)).size!==5 ||
      checks.some(c=>!["health","privacy","homepage","admin-denial","revenue-denial"].includes(c.id) ||
        typeof c.passed!=="boolean" || (c.status!==null&&(!Number.isInteger(c.status)||c.status<100||c.status>599)) ||
        !Number.isFinite(c.latency_ms) || c.latency_ms<0 || c.latency_ms>30_000)) {
    throw Error("MONITOR_EVIDENCE_INVALID");
  }
  const failed=checks.filter(c=>!c.passed);
  const actions:Action[]=[];
  const add=(role:Role,priority:"P0"|"P1"|"P2",objective:string,evidence_ref:string,id:string)=>{
    actions.push({id,role,priority,objective,evidence_ref,authority:"CANDIDATE_NOT_EXECUTED",external_effects_authorized:false});
  };
  if(failed.length) add("monitor","P0","Restore or diagnose failed FieldChange read-only live HTTP/security probes",
     failed.map(c=>c.id).join(","),"monitor-health-security");
  if(qa.failed||qa.blocked)
    add("developer","P1","Reproduce and repair actual five-persona pricing regressions in a bounded PR; rerun tests before release",
      qa.measured_evidence_sha256,"developer-pricing-regression");
  if(!failed.length && qa.failed===0 && qa.blocked===0)
    add("tester","P2","Extend one distinct end-to-end pricing workflow and verify regression coverage",
      qa.measured_evidence_sha256,"tester-next-journey");
  add("growth","P2",
      "Instrument consent-respecting anonymous activation and return visits; prioritize real activation evidence, not synthetic QA or lead counts",
      "activation_and_retention_NOT_INSTRUMENTED","growth-activation-gap");
  const highest=actions.find(a=>a.priority==="P0")||actions.find(a=>a.priority==="P1")||actions[0];
  return {
    schema:SCHEMA, generated_at:clock.toISOString(), product_id:PRODUCT, source_url:PROD_URL,
    classification:"SYNTHETIC_QA_PLUS_READ_ONLY_LIVE_OBSERVATIONS_NOT_CUSTOMERS",
    roles:{
      developer:{state:qa.failed||qa.blocked?"REPRODUCTION_REQUIRED":"OBSERVING",repair_executed:false},
      tester:{state:qa.failed||qa.blocked?"REGRESSION_DETECTED":"PASS",personas:5,passed:qa.passed,failed:qa.failed,blocked:qa.blocked,evidence_sha256:qa.measured_evidence_sha256},
      monitor:{state:failed.length?"DEGRADED":"PASS",read_only_checks:checks,failed:failed.map(c=>c.id)},
      growth:{state:"INSTRUMENTATION_GAP",real_users:"NOT_MEASURED",activation_rate:"NOT_INSTRUMENTED",retention:"NOT_INSTRUMENTED",collected_revenue:"NOT_TRACKED",synthetic_personas_count_as_customers:false},
    },
    company_os:{
      proposed_actions:actions,
      highest_priority_candidate_id:highest?.id||null,
      permitted_to_dispatch:false,
      workpackets_issued:0,
      github_code_writes:0,
      deployment_authorized:false,
      customer_contact_performed:false,
      founder_os_ingestion_verified:false,
    },
    evidence:{qa_sha256:qa.measured_evidence_sha256,checks_count:5,read_only:true},
  };
}
