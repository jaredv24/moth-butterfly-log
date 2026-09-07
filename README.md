# Moth & Butterfly Log

A mobile-first web app: photograph a moth or butterfly, identify the species, and
check it off a master checklist of North American Lepidoptera. Every logged
species carries a badge showing **where** you were and **when** you saw it.

- **No accounts.** Each device gets an auto-generated code like `MOTH-7X2Q4A`;
  that code is the key to your log. Paste it on another device to sync.
- **Identification** runs through a provider abstraction (`lib/id-provider/`):
  - `mock` (default) — deterministic candidates from the checklist, no keys.
  - `kindwise` — the [Kindwise insect.id API](https://www.kindwise.com/insect-id)
    (recommended for real use). Set `ID_PROVIDER=kindwise` + `KINDWISE_API_KEY`.
  - `inaturalist` — code exists, but iNaturalist's CV API is **not public** and
    needs case-by-case approval from their staff. Don't rely on it.
- **Checklist** (`data/checklist.json`, 2,489 species) is generated from the
  public iNaturalist API — every North American butterfly plus the ~900
  most-observed moths, tagged by family.

## Stack

Next.js 16 (App Router) · Tailwind v4 · Drizzle ORM · Postgres (Vercel Postgres /
Neon in production, in-process **PGlite** locally) · Vercel Blob for photos.

## Local development

```bash
npm install
cp .env.example .env        # defaults are fine for local dev
npm run db:setup            # apply migrations + seed the checklist into PGlite
npm run dev                 # http://localhost:3000
```

With no `DATABASE_URL` set, the app uses a local PGlite database in `./.pglite`
and writes uploaded photos to `public/uploads/` — no Postgres or cloud storage
needed.

### Useful scripts

| script | what it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run db:setup` | migrate + seed (local or remote, per `DATABASE_URL`) |
| `npm run db:generate` | regenerate SQL migration after editing `db/schema.ts` |
| `npm run build:checklist` | rebuild `data/checklist.json` from the iNaturalist API |
| `npm test` | Vitest unit tests |
| `npm run build` | production build |

## Real identification (Kindwise insect.id)

1. Sign up at <https://admin.kindwise.com/signup> (100 free credits, no card).
2. In the admin panel, create an API key **for the `insect.id` product**.
3. Set the env vars (locally in `.env`, in production via `vercel env add`):

   ```
   ID_PROVIDER=kindwise
   KINDWISE_API_KEY=...
   ```

Each identification spends one credit. The provider sends the photo (plus
lat/lng when available) to `POST /api/v1/identification` and maps
`result.classification.suggestions[]` to candidates, which are then matched
against the checklist by scientific name / genus.

### iNaturalist (not recommended)

`lib/id-provider/inaturalist.ts` implements the OAuth-password → JWT →
`score_image` flow, but iNaturalist's computer-vision API is **not publicly
available** — access is granted case-by-case by their staff. Treat this
provider as unusable unless you have explicit approval.

## Deploying to Vercel

1. Push to GitHub, import the repo in Vercel.
2. Add a Postgres database (Vercel Postgres or Neon) → sets `DATABASE_URL`.
3. Enable Blob storage → sets `BLOB_READ_WRITE_TOKEN`.
4. Add the identification env vars (or leave `ID_PROVIDER=mock`).
5. After the first deploy, run migrations + seed against the production database:

   ```bash
   DATABASE_URL="<prod url>" npm run db:setup
   ```

## Project layout

```
app/                 routes + API handlers
  api/user           create / look up a log by code
  api/identify       photo -> Blob upload -> provider -> matched candidates
  api/log            confirm a candidate; GET returns the log + life-list stats
  api/checklist      the master species list
components/           BottomNav, SeenBadge, SpeciesName, ProgressBar
db/                   Drizzle schema, migrations, seed, dual-driver connection
lib/
  id-provider/        mock + iNaturalist implementations behind one interface
  checklist-match.ts  candidate -> checklist species (taxon id / name / genus)
  geocode.ts          keyless reverse geocoding for the "where" badge
  code.ts             MOTH-XXXXXX code generation
data/checklist.json   generated master checklist (committed)
scripts/build-checklist.ts   regenerates the above
```
