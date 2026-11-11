# BuildMatch / BuildWorkflow

This repository contains multiple construction-workflow experiments and production surfaces. **The live BuildWorkflow FieldChange product does not deploy from the default `main` branch.**

## BuildWorkflow FieldChange — production

- **Production code:** [`product/buildworkflow-fieldchange-mvp`](https://github.com/Noetfield-Systems/buildmatch/tree/product/buildworkflow-fieldchange-mvp/apps/fieldchange)
- **Application:** [Railway production](https://fieldchange-desk-production.up.railway.app/)
- **Canonical customer domain:** [buildworkflow.ca](https://buildworkflow.ca/) (DNS/SSL ownership verification in progress)
- **Deploy:** merge a PR targeting `product/buildworkflow-fieldchange-mvp`. Railway auto-deploys `apps/fieldchange` using Bun/Docker with persistent storage.
- **CI:** `.github/workflows/fieldchange-ci.yml`
- **Domain and DNS instructions:** [FieldChange runbook](https://github.com/Noetfield-Systems/buildmatch/blob/product/buildworkflow-fieldchange-mvp/apps/fieldchange/DOMAIN_RUNBOOK.md)

### Why not GitHub Pages?

The old `gh-pages` branch is a **legacy static BuildMatch** site. The FieldChange product has live API endpoints, SQLite, paid order/approval workflows, and webhook verification. Those cannot run inside static GitHub Pages; they run on Railway. GitHub remains the version-controlled source and deployment trigger.

Changing files on `main` or `gh-pages` does **not** update the production application. Never point the `buildworkflow.ca` customer domain at the legacy static site if the goal is the live FieldChange product.
