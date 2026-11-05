# BuildWorkflow FieldChange Desk

A narrow field-to-office change-order pilot for plumbing, HVAC, electrical and specialty contractors.

## Included
- Mobile-friendly extra-work capture and scope notes.
- Deterministic CAD price engine: loaded labour, materials, equipment, subcontractors, travel, overhead and contingency.
- Gross-margin calculation (price = loaded cost / (1 - margin)); never confuses margin with markup.
- Explicit TARGET MARGIN NOT ACHIEVABLE warning when a price cap conflicts with the target.
- Evidence checklist, copy summary and print-to-PDF handoff pack.
- Local browser drafts: job details and pricing inputs are not persisted on the server.
- Persistent SQLite pilot-intake storage on Railway volume, protected admin console and CSV export.

## Boundaries
This pilot is not an ERP, e-signature tool, customer approval system, accounting package, tax filing service, or source of legal advice. Job and customer work-order details stay in the browser; the separate pilot request form submits the contact information needed for follow-up.

## Run
Requires Bun 1.2+.
- bun run start
- bun test
- bun run check

Set DATABASE_PATH to a persistent path and ADMIN_TOKEN to a random secret. Never commit credentials.

## Commercial test
Offer a fixed-scope paid pilot: one crew, one extra-work workflow, one measured result. Validate paid demand before adding integrations or AI extraction.