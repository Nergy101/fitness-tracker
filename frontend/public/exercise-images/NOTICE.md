# Exercise images

These images are sourced from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
by yuhonas, released into the public domain under the [Unlicense](https://unlicense.org/).

They are vendored here (rather than hotlinked) so the app works fully offline as a
PWA. To refresh or extend the set, run:

    backend/.venv/bin/python backend/scripts/import_exercise_images.py

which re-matches `backend/seed.py`'s `SEED_EXERCISES` against the upstream catalog,
downloads the first image per match, and rewrites `backend/exercise_images.json`.
