# BuildWorkflow production domain and GitHub deployment

## Live architecture

- GitHub source: `Noetfield-Systems/buildmatch`, **`product/buildworkflow-fieldchange-mvp`**.
- Railway project: `buildworkflow-fieldchange`, production service: `fieldchange-desk`.
- GitHub source auto-deploys to Railway from `apps/fieldchange`, Bun/Docker, with persistent SQLite data under `/data`.
- Working production origin: https://fieldchange-desk-production.up.railway.app/
- Canonical customer-facing website: https://buildworkflow.ca/
- Alias: https://www.buildworkflow.ca/ (308 redirects GET/HEAD to canonical root).
- GitHub Pages **is not** the production runtime. The separate legacy `gh-pages` branch is an older static BuildMatch site. A static Pages site cannot execute this Bun server, database, order routes, or signed Stripe callbacks.

## Current DNS cutover (2026-11-10)

These domain mappings were attached to Railway. Records must be added **at the authoritative DNS provider**, not in a GitHub file. Existing email/MX/SPF/DKIM records must be preserved.

| Type | Host/name | Required value |
|---|---|---|
| CNAME (or flattened CNAME/ALIAS/ANAME for apex) | `@` / `buildworkflow.ca` | `dim8hxf3.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=517dd74ca50716ed1976165773e7d7cfad2d128ab593613defe2ef531828b1fe` |
| CNAME | `www` | `qtitncs5.up.railway.app` |
| TXT | `_railway-verify.www` | `railway-verify=9989aba7c69ee75361b8993af8941b4371f10b71b12ff0f94733131979609f93` |

Avoid leaving conflicting GitHub Pages A/AAAA/CNAME records on `@` and `www`. If the DNS provider offers a proxy toggle, use DNS-only first to complete Railway ownership verification, then validate HTTPS before changing any proxy settings. Preserve unrelated DNS and email records.

## Verify before claiming domain completion

1. Railway `domain_status` for **both** `buildworkflow.ca` and `www.buildworkflow.ca`: `verified=true` with a valid TLS certificate.
2. HTTPS root `/` returns 200, with the FieldChange title; `/api/health` returns 200 and storage connected.
3. HTTPS `www` GET requests redirect to `https://buildworkflow.ca`, preserving path and query.
4. `/calculator`, `/order`, `/terms`, `/privacy`, `/sitemap.xml`, and `/robots.txt` behave as expected.
5. Signed Stripe webhooks, successful live payments and customer approvals are **separate commerce checks**. Do not mark paid checkout complete until a real Stripe Payment Link/price and webhook are configured and verified. Do not invent customer transactions or revenue.

## GitHub release process

Changes to the product should be opened as PRs against `product/buildworkflow-fieldchange-mvp`; CI in `.github/workflows/fieldchange-ci.yml` must pass. Merging to that branch triggers the Railway deployment. Updating `main` or `gh-pages` alone does **not** update the production Bun application.

## DNS blocker ownership

Railway and GitHub cannot modify external DNS records by themselves. If a DNS provider is not connected, an account holder must create the four records above, or connect a DNS provider with authorized write access. The service remains available at the Railway origin until that is done.
