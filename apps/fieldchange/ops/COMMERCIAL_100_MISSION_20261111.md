# BuildWorkflow — 100 prioritized next actions & Company OS mission

**Date:** 2026-11-11 · **Product:** `noetfield.buildworkflow.fieldchange` · **Scope:** Vancouver HVAC, plumbing, mechanical and electrical only

**North Star:** verified extra work → written change approval → invoice-ready evidence → repeat paid contractor outcomes.

**Status:** This document is a candidate execution backlog, not 100 deployed features or 100 running agents. No outreach until capture + secrets + product isolation + CRM receipt are independently verified and the outbound switch is explicitly released. No RWA Wave 1 or other product data, campaigns or billing.

**Existing assets:** deployed Railway `buildworkflow-fieldchange/fieldchange-desk`; product branch `product/buildworkflow-fieldchange-mvp`; existing hourly synthetic Company OS observer on GitHub main; issue #15 (CAD 149 Change Order Rescue); PR #16 (FieldChange Pro); issue #11 (real activation gap). Keep these as active parents, avoid duplicate tickets.

**Operating roles (existing Company OS; not new infrastructure):** Engineering, QA/Independent Verifier, Revenue, Growth, Partnerships, Customer Success, CEO/Strategy. Founder retains approved outbound release, consequential spends and customer contract authority. Existing scheduled monitor observes; it is NOT evidence of automated sales or autonomous delivery.

**Wave sequencing:** W0 BW-001–020 is correctness, user-visible completion and real evidence; W1 BW-021–040 is buyer validation and payments; W2 BW-041–060 is distribution; W3 BW-061–080 is retention and differentiation; company operations BW-081–100 activate as capabilities are verified. Prioritize by paid proof and risk, not numerical order alone.

## Backlog (100 unique action contracts)

### 01 — Truth, security and production recovery · P0

- **BW-001** — Verify a real consented assessment-to-receipt-to-follow-up transaction. **Owner:** Trust & Independent Verification. **Acceptance:** One persisted assessment, matching receipt and assigned task; synthetic smoke data excluded from customer reporting.
- **BW-002** — Verify ADMIN_TOKEN and ORDER_LINK_SECRET strength without disclosing values. **Owner:** Trust & Independent Verification. **Acceptance:** Runtime yes/no secrets check and safe negative access tests.
- **BW-003** — Unify the canonical product ID across assessment, CRM, Company OS and event transport. **Owner:** Trust & Independent Verification. **Acceptance:** One noetfield.buildworkflow.fieldchange namespace, migration-compatible receipts.
- **BW-004** — Prove product isolation from RWA Wave 1, SignalForge and other databases. **Owner:** Trust & Independent Verification. **Acceptance:** Read-only isolation test plus rejected cross-product identifier test.
- **BW-005** — Add idempotency to assessment creation and repeat-click protection. **Owner:** Trust & Independent Verification. **Acceptance:** Double submit creates exactly one intended assessment + task.
- **BW-006** — Harden private links, origin checks, payload bounds and authorization. **Owner:** Trust & Independent Verification. **Acceptance:** Negative-path tests pass for access, replay and malformed requests.
- **BW-007** — Prove recoverability of SQLite volume and attached evidence. **Owner:** Trust & Independent Verification. **Acceptance:** Verified restore of encrypted backup in an isolated environment.
- **BW-008** — Add redacted request/exception tracing for the commercial funnel. **Owner:** Trust & Independent Verification. **Acceptance:** Errors identifiable without names, emails, access tokens or field files.
- **BW-009** — Separate real customer evidence, test fixtures and demo counters everywhere. **Owner:** Trust & Independent Verification. **Acceptance:** No test event can increment verified buyer or revenue metrics.
- **BW-010** — Extend existing scheduled production QA to assessment, proof and operations-denial routes. **Owner:** Trust & Independent Verification. **Acceptance:** Hourly report checks new surfaces with no CRM writes.

### 02 — Field-to-invoice operational product · P0

