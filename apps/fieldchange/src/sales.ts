import { Database } from "bun:sqlite";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { calculateChangeOrder } from "./pricing.ts";

/** Dedicated BuildWorkflow commercial records; no RWA, other product, or cross-tenant writes. */
const PRODUCT = "buildworkflow.fieldchange";
const trades = new Set(["HVAC", "Plumbing", "Mechanical", "Electrical"]);
const stages = new Set(["research", "qualified", "outreach_ready", "contacted", "interview_booked", "interview_done", "pilot", "won", "lost"]);
const painKeys = new Set(["extra_work_capture", "missing_evidence", "approval_delay", "invoice_handoff", "margin_leakage", "other"]);
const limits = new Map<string, number[]>();
type Data = Record<string, any>;
const clean = (x: unknown, n=500) => String(x ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0,n);
const hash = (x:string) => createHash("sha256").update(x).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const now = () => new Date().toISOString();
const reply = (x:unknown, status=200) => new Response(JSON.stringify(x), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
const err = (message:string, status=400) => reply({error:message},status);
const get = (db:Database,sql:string,...args:any[]) => db.query(sql).get(...args) as Data | null;
const all = (db:Database,sql:string,...args:any[]) => db.query(sql).all(...args) as Data[];
const count = (db:Database,sql:string,...args:any[]) => Number(get(db,sql,...args)?.n ?? 0);
const read = async (r:Request) => {const s=await r.text();if(s.length>24000)throw Error("Assessment exceeds 24 KB.");const d=JSON.parse(s);if(!d || Array.isArray(d) || typeof d!=="object")throw Error("JSON object required.");return d as Data;};
const safeEq = (a:string,b:string) => {const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y);};
const isAdmin = (req:Request, secret:string) => secret.length>=24 && safeEq((req.headers.get("authorization")||"").replace(/^Bearer\s+/i,""),secret);
const rateOK = (r:Request) => {const key=hash((r.headers.get("x-forwarded-for")||"unknown").split(",")[0]);const time=Date.now();const recent=(limits.get(key)||[]).filter(x=>time-x<600000);if(recent.length>=6)return false;recent.push(time);limits.set(key,recent);if(limits.size>5000)limits.clear();return true;};
const isoDate = (v:unknown) => {const s=clean(v,35);return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?Z)?$/.test(s)?s:"";};
function audit(db:Database,entity:string,id:string,event:string,extra:Data={}) {
 db.query("INSERT INTO bw_sales_audit VALUES(?,?,?,?,?,?)").run(randomUUID(),entity,id,event,JSON.stringify(extra),now());
}
function validateAssessment(d:Data) {
 const company=clean(d.company,140), contact=clean(d.contact,120), email=clean(d.email,254).toLowerCase();
 const trade=clean(d.trade,40), project=clean(d.project,140), scope=clean(d.scope,2200), pain=clean(d.pain,60);
 if(!company||!contact||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)||!trades.has(trade)||!project||scope.length<15||!painKeys.has(pain))throw Error("Company, contact, email, trade, project, detailed scope and workflow problem are required.");
 const calc=(d.calculator && typeof d.calculator==="object" && !Array.isArray(d.calculator))?d.calculator:{};
 let price:null|number=null;
 if(calc.pricing && typeof calc.pricing==="object"){const result=calculateChangeOrder(calc.pricing);price=Number(result.recommendedPrice);}
 return {
  product_id:PRODUCT, company,contact,email,trade,project,scope,pain,
  buyer:clean(d.buyer,120), role:clean(d.role,80), phone:clean(d.phone,60),
  evidence:clean(d.evidence,1800), objections:clean(d.objections,1300),
  next_action:clean(d.next_action,300)||"Review assessment and schedule a 20-minute workflow call",
  owner:clean(d.owner,100)||"BuildWorkflow intake", outcome:clean(d.outcome,500),
  work_status:clean(d.work_status,80)||"Unapproved extra work",
  calculator: {pricing:calc.pricing??null, job:calc.job??null, evidence:calc.evidence??null},
  estimated_price_cad:price, source:"buildworkflow.site.assessment", updated_at:now()
 };
}
function verifiedReadiness(db:Database, secret:string) {
 const receipt = count(db,"SELECT COUNT(*) AS n FROM bw_sales_receipts r JOIN bw_sales_assessments a ON r.assessment_id=a.id JOIN bw_sales_tasks t ON t.assessment_id=a.id WHERE r.product_id=? AND r.operation='assessment_saved'", PRODUCT)>0;
 const secrets=secret.length>=24 && (process.env.ORDER_LINK_SECRET||"").length>=24;
 const isolation=true; // dedicated bw_sales_* tables and product_id + isolated fieldchange DB; not a cross-product integration
 const enabled=process.env.BUILDWORKFLOW_OUTREACH_ENABLED==="true";
 return {capture_verified:receipt,crm_receipt_verified:receipt,secrets_configured:secrets,product_isolation_verified:isolation,outreach_switch_enabled:enabled,outreach_allowed:receipt&&secrets&&isolation&&enabled,reason:receipt&&secrets&&isolation&&enabled?"verified":"Outbound disabled until capture, receipt, secret configuration, product isolation and explicit release are verified."};
}
const assessmentView = (row:Data, receipt:Data|null, task:Data|null) => ({id:row.id,created_at:row.created_at,updated_at:row.updated_at,assessment:JSON.parse(row.record_json),crm_receipt:receipt?{id:receipt.id,product_id:receipt.product_id,operation:receipt.operation,created_at:receipt.created_at}:null,follow_up:task?{id:task.id,title:task.title,owner:task.owner,due_at:task.due_at,status:task.status}:null});
const requestOrigin = (req:Request) => {const o=req.headers.get("origin");return !o || o===new URL(req.url).origin;};

