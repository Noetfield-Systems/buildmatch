# AGENTS.md

Guidance for AI agents working in the **buildmatch** repository.

## Read first (locked internal strategy)

Before product, landing page, GTM, or feature work, read:

**[`docs/internal/VANCOUVER_PLATFORM_STRATEGY.md`](docs/internal/VANCOUVER_PLATFORM_STRATEGY.md)**

That document is the canonical, locked strategy for the Vancouver middle-layer platform (building envelope / home services coordination). Do not contradict its positioning without explicit user approval.

**Summary:** We are **not** a contractor. We are a **deal-flow + trust + coordination** layer between strata/owners/PMs and vetted trades. Lead with **risk** (leakage, energy, mold, insurance), not “selling windows.”

## Project status

- **Landing:** Static clone of Pure Flow (`/en/`, `/fr/`, `/fa/`, `/zh/`) — rebrand toward envelope advisory when directed
- **Stack:** Static HTML/CSS/JS + `npm run dev` (serve on port 3000)
- **Strategy:** See internal doc above

## Cursor Cloud specific instructions

### Run locally

```bash
npm ci
npm run dev
```

Open http://localhost:3000/en/

### Deploy

Static hosting — output directory is repo root; `/` redirects to `/en/`.

### Gotchas

- Booking form posts to `https://pureflow.sourcea.app/api/quote` until replaced with buildmatch backend
- `docs/internal/` is **internal** — not for public README duplication