- **BW-011** — Review and integrate existing FieldChange Pro PR #16 without regressing production. **Owner:** Engineering. **Acceptance:** Private photo evidence and office features pass CI and deployment comparison.
- **BW-012** — Enable mobile photo capture with consented storage and EXIF removal. **Owner:** Engineering. **Acceptance:** Job-linked encrypted references, size limits and verified deletion.
- **BW-013** — Capture crew time, material quantity and equipment on a T&M ticket. **Owner:** Engineering. **Acceptance:** Priced ticket with source-linked line items.
- **BW-014** — Attach each evidence item to an exact scope line or cost item. **Owner:** Engineering. **Acceptance:** Office can trace change description to supporting artifacts.
- **BW-015** — Create immutable approval-relevant versions of each change order. **Owner:** Engineering. **Acceptance:** Revision history preserves former price and decision.
- **BW-016** — Complete no-login GC/owner written approval with clear signatory role. **Owner:** Engineering. **Acceptance:** Paid review link records verified timestamped decision.
- **BW-017** — Support customer rejection, requested revision and resubmission. **Owner:** Engineering. **Acceptance:** Rejected CO returns to a new version without losing history.
- **BW-018** — Add approval event audit log with signer, decision and prior status. **Owner:** Engineering. **Acceptance:** Exportable chronological event history.
- **BW-019** — Implement invoice-ready gate for scope, approved amount, evidence and PO. **Owner:** Engineering. **Acceptance:** Status stays not ready until explicit requirements are met.
- **BW-020** — Export approved, formula-safe accounting handoff with PDF evidence index. **Owner:** Engineering. **Acceptance:** Finance team receives defensible pack, not a fake issued tax invoice.

### 03 — First Vancouver customers and paid validation · P0

- **BW-021** — Build a research-only list of 25 trade-heavy Metro Vancouver contractors. **Owner:** Growth + Revenue. **Acceptance:** 25 source-attributed prospects; no messages sent before gate.
- **BW-022** — Balance the prospect pool across HVAC, plumbing, mechanical and electrical. **Owner:** Growth + Revenue. **Acceptance:** Trade-by-trade buyer/problem hypothesis comparison.
- **BW-023** — Score prospects by extra-work volume, handoff pain and decision access. **Owner:** Growth + Revenue. **Acceptance:** Visible fit score and rationale for the top ten.
- **BW-024** — Prepare five-question interview guide and source-linked note template. **Owner:** Growth + Revenue. **Acceptance:** Structured buyer/pain/evidence/objection/next action format.
- **BW-025** — Prepare a permission-based interview booking flow after outbound release. **Owner:** Growth + Revenue. **Acceptance:** Booking method and consent state in each real record.
- **BW-026** — Complete first five genuine contractor interviews and attach evidence refs. **Owner:** Growth + Revenue. **Acceptance:** Five documented, verified interviews; synthetic examples excluded.
- **BW-027** — Run one real jobsite-to-office workflow shadow pilot. **Owner:** Growth + Revenue. **Acceptance:** Measured baseline and after state on one permissioned project.
- **BW-028** — Secure first contractor-supplied actual change order with supporting proof. **Owner:** Growth + Revenue. **Acceptance:** Real CO source/approval/invoice status independently checked.
- **BW-029** — Run a tightly scoped three-contractor pilot cohort after first proof. **Owner:** Growth + Revenue. **Acceptance:** Three distinct contractor outcomes with owner and next action.
- **BW-030** — Close the first paid validation order and retain settlement evidence. **Owner:** Growth + Revenue. **Acceptance:** Stripe-confirmed real payment plus fulfilled deliverable and margin.

### 04 — Offers, checkout and revenue economics · P0

