"""
generate_images.py  –  Bulletproof Vertex AI image generator for JFT exams.

Features:
  • Scans ALL exams (or a list of specified ones) and skips already-generated images.
  • UNLIMITED retries on 429 Rate-Limit errors with exponential + jitter back-off.
  • Handles transient network errors automatically.
  • Logs a summary at the end showing totals and any permanent failures.
  • Safe to run overnight – will just keep waiting and retrying until Vertex quota resets.

Usage:
  python generate_images.py               # process every exam
  python generate_images.py jft1 jft2     # process specific exams
"""

import json
import sys
import base64
import time
import random
import urllib.request
import urllib.error
from pathlib import Path
from google.oauth2 import service_account
from google.auth.transport.requests import Request

# ── Configuration ─────────────────────────────────────────────────────────────
SERVICE_ACCOUNT_FILE = r"c:\Users\boktiarshakil\project\jft\nihongo-pathway-8b5926fad51e.json"
PROJECT_ID  = "nihongo-pathway"
LOCATION    = "us-central1"
MODEL_ID    = "imagen-3.0-generate-002"

BASE_DIR  = Path(__file__).parent
EXAMS_DIR = BASE_DIR / "exams"

# Delays (seconds)
REQUEST_DELAY      = 2      # polite pause between successful generations
RATE_LIMIT_BASE    = 60     # base wait on 429 (grows with each consecutive 429)
MAX_RATE_LIMIT_WAIT = 300   # never wait more than 5 min per single retry
MAX_RETRIES        = 999    # effectively unlimited – we wait out quota resets

# ── Auth ──────────────────────────────────────────────────────────────────────
_creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

def get_token() -> str:
    if not _creds.valid:
        _creds.refresh(Request())
    return _creds.token

# ── REST endpoint ─────────────────────────────────────────────────────────────
PREDICT_URL = (
    f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}"
    f"/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:predict"
)

# ── Image Generation (bulletproof) ────────────────────────────────────────────
def generate_image_for_query(prompt: str, output_path: Path) -> bool:
    """Try indefinitely (up to MAX_RETRIES) to generate and save one image."""
    print(f"  [GEN] {output_path.name}...")
    consecutive_429 = 0

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            body = json.dumps({
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1}
            }).encode("utf-8")

            req = urllib.request.Request(
                PREDICT_URL,
                data=body,
                headers={
                    "Authorization": f"Bearer {get_token()}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())

            predictions = data.get("predictions", [])
            if not predictions:
                print(f"  [WARN] No predictions returned – retrying in {REQUEST_DELAY}s...")
                time.sleep(REQUEST_DELAY)
                continue

            img_b64 = predictions[0].get("bytesBase64Encoded", "")
            if not img_b64:
                print(f"  [WARN] Empty image bytes – retrying in {REQUEST_DELAY}s...")
                time.sleep(REQUEST_DELAY)
                continue

            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(img_b64))

            print(f"  [OK]  Saved: {output_path.name}")
            consecutive_429 = 0
            time.sleep(REQUEST_DELAY)
            return True

        except urllib.error.HTTPError as e:
            body_text = ""
            try:
                body_text = e.read().decode("utf-8")[:300]
            except Exception:
                pass

            if e.code == 429:
                consecutive_429 += 1
                # Exponential back-off with jitter, capped at MAX_RATE_LIMIT_WAIT
                wait = min(RATE_LIMIT_BASE * consecutive_429 + random.uniform(0, 10),
                           MAX_RATE_LIMIT_WAIT)
                print(f"  [429] Rate limit hit (attempt {attempt}) – waiting {wait:.0f}s...")
                time.sleep(wait)
                # Refresh token after long waits
                try:
                    _creds.refresh(Request())
                except Exception:
                    pass

            elif e.code in (500, 503):
                wait = 15 + random.uniform(0, 5)
                print(f"  [ERROR] HTTP {e.code} server error – retrying in {wait:.0f}s...")
                time.sleep(wait)

            else:
                print(f"  [ERROR] HTTP {e.code}: {body_text} – skipping.")
                return False

        except (urllib.error.URLError, TimeoutError, OSError) as e:
            wait = 10 + random.uniform(0, 5)
            print(f"  [NET]  Network error: {e} – retrying in {wait:.0f}s...")
            time.sleep(wait)

        except Exception as e:
            print(f"  [UNEXPECTED] {e} – retrying in 10s...")
            time.sleep(10)

    print(f"  [FAIL] Gave up after {MAX_RETRIES} attempts for {output_path.name}.")
    return False

# ── Exam Processing ───────────────────────────────────────────────────────────
def process_exam(exam_id: str) -> tuple[int, int, int]:
    """Returns (generated, skipped, failed) counts."""
    exam_dir   = EXAMS_DIR / exam_id
    data_path  = exam_dir / "data.json"
    images_dir = exam_dir / "images"

    if not data_path.exists():
        return 0, 0, 0

    images_dir.mkdir(parents=True, exist_ok=True)

    with open(data_path, encoding="utf-8") as f:
        exam = json.load(f)

    title = exam.get("title", "No Title")
    print(f"\nProcessing: {exam_id} – {title}")

    generated = skipped = failed = 0

    for section in exam.get("sections", []):
        for q in section.get("questions", []):
            if "image" not in q or "imagePrompt" not in q:
                continue
            img_path = images_dir / q["image"]
            if img_path.exists() and img_path.stat().st_size > 1000:
                skipped += 1
                continue
            ok = generate_image_for_query(q["imagePrompt"], img_path)
            if ok:
                generated += 1
            else:
                failed += 1

    if generated:
        print(f"  --> {generated} new image(s) saved.")
    elif skipped and not failed:
        print(f"  --> All images already present ({skipped} skipped).")

    return generated, skipped, failed

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if not EXAMS_DIR.exists():
        print("Error: 'exams/' directory not found.")
        return

    print(f"Project : {PROJECT_ID}")
    print(f"Model   : {MODEL_ID}")
    print(f"Mode    : BULLETPROOF (unlimited rate-limit retries)\n")

    target_exams = sys.argv[1:]
    if target_exams:
        exam_list = target_exams
    else:
        exam_list = sorted(
            d.name for d in EXAMS_DIR.iterdir()
            if d.is_dir() and (d / "data.json").exists()
        )
        print(f"Found {len(exam_list)} exam(s) to process.\n")

    total_gen = total_skip = total_fail = 0
    start = time.time()

    for eid in exam_list:
        g, s, f = process_exam(eid)
        total_gen  += g
        total_skip += s
        total_fail += f

    elapsed = int(time.time() - start)
    print("\n" + "=" * 50)
    print(f"DONE in {elapsed // 60}m {elapsed % 60}s")
    print(f"  Generated : {total_gen}")
    print(f"  Skipped   : {total_skip}  (already existed)")
    print(f"  Failed    : {total_fail}  (permanent errors)")
    print("=" * 50)

if __name__ == "__main__":
    main()
