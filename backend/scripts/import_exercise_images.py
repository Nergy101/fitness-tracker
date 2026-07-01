"""One-time importer: match our seed exercises to free-exercise-db and vendor images.

Fetches the free-exercise-db catalog, fuzzy-matches our SEED_EXERCISES names,
downloads the first image per match into frontend/public/exercise-images/, and
writes backend/exercise_images.json (committed). seed.py consumes that JSON, so
seeding stays offline and deterministic.

free-exercise-db (yuhonas/free-exercise-db) is public domain (Unlicense).

Run:  backend/.venv/bin/python scripts/import_exercise_images.py
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

# Allow running from repo root or backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seed import SEED_EXERCISES  # noqa: E402

CATALOG_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
IMAGE_DIR = REPO_ROOT / "frontend" / "public" / "exercise-images"
MAPPING_FILE = REPO_ROOT / "backend" / "exercise_images.json"
PUBLIC_PREFIX = "/exercise-images/"

# Hand-curated matches where fuzzy matching is wrong or misses. Maps our name ->
# exact free-exercise-db name.
OVERRIDES: dict[str, str] = {
    "Push-ups": "Pushups",
    "Pull-ups": "Pullups",
    "Chin-ups": "Chin-Up",
    "Squats": "Bodyweight Squat",
    "Lunges": "Bodyweight Walking Lunge",
    "Dumbbell Curls": "Dumbbell Bicep Curl",
    "Dumbbell Shoulder Press": "Standing Dumbbell Press",
    "Dumbbell Rows": "One-Arm Dumbbell Row",
    "Goblet Squats": "Goblet Squat",
    "Dumbbell Deadlifts": "Barbell Deadlift",
    "Dumbbell Lateral Raises": "Side Lateral Raise",
    "Dumbbell Tricep Extensions": "Standing Dumbbell Triceps Extension",
    "Mountain Climbers": "Mountain Climbers",
    "Glute Bridges": "Barbell Glute Bridge",
    "Bicycle Crunches": "Air Bike",
    "Calf Raises": "Standing Calf Raises",
    "High Knees": "Bench Sprint",
    "Diamond Push-ups": "Push-Ups - Close Triceps Position",
    "Pike Push-ups": "Pushups (Close and Wide Hand Positions)",
    "Hanging Leg Raises": "Hanging Leg Raise",
    "Inverted Rows": "Inverted Row",
    "Toe Touches": "Standing Toe Touches",
    "Jump Rope": "Rope Jumping",
    "Running in Place": "Jogging, Treadmill",
    "Dumbbell Thrusters": "Kettlebell Thruster",
    "Neck Rolls": "Neck-SMR",
    "Superman Hold": "Superman",
    "Cat-Cow Stretch": "Cat Stretch",
    "Side Plank": "Side Bridge",
    "Donkey Kicks": "Glute Kickback",
    "Standing Oblique Crunches": "Oblique Crunches",
    "Dumbbell Romanian Deadlifts": "Romanian Deadlift",
    "Reverse Crunches": "Reverse Crunch",
    "Heel Taps": "Alternate Heel Touchers",
}

# No acceptable free-exercise-db equivalent → fall back to the icon rather than
# ship a misleading image.
SKIP: set[str] = {"Archer Push-ups"}


def normalize(name: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace, singularize plural-ish tails."""
    s = re.sub(r"[^a-z0-9 ]", " ", name.lower())
    tokens = []
    for t in s.split():
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        tokens.append(t)
    return " ".join(tokens)


def token_set(name: str) -> set[str]:
    return set(normalize(name).split())


def best_match(our_name: str, catalog: list[dict]) -> tuple[dict | None, float]:
    """Return (entry, confidence 0..1). Exact-normalized > token-Jaccard."""
    target_norm = normalize(our_name)
    target_tokens = token_set(our_name)

    exact = [c for c in catalog if normalize(c["name"]) == target_norm]
    if exact:
        return exact[0], 1.0

    best, best_score = None, 0.0
    for c in catalog:
        ct = token_set(c["name"])
        if not ct or not target_tokens:
            continue
        jaccard = len(target_tokens & ct) / len(target_tokens | ct)
        # Prefer entries that contain all our tokens.
        contains_all = target_tokens.issubset(ct)
        score = jaccard + (0.25 if contains_all else 0.0)
        if score > best_score:
            best, best_score = c, score
    return best, min(best_score, 0.99)


def fetch_catalog() -> list[dict]:
    with urllib.request.urlopen(CATALOG_URL) as resp:
        return json.loads(resp.read().decode())


def download(url: str, dest: Path) -> bool:
    try:
        with urllib.request.urlopen(url) as resp:
            data = resp.read()
        dest.write_bytes(data)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"  ! download failed {url}: {exc}")
        return False


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> None:
    catalog = fetch_catalog()
    by_name = {c["name"]: c for c in catalog}
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    mapping: dict[str, str] = {}
    unmatched: list[str] = []
    low_conf: list[tuple[str, str, float]] = []

    for ex in SEED_EXERCISES:
        name = ex["name"]
        if name in SKIP:
            unmatched.append(name)
            continue
        entry = None
        if name in OVERRIDES:
            entry = by_name.get(OVERRIDES[name])
            if entry is None:
                print(f"  ! override target missing for {name!r}: {OVERRIDES[name]!r}")
        if entry is None:
            entry, conf = best_match(name, catalog)
            if entry is None or conf < 0.6:
                unmatched.append(name)
                continue
            if conf < 0.75:
                low_conf.append((name, entry["name"], round(conf, 2)))

        images = entry.get("images") or []
        if not images:
            unmatched.append(name)
            continue

        slug = slugify(name)
        dest = IMAGE_DIR / f"{slug}.jpg"
        if download(IMAGE_BASE + images[0], dest):
            mapping[name] = f"{PUBLIC_PREFIX}{slug}.jpg"

    MAPPING_FILE.write_text(json.dumps(mapping, indent=2, sort_keys=True) + "\n")

    print(f"\nMatched {len(mapping)}/{len(SEED_EXERCISES)} exercises.")
    print(f"Mapping → {MAPPING_FILE}")
    print(f"Images  → {IMAGE_DIR}")
    if low_conf:
        print("\nLow-confidence matches (review / add to OVERRIDES):")
        for our, theirs, conf in low_conf:
            print(f"  {our!r} -> {theirs!r} ({conf})")
    if unmatched:
        print(f"\nUnmatched ({len(unmatched)}) — will fall back to icon:")
        for n in unmatched:
            print(f"  {n}")


if __name__ == "__main__":
    main()