- **BW-031** — Package a free diagnostic as the entry offer. **Owner:** Revenue. **Acceptance:** Clear free-to-paid handoff, no false success promise.
- **BW-032** — Activate and verify the existing CAD 9 approval pack when Stripe is configured. **Owner:** Revenue. **Acceptance:** Signed payment webhook and exactly one paid pack.
- **BW-033** — Deliver existing CAD 149 Change Order Rescue issue #15. **Owner:** Revenue. **Acceptance:** Paid order → real evidence → verified artifact → secure delivery.
- **BW-034** — Offer CAD 750–1,500 workflow setup as a proposed price test. **Owner:** Revenue. **Acceptance:** Founder-priced statement of work and first acceptance/decline evidence.
- **BW-035** — Test CAD 399–699/month managed change-order desk as a proposed offer. **Owner:** Revenue. **Acceptance:** Monthly scope, allowance, upsell and paid renewal data.
- **BW-036** — Measure contribution margin per pack, rescue case and managed engagement. **Owner:** Revenue. **Acceptance:** Fees, labor, model cost, refunds and taxes separated.
- **BW-037** — A/B test high-intent pricing copy only after sufficient qualified traffic. **Owner:** Revenue. **Acceptance:** Conversion by segment without invented statistical certainty.
- **BW-038** — Track checkout abandonment and recovery permission. **Owner:** Revenue. **Acceptance:** Consent-safe drop-off count and appropriately bounded follow-up.
- **BW-039** — Publish service scope, delivery milestones, refund terms and exclusions. **Owner:** Revenue. **Acceptance:** Buyer accepts a precise deliverable, not vague automation.
- **BW-040** — Reconcile Stripe charges, refunds and delivered work monthly. **Owner:** Revenue. **Acceptance:** Collected cash and profit backed by external payment records.

### 05 — Organic acquisition and Vancouver search · P1

- **BW-041** — Audit technical SEO, indexing, canonicals, sitemap and mobile usability. **Owner:** Growth. **Acceptance:** Search Console index coverage and Core Web Vitals baseline.
- **BW-042** — Publish HVAC rooftop and duct extra-work use cases. **Owner:** Growth. **Acceptance:** Useful job-specific examples and measurable calculator starts.
- **BW-043** — Publish plumbing extra-work evidence and approval guide. **Owner:** Growth. **Acceptance:** Qualified plumber diagnostic sessions.
- **BW-044** — Publish electrical change-order and added-circuit guide. **Owner:** Growth. **Acceptance:** Electrical calculator-to-assessment completion.
- **BW-045** — Publish mechanical coordination and drawing-revision guide. **Owner:** Growth. **Acceptance:** Mechanical buyer engagement evidence.
- **BW-046** — Create a true T&M ticket checklist and printable template. **Owner:** Growth. **Acceptance:** Qualified template use, not vanity download count.
- **BW-047** — Publish invoice-ready evidence guide for BC specialty subcontractors. **Owner:** Growth. **Acceptance:** Organic engaged traffic that starts an assessment.
- **BW-048** — Publish Vancouver-specific contractor operations case notes only after proof. **Owner:** Growth. **Acceptance:** Source-verified local story, no fake logos or claims.
- **BW-049** — Evaluate Google Business Profile eligibility before creating a local listing. **Owner:** Growth. **Acceptance:** Compliant local presence if eligibility is met.
- **BW-050** — Instrument Search Console and privacy-respecting funnel attribution. **Owner:** Growth. **Acceptance:** Organic source → price → assessment → qualified buyer.

### 06 — Partnerships and distribution · P1

- **BW-051** — Research plumbing/HVAC/electrical supply-house education channels. **Owner:** Partnerships. **Acceptance:** Named channels with non-intrusive partnership fit.
- **BW-052** — Develop co-delivery option for local construction bookkeepers. **Owner:** Partnerships. **Acceptance:** One evidence-to-invoice referral workflow ready for testing.
- **BW-053** — Collaborate with independent estimators on priced CO packs. **Owner:** Partnerships. **Acceptance:** Estimator review checklist and referral proposal.
- **BW-054** — Prepare BC trade association mini-workshop. **Owner:** Partnerships. **Acceptance:** 20-minute evidence-based change-order tutorial.
- **BW-055** — Recruit GC project managers to critique approval packets. **Owner:** Partnerships. **Acceptance:** Two genuine outside-user reviews without unsolicited outreach before gate.
- **BW-056** — Import approved existing contacts only with provenance and consent. **Owner:** Partnerships. **Acceptance:** Deduplicated, scoped contractor relationship register.
- **BW-057** — Offer a referral incentive payable only from collected revenue. **Owner:** Partnerships. **Acceptance:** Written referral unit economics and clear eligibility.
- **BW-058** — Create co-brandable but non-misleading change-order sample pack. **Owner:** Partnerships. **Acceptance:** Partner demo asset clearly labeled illustrative.
- **BW-059** — Offer embed/share link to the free calculator. **Owner:** Partnerships. **Acceptance:** Tracked high-intent referral starts.
- **BW-060** — Produce a two-minute Vancouver field-to-office explainer. **Owner:** Partnerships. **Acceptance:** Real product capture demo with no fabricated client outcomes.

