# buildmatch

Landing page for **Pure Flow Pool & Spa** — a static clone of [pureflow.sourcea.app/en/](https://pureflow.sourcea.app/en/).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000/en/](http://localhost:3000/en/)

## Structure

| Path | Purpose |
|------|---------|
| `en/`, `fr/`, `fa/`, `zh/` | Locale landing pages |
| `styles.css` | Site styles |
| `script.js` | Navigation, form, scroll effects |
| `i18n.js` | Locale switching |
| `config.js` | Site + API config |
| `locales/*.json` | Translations |
| `assets/` | Images, favicon |

## Booking form

The contact form posts to the Pure Flow quote API (`https://pureflow.sourcea.app/api/quote`).

## Deploy

Static hosting (Cloudflare Pages, Netlify, GitHub Pages, etc.):

- **Build command:** none  
- **Output directory:** `.` (repo root)  
- **Root redirect:** `/` → `/en/`
