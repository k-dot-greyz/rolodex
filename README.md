# rolodex

A GLITCHFORGE-dark take on the *American Psycho* business-card scene, applied to online identities: flip through greyZ's aliases, see every spelling variant, and read whether each service is **his**, **someone else's**, **free**, or still **unknown**.

Owner: **Kaspars Greizis** (greyZ). Canonical id: `human:k-dot-greyz`.

## Quick start

```bash
npm ci
npm test
npm run dev
```

Static build:

```bash
npm run build
npm run preview
```

## Data: one-file swap

The alias sweep writes `src/data/aliases.json`. Replacing that file is enough — schema lives in `src/data/aliases.schema.json` and `src/lib/schema.ts`.

Each entry is:

| field | meaning |
|---|---|
| `handle` | spelling as found |
| `platform` | service id (`github`, `x`, …) |
| `profileUrl` | public URL, or `null` if unknown. **Do not invent URLs.** |
| `confidence` | `confirmed` / `probable` / `unconfirmed` |
| `evidenceUrls` | public evidence |
| `firstSeen` | ISO timestamp |

Optional `aliases[]` names the cards. If the sweep omits it, cards are derived from distinct handles.

v0.1 seeds the named aliases (greyZ, k.greyZ, k-dot-greyz, Kaspars Greizis, greyZxMusic, damn.fractal, al.paca, glitched stardust). The only claimed URL in seed is the public GitHub profile, and it stays **unknown** in the UI until the checker verifies it.

## Availability checker

Browsers cannot hit most profile endpoints (CORS). The checker is a **Node/TS job** (`scripts/check-availability.ts`) run by a scheduled GitHub Action. It writes `src/data/statuses.json`; the static site just reads the file.

Why this, not a serverless endpoint:

- The site stays static. No runtime, no cold starts, no CORS proxy to babysit.
- Status diffs are reviewable git history.
- The same script runs locally and in CI.
- Rate limits and caching are honest (20h cache, 350ms gap, polite UA).

Signals, all ToS-friendly:

- Official JSON APIs: GitHub users, npm registry, crates.io, PyPI.
- RDAP for `.com` / `.dev` / `.io` — never a registrar scrape.
- HTTP status of public profile URLs for the rest.

**Never report `free` without positive evidence.** An API/RDAP 404 is evidence. A social-network 404, a login wall, a 429 or a bot challenge is `unknown` plus a reason. Every result stores `checkedAt` and `method`.

```bash
npm run check:availability
```

## Quickshare

One tap, no account, no modal:

- **Share** uses the Web Share API on mobile, otherwise copies the permalink and toasts.
- Each card has a deep link `/a/{id}`; the deck also understands `#id`.
- QR is encoded locally (no third-party QR API) onto the card.
- **vCard** downloads public confirmed links only (`/a/{id}.vcf` or `/rolodex.vcf`).
- Open Graph / Twitter cards point at a pre-rendered GLITCHFORGE PNG per alias (`/og/{id}.png`).

Unconfirmed aliases are excluded from share payloads unless `public: true`. Links in the payload are confirmed public URLs only. No emails, no phone numbers.

## Stack

Astro + Vite + TypeScript (`strictest`), static output, one island for flip/share. Tests: variant generator, status classifier, schema, share payload builder.

## Look

Tokens from greyZ-manifesto, glitchworks-tarot and dev-master `cyberpunk.css`: `#0A0A0A`, cyan `#00fff9`, magenta `#ff2d6f`, violet `#bf5fff`, amber `#ffb400`, Inter / Fira Code / JetBrains Mono, static red/cyan title split, 2px scanlines. Motion respects `prefers-reduced-motion`; nothing flashes (GlitchWorks accessibility flash fix).