### 07 — Retention and customer success · P2

- **BW-061** — Create repeatable job and trade template libraries. **Owner:** Customer Success. **Acceptance:** Second CO takes fewer clicks than first.
- **BW-062** — Create organization-specific contractor workspaces. **Owner:** Customer Success. **Acceptance:** Each company isolated, with governed sharing.
- **BW-063** — Define field-worker, PM, estimator and finance permissions. **Owner:** Customer Success. **Acceptance:** Role-based access enforced server-side.
- **BW-064** — Optimize on-phone capture time with real contractors. **Owner:** Customer Success. **Acceptance:** Median time to first usable ticket measured.
- **BW-065** — Support offline-first draft capture and safe reconnect. **Owner:** Customer Success. **Acceptance:** No duplicate CO on reconnect or interrupted network.
- **BW-066** — Track GC/owner aging and reminders only for authorized requests. **Owner:** Customer Success. **Acceptance:** Days waiting and owner visible.
- **BW-067** — Add explicit 'ball in court' states for approvals. **Owner:** Customer Success. **Acceptance:** Every active CO has next responsible party.
- **BW-068** — Create first-job guided onboarding and training checklist. **Owner:** Customer Success. **Acceptance:** Measured activation: first real CO successfully recorded.
- **BW-069** — Provide a practical human fallback and SLA for managed pilots. **Owner:** Customer Success. **Acceptance:** Ticket owner and escalation history visible.
- **BW-070** — Measure first-to-second CO retention by customer cohort. **Owner:** Customer Success. **Acceptance:** Repeat meaningful usage over 30/60 days.

### 08 — Differentiation, AI assistance and integrations · P2

- **BW-071** — Draft scope from a recorded field voice note with human correction. **Owner:** Engineering. **Acceptance:** Transcription source attached; no auto approval.
- **BW-072** — Extract drawing and revision references from user-provided documents. **Owner:** Engineering. **Acceptance:** Page and sheet references with confidence and correction.
- **BW-073** — Flag approval prerequisites from customer-supplied contract clauses. **Owner:** Engineering. **Acceptance:** Human-reviewed checklist with actual clause citations.
- **BW-074** — Support project-specific allowable markup and margin constraints. **Owner:** Engineering. **Acceptance:** Explicit caps and mathematical reconciliation.
- **BW-075** — Create controlled labor/material/equipment rate libraries per project. **Owner:** Engineering. **Acceptance:** Versioned rate source for each price.
- **BW-076** — Generate source-grounded missing-evidence recommendations. **Owner:** Engineering. **Acceptance:** Each recommendation points to a missing artifact field.
- **BW-077** — Compare GC and subcontractor approval views without data leakage. **Owner:** Engineering. **Acceptance:** Scoped reviewer link and clean separation.
- **BW-078** — Generate redline/diff between CO revisions. **Owner:** Engineering. **Acceptance:** Readable changed costs, scope and terms.
- **BW-079** — Ship a reviewed QuickBooks-compatible export or connector. **Owner:** Engineering. **Acceptance:** Verified mapping to sample accounting data.
- **BW-080** — Offer Procore/Clearstory-compatible CSV handoff instead of replacement. **Owner:** Engineering. **Acceptance:** Interoperable export with preservation of source history.

### 09 — Specialized Company OS assignments · P1

