# Moth & Butterfly Log

A mobile-first web app: photograph a moth or butterfly, identify the species, and
check it off a master checklist of North American Lepidoptera. Every logged
species carries a badge showing **where** you were and **when** you saw it.

- **No accounts.** Each device gets an auto-generated code like `MOTH-7X2Q4A`;
  that code is the key to your log. Paste it on another device to sync.
- **Identification** runs through a provider abstraction. The default `mock`
  provider returns deterministic candidates from the checklist so the whole flow
  works with zero credentials. Switch to `inaturalist` for real Computer Vision
  IDs (see below).
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

## Switching to real iNaturalist identification

1. Create an OAuth application at
   <https://www.inaturalist.org/oauth/applications> (any redirect URI).
2. Set in `.env` / Vercel project env:

   ```
   ID_PROVIDER=inaturalist
   INAT_APP_ID=...
   INAT_APP_SECRET=...
   INAT_USERNAME=your-inat-login
   INAT_PASSWORD=your-inat-password
   ```

The server does an OAuth password grant, exchanges it for a 24-hour JWT (cached
in memory), and calls `POST /v1/computervision/score_image`.

> **Note:** iNaturalist's Computer Vision API is not an officially public API.
> It works with a normal account token but rate limits and terms are a gray
> area — review <https://www.inaturalist.org/pages/api+reference> before running
> this in production or at volume.

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
