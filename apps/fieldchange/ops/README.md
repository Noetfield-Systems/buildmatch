# FieldChange Continuous Company OS — v1 operational contract

**Product:** `noetfield.buildworkflow.fieldchange` · **Source owner:** BuildMatch product branch · **Deployment:** existing Railway FieldChange Desk, NOT a new agent server.

Four accountable **roles**, executed by one read-only observation job, not four permanent LLMs. Rules and GitHub actions are deterministic today; any LLM critique is separately tagged advisory and **never** grants dispatch authority.

| Role | Evidence input | Machine result | Action authority |
|---|---|---|---|
| Developer | failing five-persona real /api/price QA evidence | bounded repair PR candidate and reproduction | candidate ONLY, no auto merge/deploy |
| Tester | existing five synthetic operator personas against real API | 5 statuses, mismatch+SHA, CI artifact | existing `qa:loop` |
| Monitor | real GET /api/health, /, /privacy; unauthorized GET /api/admin/leads and /api/integrations/sina/revenue-summary | status/latency + customer-data boundary check | read only |
| Growth | existing QA classification plus instrumentation inventory | gap when users/activation/retention not observed | no invented buyers, conversions or revenue |

### Real execution

1. Existing `.github/workflows/buildworkflow-company-quality.yml` on GitHub's **default/main** runs scheduled, using `product/buildworkflow-fieldchange-mvp` product snapshot, not the old QA-only branch.
2. Runs `bun run qa:loop` with `QA_TARGET_URL=https://fieldchange-desk-production.up.railway.app`. No CRM/pilot write and no fake lead insertion. QA failure still uploads evidence.
3. Runs `bun run ops:cycle` against the same explicit production origin; reads QA JSON, runs five safe GET probes, requires source/provenance/count/freshness; produces `ops-out/latest.json` with bounded proposed actions.
4. Existing GitHub Issue handoff checks QA and Ops artifact schemas and produces **reviewable engineering work candidates**, never a SourceA DecisionRecord or production WorkPacket. A candidate can be picked up by the already-authorized Company OS/Runway worker only after an actual Permit.
5. Railway native `/api/health` remains the always-on service healthcheck. Scheduled QA frequency is not a one-minute monitor; no fabricated 60-second SLA.

### Proof boundaries

- Five QA personas are **synthetic tests**, not customers.
- The presence of the pilot-intake form or number of leads is not an activation or retention metric.
- No personal contact data is included in Ops evidence.
- No outbound sales messages, synthetic traffic amplification, automated price changes, direct production writes, auto merges, new credentials or duplicate schedulers.
- Commercial outcome from this workflow is **NOT MEASURED**. A separate, private authenticated aggregate SourceA/Sina feed may measure real pilot requests, but cannot be accessed without its own scoped reader identity.
- Candidate owner and product ID stay consistent with existing Company OS; Sina Founder OS may evaluate the canonical issue/evidence queue for portfolio-level priority only after a verified integration.

### Gates for next stage

- Source-code PR + CI + actual scheduled runtime artifact with 5/5 probes or documented failures.
- One real failed QA issue results in a **model-authored bounded fix PR** through an authorized worker; independent code, test and runtime verification required; no direct merge.
- An independently observed customer *activation* event (not synthetic QA) and consent-respecting aggregate funnel, then adoption/retention A/B evidence.
- Only then expand identical reusable role adapters to SignalForge/TrustField/Noetfield.

**Failure is a useful result.** Reports must say FAILED/BLOCKED when actual probes or data do not support success. No green dashboard from absent data.