- **BW-081** — Register BuildWorkflow as a single product-specific mission inside existing Company OS. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** One namespace, product owner and GitHub/Railway source IDs.
- **BW-082** — Assign Engineering agent to bounded issue-to-PR work. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Code PR links to issue, tests and release evidence.
- **BW-083** — Assign Independent QA agent to verify production and evidence. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Separate approval of actual runtime outcomes.
- **BW-084** — Assign Revenue agent to offers, checkout and real collections. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Daily exception queue; no invented payment.
- **BW-085** — Assign Growth agent to search, funnel and SEO experiments. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Source-attributed traffic and conversion proposals.
- **BW-086** — Assign Partnerships agent to prospects and channels. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Research-only until outreach release.
- **BW-087** — Assign Customer Success agent to interviews, pilot delivery and retention. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Each customer has owner, next action and success evidence.
- **BW-088** — Add Founder Pulse summarizing BuildWorkflow state separately. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** One decision-ready digest, no RWA/other product blending.
- **BW-089** — Bound agent runtime budget, concurrency and retry rules. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** No unbounded compute or duplicate work.
- **BW-090** — Require independently verified WorkPacket→artifact→receipt closure. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Failed, blocked and incomplete states remain visible.

### 10 — Continuous operation, learning and scale · P2

- **BW-091** — Reuse the existing hourly production observer, not another scheduler. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Health, auth-denial, proof and UI probes retain timestamps.
- **BW-092** — Run a daily sales and fulfillment exception triage. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Overdue action and blocked pilot are actionable work items.
- **BW-093** — Run weekly zero-spam landing/CTA review. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Only evidence-supported changes enter the build queue.
- **BW-094** — Run weekly five-interview discovery synthesis. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Buyer patterns, contradiction flags and hypotheses.
- **BW-095** — Run weekly competitor and BC contractor workflow research. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Cited changes with practical next product decision.
- **BW-096** — Open bounded repair PRs for independently reproduced defects. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Never merge a green status from failed evidence.
- **BW-097** — Add separate verification before marking customer deliverables done. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Actual artifact, recipient, outcome and receipt match.
- **BW-098** — Review monthly per-segment conversion, margin and cash collection. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Keep funding decisions tied to collected cash.
- **BW-099** — Define stop/pivot/expand thresholds for each trade and service offer. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** Evidence-based decisions, no perpetual vanity pilots.
- **BW-100** — Expand outside Vancouver only after paid repeatability and retention. **Owner:** Company OS Governor / Product Operating Unit. **Acceptance:** First adjacent market selected by verified demand.

## Company OS execution assignment

1. **One operating unit:** `noetfield.buildworkflow.fieldchange`, one SSOT product backlog in BuildMatch, one existing Company OS agent registry/scheduler, no shadow OS.
2. **Inputs:** live versioned CI/artifacts, signed revenue evidence, redacted anonymous funnel data, verified customer interviews, and authorized GitHub issues. Research is not customer contact.
3. **WorkPacket format:** `{product_id, mission_id, objective, owner_role, priority, evidence_refs, prerequisites, next_action, done_definition, spend_ceiling_cad, outreach_allowed:false, state}`. Production writes and outbound use existing authority system, not direct prompt privilege.
4. **Current routine:** hourly existing read-only QA observer; daily work triage from new issue/receipt records; weekly product/competitor/SEO review and 5-interview synthesis; monthly cash-margin reconciliation. Additional cadences are target operating contracts until actually wired and observed.
5. **First six workstreams:** (A) verify real assessment receipt and secrets/isolation; (B) integrate existing PR #16 without regressions; (C) deliver existing issue #15 CAD149 paid flow; (D) record first five genuine interviews; (E) build 25 research-only prospects; (F) integrate Company OS verified product WorkPackets.
6. **State machine:** PROPOSED → READY → AUTHORIZED → RUNNING → QA_PENDING → VERIFIED → CLOSED or BLOCKED/FAILED. No advancing to VERIFIED from QA fixtures or documentation alone.
7. **Outbound release:** require a real capture with matching CRM receipt/task, non-placeholder secrets, product isolation, approved campaign/domain, opt-out handling and explicit Founder release; default disabled. Direct sales scripts can be drafted while this is closed.
8. **Core KPIs:** qualified assessment rate, five verified interviews, real approved COs, invoice-ready real packs, first collected CAD, contribution margin per order, paid pilot conversion, repeat CO per contractor, unresolved evidence gaps, and deployment regression count.

**Decision criteria:** After five interviews, prioritize the dominant pain with verified budget and one consenting paid pilot; after 3 fulfilled paid pilots, optimize onboarding and delivery; do not add broad ERP features before proving repeat value.