export function initSales(db:Database) {
 db.exec(`
 CREATE TABLE IF NOT EXISTS bw_sales_assessments(id TEXT PRIMARY KEY, manage_hash TEXT NOT NULL, record_json TEXT NOT NULL, company TEXT NOT NULL, trade TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_receipts(id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL UNIQUE,product_id TEXT NOT NULL,operation TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_tasks(id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,title TEXT NOT NULL,owner TEXT NOT NULL,due_at TEXT,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_targets(id TEXT PRIMARY KEY,record_json TEXT NOT NULL,company TEXT NOT NULL,trade TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_interviews(id TEXT PRIMARY KEY,target_id TEXT NOT NULL,record_json TEXT NOT NULL,status TEXT NOT NULL,conducted_at TEXT,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_changes(id TEXT PRIMARY KEY,target_id TEXT NOT NULL,record_json TEXT NOT NULL,status TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bw_sales_audit(id TEXT PRIMARY KEY,entity TEXT NOT NULL,entity_id TEXT NOT NULL,event TEXT NOT NULL,record_json TEXT NOT NULL,at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS bw_sales_assessments_recent ON bw_sales_assessments(created_at DESC);
 CREATE INDEX IF NOT EXISTS bw_sales_targets_status ON bw_sales_targets(status);
 CREATE INDEX IF NOT EXISTS bw_sales_tasks_due ON bw_sales_tasks(due_at);
 `);
}
function metrics(db:Database) {
 const verifiedInterviews=count(db,"SELECT COUNT(*) AS n FROM bw_sales_interviews WHERE status='completed' AND verified=1");
 const verifiedChanges=count(db,"SELECT COUNT(*) AS n FROM bw_sales_changes WHERE status IN ('approved','invoice_ready','invoiced') AND verified=1");
 return {assessment_count:count(db,"SELECT COUNT(*) AS n FROM bw_sales_assessments"),crm_receipt_count:count(db,"SELECT COUNT(*) AS n FROM bw_sales_receipts WHERE product_id=?",PRODUCT),targets:count(db,"SELECT COUNT(*) AS n FROM bw_sales_targets"),open_tasks:count(db,"SELECT COUNT(*) AS n FROM bw_sales_tasks WHERE status='open'"),verified_interviews:verifiedInterviews,first_five_interviews_remaining:Math.max(0,5-verifiedInterviews),verified_real_change_orders:verifiedChanges,paid_pilots:count(db,"SELECT COUNT(*) AS n FROM bw_sales_targets WHERE status='won'"),claims_basis:"Only admin-confirmed evidence references count as verified. Empty states mean no verified evidence."};
}
function sanitizeTarget(d:Data,prev:Data={}) {
 const company=clean(d.company??prev.company,160),trade=clean(d.trade??prev.trade,40),status=clean(d.status??prev.status,40);
 if(!company||!trades.has(trade)||!stages.has(status))throw Error("Target requires company, supported trade and valid stage.");
 return {product_id:PRODUCT,company,trade,status,region:clean(d.region??prev.region,80)||"Metro Vancouver",
  buyer:clean(d.buyer??prev.buyer,150),contact:clean(d.contact??prev.contact,180),
  pain:clean(d.pain??prev.pain,350),evidence:clean(d.evidence??prev.evidence,1800),
  objections:clean(d.objections??prev.objections,1500),next_action:clean(d.next_action??prev.next_action,400),
  due_at:isoDate(d.due_at??prev.due_at),owner:clean(d.owner??prev.owner,100)||"Founder",
  outcome:clean(d.outcome??prev.outcome,900),source:clean(d.source??prev.source,250),
  updated_at:now()};
}
function proofRecord(d:Data,kind:"interview"|"change",prev:Data={}) {
 const target_id=clean(d.target_id??prev.target_id,70),status=clean(d.status??prev.status,40),evidence=clean(d.evidence??prev.evidence,2200),reference=clean(d.reference??prev.reference,500);
 if(!target_id)throw Error("A linked contractor target is required.");
 const legal=kind==="interview"?["planned","scheduled","completed","cancelled"]:["observed","priced","submitted","approved","invoice_ready","invoiced","lost"];
 if(!legal.includes(status))throw Error("Invalid workflow status.");
 const verified=d.verified===true;
 if(verified && (!reference || evidence.length<15 || !(kind==="interview"?status==="completed":["approved","invoice_ready","invoiced"].includes(status))))
  throw Error("Verification requires an evidence reference, evidence notes (15+ chars) and a qualifying completed stage.");
 return {product_id:PRODUCT,target_id,status,evidence,reference,verified,
  buyer:clean(d.buyer??prev.buyer,120),pain:clean(d.pain??prev.pain,800),
  objections:clean(d.objections??prev.objections,1000),next_action:clean(d.next_action??prev.next_action,400),
  owner:clean(d.owner??prev.owner,100)||"Founder",outcome:clean(d.outcome??prev.outcome,800),
  conducted_at:isoDate(d.conducted_at??prev.conducted_at),
  project:clean(d.project??prev.project,150),amount_cad:Math.max(0,Number(d.amount_cad??prev.amount_cad)||0),
  approved_at:isoDate(d.approved_at??prev.approved_at),invoice_ready_at:isoDate(d.invoice_ready_at??prev.invoice_ready_at),
  updated_at:now()};
}
export async function handleSalesRoute(req:Request,db:Database,adminSecret:string):Promise<Response|null> {
 const url=new URL(req.url),p=url.pathname,m=req.method;
 if(m==="GET"&&p==="/assessment")return new Response(Bun.file("public/assessment.html"),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"}});
 if(m==="GET"&&p==="/operations")return new Response(Bun.file("public/operations.html"),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex"}});
 if(m==="GET"&&p==="/api/public/proof")return reply({product_id:PRODUCT,verified_interviews:metrics(db).verified_interviews,verified_real_change_orders:metrics(db).verified_real_change_orders,verified_paid_pilots:"not_verified",generated_at:now()});
 if(m==="POST"&&p==="/api/assessments"){
  if(!requestOrigin(req))return err("Origin not allowed.",403);
  if(!rateOK(req))return err("Too many requests. Please retry later.",429);
  try{const d=await read(req);if(clean(d.website,200))return reply({ok:true,message:"Received."},202);if(d.consent!==true)return err("Consent to save your assessment and follow up is required.",422);
   const record=validateAssessment(d),id=randomUUID(),key=token(),receipt=randomUUID(),task=randomUUID(),at=now(),due=new Date(Date.now()+2*86400000).toISOString();
   db.transaction(()=>{
    db.query("INSERT INTO bw_sales_assessments VALUES(?,?,?,?,?,?,?,?)").run(id,hash(key),JSON.stringify(record),record.company,record.trade,record.email,at,at);
    db.query("INSERT INTO bw_sales_receipts VALUES(?,?,?,?,?)").run(receipt,id,PRODUCT,"assessment_saved",at);
    db.query("INSERT INTO bw_sales_tasks VALUES(?,?,?,?,?,?,?,?)").run(task,id,"Review assessment and arrange a contractor workflow interview",record.owner,due,"open",at,at);
    audit(db,"assessment",id,"captured",{product_id:PRODUCT,crm_receipt_id:receipt,task_id:task});
   })();
   const saved=get(db,"SELECT * FROM bw_sales_assessments WHERE id=?",id),verified=get(db,"SELECT r.id FROM bw_sales_receipts r JOIN bw_sales_tasks t ON t.assessment_id=r.assessment_id WHERE r.assessment_id=? AND r.product_id=?",id,PRODUCT);
   if(!saved||!verified)return err("Receipt verification failed; contact support.",503);
   return reply({ok:true,id,manage_url:"/assessment?ref="+encodeURIComponent(id)+"&token="+encodeURIComponent(key),crm_receipt:{id:receipt,product_id:PRODUCT,stored:true},follow_up:{id:task,status:"open",owner:record.owner,due_at:due},assessment:record},201);
  }catch(e){return err(e instanceof Error?e.message:"Could not save assessment.",422);}
 }
 const privatePath=p.match(/^\/api\/assessments\/([0-9a-f-]{36})$/i);
 if(privatePath&&(m==="GET"||m==="PATCH")){
  const row=get(db,"SELECT * FROM bw_sales_assessments WHERE id=?",privatePath[1]),key=url.searchParams.get("token")||req.headers.get("x-assessment-token")||"";
  if(!row||key.length<32||!safeEq(key,row.manage_hash) && hash(key)!==row.manage_hash)return err("Assessment link invalid or unavailable.",404);
  const receipt=get(db,"SELECT * FROM bw_sales_receipts WHERE assessment_id=? AND product_id=?",row.id,PRODUCT);
  const task=get(db,"SELECT * FROM bw_sales_tasks WHERE assessment_id=? ORDER BY created_at LIMIT 1",row.id);
  if(m==="GET")return reply(assessmentView(row,receipt,task));
  if(!requestOrigin(req))return err("Origin not allowed.",403);
  try{const d=await read(req),old=JSON.parse(row.record_json),record=validateAssessment({...old,...d,calculator:d.calculator??old.calculator});
   db.transaction(()=>{
    db.query("UPDATE bw_sales_assessments SET record_json=?,company=?,trade=?,email=?,updated_at=? WHERE id=?").run(JSON.stringify(record),record.company,record.trade,record.email,now(),row.id);
    db.query("UPDATE bw_sales_tasks SET owner=?,updated_at=? WHERE assessment_id=? AND status='open'").run(record.owner,now(),row.id);
    audit(db,"assessment",row.id,"edited",{product_id:PRODUCT});
   })();
   return reply({ok:true,id:row.id,assessment:record,crm_receipt:receipt?{id:receipt.id,stored:true}:null,follow_up:task?{id:task.id,status:task.status}:null});
  }catch(e){return err(e instanceof Error?e.message:"Assessment update failed.",422);}
 }
 if(!p.startsWith("/api/ops/"))return null;
 if(!isAdmin(req,adminSecret))return err("Unauthorized.",401);
 if(m==="GET"&&p==="/api/ops/overview"){
  const targets=all(db,"SELECT * FROM bw_sales_targets ORDER BY updated_at DESC LIMIT 250").map(r=>({id:r.id,...JSON.parse(r.record_json)}));
  const interviews=all(db,"SELECT * FROM bw_sales_interviews ORDER BY updated_at DESC LIMIT 100").map(r=>({id:r.id,...JSON.parse(r.record_json)}));
  const changes=all(db,"SELECT * FROM bw_sales_changes ORDER BY updated_at DESC LIMIT 100").map(r=>({id:r.id,...JSON.parse(r.record_json)}));
  const assessments=all(db,"SELECT a.*,r.id as receipt_id,t.id as task_id,t.status as task_status FROM bw_sales_assessments a LEFT JOIN bw_sales_receipts r ON r.assessment_id=a.id LEFT JOIN bw_sales_tasks t ON t.assessment_id=a.id ORDER BY a.created_at DESC LIMIT 150").map(r=>({id:r.id,receipt_id:r.receipt_id,task_id:r.task_id,task_status:r.task_status,created_at:r.created_at,...JSON.parse(r.record_json)}));
  const tasks=all(db,"SELECT * FROM bw_sales_tasks ORDER BY status ASC,due_at ASC LIMIT 150");
  return reply({product_id:PRODUCT,readiness:verifiedReadiness(db,adminSecret),metrics:metrics(db),targets,interviews,changes,assessments,tasks,generated_at:now()});
 }
 if(m==="POST"&&p==="/api/ops/targets"){
  try{const r=sanitizeTarget(await read(req),{status:"research"});if(["contacted","interview_booked"].includes(r.status)&&!verifiedReadiness(db,adminSecret).outreach_allowed)return err("Outbound gate is closed.",409);
   const id=randomUUID(),at=now();db.transaction(()=>{db.query("INSERT INTO bw_sales_targets VALUES(?,?,?,?,?,?,?)").run(id,JSON.stringify(r),r.company,r.trade,r.status,at,at);audit(db,"target",id,"created",r);})();return reply({ok:true,id,target:r},201);
  }catch(e){return err(e instanceof Error?e.message:"Target invalid.",422);}
 }
 const target=p.match(/^\/api\/ops\/targets\/([0-9a-f-]{36})$/i);
 if(m==="PATCH"&&target){
  const row=get(db,"SELECT * FROM bw_sales_targets WHERE id=?",target[1]);if(!row)return err("Target not found.",404);
  try{const r=sanitizeTarget(await read(req),JSON.parse(row.record_json));if(["contacted","interview_booked"].includes(r.status)&&!verifiedReadiness(db,adminSecret).outreach_allowed)return err("Outbound gate is closed.",409);
   db.transaction(()=>{db.query("UPDATE bw_sales_targets SET record_json=?,company=?,trade=?,status=?,updated_at=? WHERE id=?").run(JSON.stringify(r),r.company,r.trade,r.status,now(),row.id);audit(db,"target",row.id,"updated",{stage:r.status});})();return reply({ok:true,id:row.id,target:r});
  }catch(e){return err(e instanceof Error?e.message:"Target update invalid.",422);}
 }
 const section=p.match(/^\/api\/ops\/(interviews|changes)(?:\/([0-9a-f-]{36}))?$/i);
 if(section&&((m==="POST"&&!section[2])||(m==="PATCH"&&section[2]))){
  const kind=section[1]==="interviews"?"interview":"change",table=kind==="interview"?"bw_sales_interviews":"bw_sales_changes";
  const row=section[2]?get(db,"SELECT * FROM "+table+" WHERE id=?",section[2]):null;
  if(section[2]&&!row)return err("Record not found.",404);
  try{const d=await read(req),r=proofRecord(d,kind,row?JSON.parse(row.record_json):{status:kind==="interview"?"planned":"observed"});
   if(!get(db,"SELECT id FROM bw_sales_targets WHERE id=?",r.target_id))return err("Unknown target contractor.",422);
   const id=section[2]||randomUUID(),at=now();
   db.transaction(()=>{if(row){db.query("UPDATE "+table+" SET target_id=?,record_json=?,status=?,verified=?,"+(kind==="interview"?"conducted_at=?":"updated_at=?")+",updated_at=? WHERE id=?").run(r.target_id,JSON.stringify(r),r.status,r.verified?1:0,kind==="interview"?r.conducted_at:at,at,id);}
    else if(kind==="interview"){db.query("INSERT INTO bw_sales_interviews VALUES(?,?,?,?,?,?,?,?)").run(id,r.target_id,JSON.stringify(r),r.status,r.conducted_at,r.verified?1:0,at,at);}
    else {db.query("INSERT INTO bw_sales_changes VALUES(?,?,?,?,?,?,?)").run(id,r.target_id,JSON.stringify(r),r.status,r.verified?1:0,at,at);}
    audit(db,kind,id,row?"updated":"created",{status:r.status,verified:r.verified,reference:r.reference});
   })();return reply({ok:true,id,record:r},row?200:201);
  }catch(e){return err(e instanceof Error?e.message:"Record invalid.",422);}
 }
 const task=p.match(/^\/api\/ops\/tasks\/([0-9a-f-]{36})$/i);
 if(m==="PATCH"&&task){
  const row=get(db,"SELECT * FROM bw_sales_tasks WHERE id=?",task[1]);if(!row)return err("Task not found.",404);
  try{const d=await read(req),status=clean(d.status??row.status,20),owner=clean(d.owner??row.owner,100),title=clean(d.title??row.title,300),due=isoDate(d.due_at??row.due_at);
   if(!["open","done","cancelled"].includes(status)||!owner||!title)throw Error("Invalid task update.");
   db.transaction(()=>{db.query("UPDATE bw_sales_tasks SET status=?,owner=?,title=?,due_at=?,updated_at=? WHERE id=?").run(status,owner,title,due,now(),row.id);audit(db,"task",row.id,"updated",{status});})();return reply({ok:true,id:row.id,status});
  }catch(e){return err(e instanceof Error?e.message:"Task invalid.",422);}
 }
 return err("Not found.",404);
}