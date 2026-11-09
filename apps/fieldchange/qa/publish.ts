/** Idempotent Company OS handoff of live-HTTP synthetic QA failures to GitHub issues.
 * This is a reviewable engineering work queue, never a customer database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const repository = Bun.env.GITHUB_REPOSITORY || "";
if (Bun.env.QA_ISSUE_WRITE_ENABLED !== "true") {
  console.log("QA_COMPANY_HANDOFF " + JSON.stringify({state:"DISABLED",issue_write:false}));
  process.exit(0);
}
const token=Bun.env.GITHUB_TOKEN||"";
if (repository!=="Noetfield-Systems/buildmatch" ||
    !["schedule","workflow_dispatch"].includes(Bun.env.GITHUB_EVENT_NAME||"") ||
    Bun.env.GITHUB_REF!=="refs/heads/main" || token.length<20)
  throw new Error("QA_COMPANY_HANDOFF_REF_OR_IDENTITY_DENIED");
const report=JSON.parse(readFileSync(resolve(Bun.env.QA_REPORT_FILE||"qa-out/latest.json"),"utf8"));
if (report.schema!=="noetfield.company.fieldchange.qa-feedback.v1" ||
    report.classification!=="SYNTHETIC_QA_NOT_CUSTOMERS" ||
    report.source!=="read_only_live_price_api" ||
    report.product_id!=="noetfield.buildworkflow.fieldchange" ||
    !Array.isArray(report.company_workpacket_candidates) ||
    report.company_workpacket_candidates.length>5 ||
    report.execution?.customer_records_created!==0 ||
    report.execution?.outbound_messages_sent!==0 ||
    report.execution?.production_mutations!==0)
  throw new Error("QA_COMPANY_HANDOFF_UNTRUSTED_EVIDENCE");
const endpoint="https://api.github.com/repos/Noetfield-Systems/buildmatch";
const headers={
  Authorization:"Bearer "+token,
  Accept:"application/vnd.github+json",
  "X-GitHub-Api-Version":"2022-11-28",
  "Content-Type":"application/json"
};
const listing=await fetch(endpoint+"/issues?state=open&per_page=100",{headers,signal:AbortSignal.timeout(12000)});
if(!listing.ok)throw new Error("QA_COMPANY_HANDOFF_ISSUE_LIST_FAILED:"+listing.status);
const open=await listing.json() as Array<{title:string}>;
let created=0,deduplicated=0;
for(const candidate of report.company_workpacket_candidates){
  const id=String(candidate.workpacket_id||"");
  if(!/^bw-qa-[0-9a-f]{16}$/.test(id) ||
     candidate.status!=="CANDIDATE_NOT_EXECUTED" ||
     candidate.external_customer_contact!==false ||
     candidate.production_deployment_authorized!==false)
    throw new Error("QA_COMPANY_HANDOFF_INVALID_WORKPACKET");
  const marker="[BW-QA:"+id+"]";
  if(open.some(issue=>issue.title.includes(marker))){deduplicated++;continue;}
  const title=marker+" "+String(candidate.objective||"FieldChange quality regression").slice(0,85);
  const body="# Live product quality finding\n\n"+
    "Classification: synthetic QA testing against actual FieldChange API, NOT a buyer report.\n"+
    "Owner: BuildWorkflow Product Engineering / Company OS.\n"+
    "Status: evidence-backed work candidate, NOT an authorized production fix.\n"+
    "Evidence SHA256: "+String(report.measured_evidence_sha256||"").slice(0,64)+"\n"+
    "Workflow: https://github.com/Noetfield-Systems/buildmatch/actions/runs/"+Bun.env.GITHUB_RUN_ID+"\n"+
    "Product: "+report.source_url+"\n\n"+
    "Reproduction evidence:\n"+JSON.stringify(candidate.evidence,null,2).slice(0,6000)+"\n\n"+
    "Acceptance: reproduce, make a bounded PR, rerun five QA personas, independently verify and obtain Founder approval before production. Never create synthetic pilot leads or send customers automated messages.\n";
  const response=await fetch(endpoint+"/issues",{method:"POST",headers,body:JSON.stringify({title,body}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("QA_COMPANY_HANDOFF_ISSUE_CREATE_FAILED:"+response.status);
  const issue=await response.json() as {number:number};
  open.push({title});created++;
  console.log("QA_COMPANY_HANDOFF_ISSUE "+JSON.stringify({number:issue.number,id,created:true}));
}
console.log("QA_COMPANY_HANDOFF "+JSON.stringify({source:"live_read_only",created,deduplicated,synthetic_as_customers:false}));
