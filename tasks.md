# v0.1 — greyZ rolodex

## User story

As someone looking at greyZ's online identities (or greyZ handing over a card in person), I can flip through a dark rolodex of aliases and instantly share a public, confirmed calling card — permalink, phone share sheet, QR, or vCard — with one tap and no account.

## MVP UX flow

1. Open the site → the first alias card (`greyZ`) with spelling variants, services, and status counts.
2. Flip with keys, scroll or swipe. Unconfirmed aliases are labelled as such; nothing flashes.
3. Tap **Share** → native share sheet on mobile, otherwise the permalink is copied and a small toast confirms it. No modal, no sign-in.
4. QR is already on the card for in-person. Tap **vCard** to download public confirmed links only.
5. Send the permalink; it unfurls as a GLITCHFORGE-styled Open Graph card.

## Out of scope for v0.1

- Browser-side availability scraping (CORS + ToS).
- Reporting `free` from soft 404s or login walls.
- Emails, phone numbers, private repos.
- Merging the real sweep `aliases.json` (swap the file later).
