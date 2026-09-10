"""
BioCLIP 2 identification service, hosted on Modal.

Runs the BioCLIP 2 "Tree of Life" classifier on a GPU and exposes a tiny web
service: POST a photo -> top species guesses, each with a taxonomic order the
app uses to sort a turtle into "Turtles", a beetle into "Beetles", etc.

Two accuracy aids baked in:
  * predictions are restricted to species that occur in the US + Canada
    (data/na-taxa.json), so it can't return a foreign lookalike;
  * the photo is auto-cropped to the main subject before identification, so a
    critter that's small in a busy frame still gets recognised.

You don't need to know Python. See bioclip/README.md for the exact commands.
Short version:

    modal secret create bioclip-auth BIOCLIP_TOKEN=<a-long-random-string>
    modal deploy bioclip/bioclip_modal.py

First deploy downloads the models (~a few minutes, one time). It scales to zero
when idle, so it costs ~nothing when nobody is identifying.
"""

import base64
import io
import json

import modal

app = modal.App("bioclip-id")

CACHE_DIR = "/models"
model_cache = modal.Volume.from_name("bioclip-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .env({"HF_HOME": CACHE_DIR, "U2NET_HOME": f"{CACHE_DIR}/u2net"})
    .pip_install(
        "pybioclip==2.1.6",
        "pillow",
        "fastapi[standard]",
        "rembg[cpu]==2.0.59",
    )
)


def _warm() -> None:
    """Runs once at build time (cache volume mounted) so the BioCLIP model, the
    Tree-of-Life embeddings, and the rembg cutout model are all downloaded and
    persisted before any real request."""
    from bioclip import Rank, TreeOfLifeClassifier
    from PIL import Image
    from rembg import new_session, remove

    probe = Image.new("RGB", (224, 224), (127, 127, 127))
    TreeOfLifeClassifier().predict([probe], Rank.SPECIES, k=1)
    remove(probe, session=new_session("u2netp"), only_mask=True)
    model_cache.commit()


image = image.run_function(_warm, volumes={CACHE_DIR: model_cache})
image = image.add_local_file("data/na-taxa.json", "/na-taxa.json")


# --- TUNING -------------------------------------------------------------------
# gpu:              "T4" (cheap, ~1-2s warm) or None for CPU (~10x cheaper,
#                   ~3-5s warm). Set to None to run on CPU.
# scaledown_window: seconds to stay warm after the last request (max 1200).
# min_containers:   set to 1 to keep one container ALWAYS warm — no cold starts
#                   ever, but you pay ~$14/day on T4 (~$1-2/day on CPU).
# A cold start is ~20-40s; a warm one is ~2s.
# -----------------------------------------------------------------------------
GPU = "T4"


@app.function(
    image=image,
    gpu=GPU,
    scaledown_window=1200,
    min_containers=0,
    volumes={CACHE_DIR: model_cache},
    secrets=[modal.Secret.from_name("bioclip-auth")],
)
@modal.concurrent(max_inputs=2)
@modal.asgi_app()
def web():
    import os

    import torch
    from bioclip import Rank, TreeOfLifeClassifier
    from fastapi import FastAPI, HTTPException, Request
    from PIL import Image
    from rembg import new_session, remove

    token = os.environ["BIOCLIP_TOKEN"]
    device = "cuda" if torch.cuda.is_available() else "cpu"

    classifier = TreeOfLifeClassifier(device=device)

    # restrict predictions to species that occur in the US + Canada.
    # create_taxa_filter() raises if handed a name BioCLIP's tree doesn't know,
    # so intersect our list with BioCLIP's species column first.
    na_taxa = json.load(open("/na-taxa.json"))["taxa"]
    filter_status = {"applied": False, "kept": 0, "of": len(na_taxa)}
    try:
        species_col = Rank.SPECIES.get_label()
        known = set(classifier.get_label_data()[species_col].tolist())
        na_valid = [n for n in na_taxa if n in known]
        filter_status["kept"] = len(na_valid)
        if len(na_valid) < 5000:
            print(
                f"WARN: only {len(na_valid)}/{len(na_taxa)} NA taxa known to "
                "BioCLIP — running unfiltered"
            )
        else:
            classifier.apply_filter(
                classifier.create_taxa_filter(Rank.SPECIES, na_valid)
            )
            filter_status["applied"] = True
            print(f"taxa filter: kept {len(na_valid)}/{len(na_taxa)} NA species")
    except Exception as e:  # noqa: BLE001
        print(f"WARN: taxa filter failed ({e!r}) — running unfiltered")

    cutout = new_session("u2netp")

    def crop_to_subject(img: "Image.Image") -> "Image.Image":
        """Crop to the main subject's bounding box (padded). No-op if the
        segmentation is empty, tiny, or already fills the frame."""
        try:
            mask = remove(img, session=cutout, only_mask=True, post_process_mask=True)
            bbox = mask.getbbox()
            if not bbox:
                return img
            w, h = img.size
            bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
            frac = (bw * bh) / (w * h)
            if frac < 0.02 or frac > 0.9:
                return img
            px, py = int(bw * 0.12), int(bh * 0.12)
            box = (
                max(0, bbox[0] - px),
                max(0, bbox[1] - py),
                min(w, bbox[2] + px),
                min(h, bbox[3] + py),
            )
            return img.crop(box)
        except Exception:  # noqa: BLE001
            return img

    web_app = FastAPI()

    @web_app.get("/")
    def health():
        return {"ok": True, "model": "bioclip-2", "filter": filter_status}

    @web_app.post("/identify")
    async def identify(request: Request):
        if request.headers.get("authorization") != f"Bearer {token}":
            raise HTTPException(status_code=401, detail="bad token")

        body = await request.json()
        b64 = body.get("image")
        if not b64:
            raise HTTPException(status_code=400, detail="missing image")
        try:
            img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        except Exception:
            raise HTTPException(status_code=400, detail="bad image")

        k = int(body.get("k", 5))
        crop = crop_to_subject(img)
        preds = classifier.predict([crop], Rank.SPECIES, k=k)

        cropped = crop.size != img.size
        crop_b64 = None
        if cropped:
            buf = io.BytesIO()
            crop.save(buf, format="JPEG", quality=88)
            crop_b64 = base64.b64encode(buf.getvalue()).decode()

        return {
            "cropped": cropped,
            "croppedImage": crop_b64,
            "candidates": [
                {
                    "scientificName": p.get("species") or "",
                    "commonName": p.get("common_name") or None,
                    "order": p.get("order") or None,
                    "class": p.get("class") or None,
                    "score": float(p.get("score", 0.0)),
                }
                for p in preds
                if p.get("species")
            ],
        }

    return web_app
