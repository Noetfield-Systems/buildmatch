/** Read-only FieldChange Monitor+Tester+Growth→Company OS projection.
 * Run AFTER existing qa/run.ts. Never reads admin/pilot PII or sends any CRM writes.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compileCycle, PROD_URL, type Check } from "./decision.ts";

const specs=[
  {id:"health",path:"/api/health",expected:200},
  {id:"privacy",path:"/privacy",expected:200},
  {id:"homepage",path:"/",expected:200},
  {id:"admin-denial",path:"/api/admin/leads",expected:401},
  {id:"revenue-denial",path:"/api/integrations/sina/revenue-summary",expected:401},
] as const;
const base=Bun.env.COMPANY_OS_TARGET_URL||PROD_URL;
if (base!==PROD_URL) throw Error("COMPANY_OS_PRODUCTION_ORIGIN_NOT_ALLOWED");
const qaFile=resolve(Bun.env.QA_REPORT_FILE||"qa-out/latest.json");
const output=resolve(Bun.env.COMPANY_OS_REPORT_FILE||"ops-out/latest.json");
const checks:Check[]=[];
for (const spec of specs) {
  const start=performance.now();
  try {
    const res=await fetch(base+spec.path,{
      method:"GET",redirect:"error",
      headers:{"accept":spec.id==="health"?"application/json":"text/html,application/json"},
      signal:AbortSignal.timeout(8000),
    });
    const elapsed=Math.round(performance.now()-start);
    let ok=res.status===spec.expected;
    if(spec.id==="health"&&ok){
      const body=await res.json() as Record<string,unknown>;
      ok=body.ok===true&&body.app==="fieldchange-desk"&&body.storage==="connected";
    }
    // Strictly discard all response bodies on non-health probes. In particular,
    // do not read or persist customer/admin/pilot information in CI artifacts.
    checks.push({id:spec.id,status:res.status,latency_ms:elapsed,passed:ok});
  } catch(err) {
    checks.push({id:spec.id,status:null,latency_ms:Math.min(30000,Math.round(performance.now()-start)),passed:false,
      error:err instanceof Error?err.name:"UNKNOWN_NETWORK_FAILURE"});
  }
}
const qa=JSON.parse(readFileSync(qaFile,"utf8"));
const report=compileCycle(qa,checks);
const evidenceHash=createHash("sha256").update(JSON.stringify(report)).digest("hex");
mkdirSync(dirname(output),{recursive:true});
await Bun.write(output,JSON.stringify({...report,evidence_sha256:evidenceHash},null,2)+"\n");
console.log("BUILDWORKFLOW_COMPANY_OS "+JSON.stringify({
  schema:report.schema,product:report.product_id,monitor:report.roles.monitor.state,
  tester:report.roles.tester.state,growth:report.roles.growth.state,
  highest_priority:report.company_os.highest_priority_candidate_id,
  qa_passed:report.roles.tester.passed,qa_failed:report.roles.tester.failed,
  probes_passed:checks.filter(x=>x.passed).length,
  evidence_sha256:evidenceHash,dispatch:false,
}));
