# BioCLIP 2 identification service (Modal)

This folder is a small **Python** service that runs the BioCLIP 2 model on a
GPU. The app calls it to identify a photo. It lives on [Modal](https://modal.com)
(serverless GPUs) and **scales to zero** — you pay only for the seconds it spends
identifying, roughly **$0.001 per photo**, nothing when idle.

You do **not** need to know Python. Copy-paste the commands below.

---

## One-time setup

### 1. Install the Modal CLI

You need Python 3.10+ (macOS already has it). In a terminal:

```bash
pip3 install modal
```

If `pip3` isn't found, try `python3 -m pip install modal`.

### 2. Sign in to Modal (free)

```bash
modal setup
```

This opens your browser. Sign up with GitHub — the free plan includes monthly
credits that cover a hobby app many times over.

### 3. Create the shared secret

The service checks a secret token so nobody else can run up your bill. Generate
one and register it with Modal:

```bash
TOKEN=$(openssl rand -hex 24)
echo "Your BIOCLIP_TOKEN is: $TOKEN"
modal secret create bioclip-auth BIOCLIP_TOKEN=$TOKEN
```

**Copy that token** — you'll paste it into `.env.local` and later into Vercel.

### 4. Deploy the service

From the repo root:

```bash
modal deploy bioclip/bioclip_modal.py
```

The **first** deploy takes several minutes — it downloads BioCLIP 2 and the
Tree-of-Life embeddings (a few GB) and bakes them in. Later deploys are fast.

When it finishes it prints a URL like:

```
https://<your-account>--bioclip-id-web.modal.run
```

**Copy that URL.**

---

## Point the app at it (local testing)

Add these three lines to `.env.local` in the repo root:

```
ID_PROVIDER=bioclip
BIOCLIP_ENDPOINT=https://<your-account>--bioclip-id-web.modal.run
BIOCLIP_TOKEN=<the token from step 3>
```

Then run the app locally and try identifying photos:

```bash
npm run dev
```

The **first** identify after the service has been idle for 5+ minutes takes
~20–40s (cold start). Back-to-back identifies are fast.

### Quick check without the app

```bash
curl -s "$BIOCLIP_ENDPOINT/" # should print {"ok":true,"model":"bioclip-2"}
```

---

## Going to production

Once local testing looks good, add the same three env vars in the Vercel
dashboard (Settings → Environment Variables, Production) and redeploy. The Modal
service stays where it is — Vercel just calls it.

---

## Costs & controls

- **Idle:** $0 (scales to zero).
- **Per identify:** ~1–3 GPU-seconds on a T4 ≈ $0.0003–0.001.
- See usage at [modal.com](https://modal.com) → your app.
- To pause it entirely: `modal app stop bioclip-id`.
- To change the GPU or warm-window, edit `bioclip_modal.py` (`gpu=`,
  `scaledown_window=`) and redeploy.

## Accuracy aids (built in)

- **North America filter** — predictions are restricted to species in
  `data/na-taxa.json` (~30k US + Canada animal species), so the model can't
  return a confident foreign lookalike. Refresh the list occasionally with
  `npm run build:critter-list`, then `modal deploy` again.
- **Auto-crop** — each photo is cropped to its main subject (via `rembg`)
  before identification, so a critter that's small in a busy frame still gets
  recognised.

Redeploy (`modal deploy bioclip/bioclip_modal.py`) any time you change
`bioclip_modal.py` or rebuild `data/na-taxa.json`.
