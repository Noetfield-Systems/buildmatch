import { describe, expect, test } from "bun:test";
import { checkQa, compileCycle, PRODUCT, PROD_URL, type Check } from "./decision.ts";
const clock=new Date("2026-11-09T13:00:00.000Z");
function qa(overrides:Record<string,unknown>={}){
  return {
    schema:"noetfield.company.fieldchange.qa-feedback.v1",
    classification:"SYNTHETIC_QA_NOT_CUSTOMERS",source:"read_only_live_price_api",
    source_url:PROD_URL,product_id:PRODUCT,created_at:"2026-11-09T12:55:00Z",
    personas:5,passed:5,failed:0,blocked:0,
    measured_evidence_sha256:"a".repeat(64),company_workpacket_candidates:[],
    execution:{customer_records_created:0,outbound_messages_sent:0,production_mutations:0},
    ...overrides,
  };
}
const healthy:Check[]=[
 {id:"health",status:200,passed:true,latency_ms:30},
 {id:"privacy",status:200,passed:true,latency_ms:40},
 {id:"homepage",status:200,passed:true,latency_ms:50},
 {id:"admin-denial",status:401,passed:true,latency_ms:20},
 {id:"revenue-denial",status:401,passed:true,latency_ms:28},
];
describe("continuous BuildWorkflow Company OS — evidence and authority boundaries",()=>{
  test("4 real roles from checked evidence, without authorizing code or customer writes",()=>{
    const report=compileCycle(qa(),healthy,clock);
    expect(report.schema).toBe("buildworkflow.fieldchange.company-ops.v1");
    expect(Object.keys(report.roles).sort()).toEqual(["developer","growth","monitor","tester"]);
    expect(report.roles.tester.passed).toBe(5);
    expect(report.roles.growth.real_users).toBe("NOT_MEASURED");
    expect(report.roles.growth.synthetic_personas_count_as_customers).toBe(false);
    expect(report.company_os.highest_priority_candidate_id).toBe("tester-next-journey");
    expect(report.company_os.proposed_actions.every(a=>a.authority==="CANDIDATE_NOT_EXECUTED"&&!a.external_effects_authorized)).toBe(true);
    expect(report.company_os.workpackets_issued).toBe(0);
    expect(report.company_os.github_code_writes).toBe(0);
    expect(report.company_os.customer_contact_performed).toBe(false);
  });
  test("bad health or auth bypass immediately outranks QA and growth",()=>{
    const checks=healthy.map(c=>({...c}));
    checks[3].status=200;checks[3].passed=false;
    const report=compileCycle(qa(),checks,clock);
    expect(report.company_os.highest_priority_candidate_id).toBe("monitor-health-security");
    expect(report.roles.monitor.state).toBe("DEGRADED");
    expect(report.roles.monitor.failed).toContain("admin-denial");
    expect(report.company_os.deployment_authorized).toBe(false);
  });
  test("real 5-persona regression creates distinct Engineering issue candidate",()=>{
    const report=compileCycle(qa({passed:4,failed:1,company_workpacket_candidates:[{id:"bounded"}]}),healthy,clock);
    expect(report.roles.developer.state).toBe("REPRODUCTION_REQUIRED");
    expect(report.company_os.highest_priority_candidate_id).toBe("developer-pricing-regression");
    expect(report.company_os.proposed_actions.find(x=>x.role==="developer")?.evidence_ref).toBe("a".repeat(64));
  });
  test("synthetic records cannot become real buyers or revenue",()=>{
    for(const q of [
      qa({classification:"REAL_CUSTOMERS"}),qa({source:"invented"}),
      qa({execution:{customer_records_created:1,outbound_messages_sent:0,production_mutations:0}}),
      qa({passed:5,failed:2}),qa({created_at:"2025-01-01T00:00:00Z"}),
      qa({measured_evidence_sha256:"not-a-hash"}),qa({source_url:"https://evil.example"}),
    ])expect(()=>checkQa(q,clock)).toThrow();
  });
  test("missing or duplicate production probes rejected",()=>{
    expect(()=>compileCycle(qa(),healthy.slice(0,4),clock)).toThrow("MONITOR_EVIDENCE_INVALID");
    expect(()=>compileCycle(qa(),[...healthy.slice(0,4),healthy[0]],clock)).toThrow("MONITOR_EVIDENCE_INVALID");
  });
});
