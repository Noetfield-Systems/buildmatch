import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { handleSalesRoute, initSales } from "./sales.ts";

const admin = "buildworkflow-admin-test-secret-32-chars";
const data = {
 company:"Fixture Test Mechanical Ltd.", contact:"Test Contact", email:"test@example.invalid",
 trade:"Mechanical", project:"Test job 003", scope:"Extra duct offset directed after field clash, not in base scope.",
 pain:"missing_evidence", buyer:"GC project manager",
 evidence:"Field photo and site instruction are available for review.",
 next_action:"Request GC written direction", owner:"Test operator",
 consent:true,
 calculator:{pricing:{labourHours:8,labourRate:65,materials:220,overheadPct:10,contingencyPct:5,targetMarginPct:30}}
};
const call = (db:Database,path:string,method="GET",payload?:unknown,auth=false) => {
 const req=new Request("https://buildworkflow.ca"+path,{method,headers:{"origin":"https://buildworkflow.ca",...(auth?{"authorization":"Bearer "+admin}:{}),...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined});
 return handleSalesRoute(req,db,admin) as Promise<Response>;
};

test("public assessment atomically saves receipt and follow-up; private link permits edits",async()=>{
 const db=new Database(":memory:");initSales(db);
 const denied=await call(db,"/api/assessments","POST",{...data,consent:false});
 expect(denied.status).toBe(422);
 const result=await call(db,"/api/assessments","POST",data);
 expect(result.status).toBe(201);
 const created=await result.json();
 expect(created.crm_receipt.product_id).toBe("buildworkflow.fieldchange");
 expect(created.follow_up.status).toBe("open");
 const checks=db.query("SELECT r.id AS receipt,t.id AS task FROM bw_sales_receipts r JOIN bw_sales_tasks t ON t.assessment_id=r.assessment_id WHERE r.assessment_id=?").get(created.id) as any;
 expect(checks.receipt).toBe(created.crm_receipt.id);
 expect(checks.task).toBe(created.follow_up.id);
 const privateUrl=created.manage_url.replace("/assessment?ref=","/api/assessments/").replace("&token=","?token=");
 const view=await call(db,privateUrl);
 expect(view.status).toBe(200);
 expect((await view.json()).assessment.company).toBe(data.company);
 expect((await call(db,"/api/assessments/"+created.id+"?token=invalid")).status).toBe(404);
 const edited=await call(db,privateUrl,"PATCH",{objections:"GC requires purchase order reference before acceptance."});
 expect(edited.status).toBe(200);
 expect((await edited.json()).assessment.objections).toContain("purchase order");
 db.close();
});

test("operator pipeline remains locked for outbound, tracks real-evidence statuses only",async()=>{
 const db=new Database(":memory:");initSales(db);
 const noAuth=await call(db,"/api/ops/overview");
 expect(noAuth.status).toBe(401);
 const initial=await (await call(db,"/api/ops/overview","GET",undefined,true)).json();
 expect(initial.metrics.verified_interviews).toBe(0);
 expect(initial.readiness.outreach_allowed).toBe(false);
 const target=await (await call(db,"/api/ops/targets","POST",{company:"Research Fixture Electric",trade:"Electrical",status:"research",owner:"Founder",pain:"Written approval delay"},true)).json();
 expect(target.id).toBeTruthy();
 const premature=await call(db,"/api/ops/targets/"+target.id,"PATCH",{status:"contacted"},true);
 expect(premature.status).toBe(409);
 const badProof=await call(db,"/api/ops/interviews","POST",{target_id:target.id,status:"completed",verified:true,evidence:"",reference:""},true);
 expect(badProof.status).toBe(422);
 const interview=await call(db,"/api/ops/interviews","POST",{target_id:target.id,status:"completed",verified:true,evidence:"This is an in-memory test with a test evidence note.",reference:"test-fixture-not-real",conducted_at:"2026-11-11"},true);
 expect(interview.status).toBe(201);
 const overview=await (await call(db,"/api/ops/overview","GET",undefined,true)).json();
 expect(overview.metrics.verified_interviews).toBe(1);
 expect(overview.metrics.first_five_interviews_remaining).toBe(4);
 db.close();
});