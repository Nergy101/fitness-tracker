# FitnessTracker

A timed-workout tracker PWA. Build circuit workouts, run them with an
audio-guided timer, and review your history. Backend is FastAPI + SQLite;
frontend is a React + Vite installable PWA that works offline.

## Features

- **Workouts** — reusable circuit templates with per-exercise durations,
  configurable **rounds**, and a selectable **rest between rounds**. Cards show
  a clear **work / rest / total** time breakdown.
- **Timed runner** — full-screen guided timer with a get-ready countdown,
  progress ring, exercise image + description, round tracking, and a **Skip**
  button. Distinct **audio cues** for exercise start / rest / finish, plus
  **text-to-speech** announcing the next exercise. Everything is mutable.
- **Exercises** — 76 seeded exercises (cardio, calisthenics, dumbbell,
  flexibility) with images sourced from
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public
  domain), searchable and filterable by category.
- **History** — look back by range (this week / last 7 / last 30 days), a
  weekday bar chart and a GitHub-style contribution heatmap, an all-time view,
  and **JSON import / export** of your sessions.
- **PWA** — installable, offline-capable (service worker precache), with a
  light/dark theme toggle, audio mute, and a selectable date format (D/M or
  M/D) — all reachable during a workout too.

## Quick start

Requires `python3`, `node`/`npm`, and `make`.

```bash
make        # sets up a venv + node deps, seeds the DB, starts both servers, opens the app
```

That's it — `make` (the default target) brings up the backend on `:8000`, the
frontend on `:5173`, and opens the browser. Ports are configurable:

```bash
make FRONTEND_PORT=5210 BACKEND_PORT=8010
```

## Make targets

| Target | Description |
| --- | --- |
| `make` / `make run` | Set up, seed, start backend + frontend, open the app |
| `make setup` | Install backend (venv) + frontend deps |
| `make seed` | Seed the exercise catalog + starter workouts (idempotent) |
| `make seed-fake-history` | Seed example workout history for demos |
| `make remove-fake-history` | Delete all workout sessions |
| `make build` | Production build of the frontend |
| `make e2e` | Run the Playwright end-to-end suite |
| `make clean` | Remove venv, node_modules, build output, and the DB |
| `make help` | List all targets |

## Docker

Run the published images (frontend on `:8080`, backend on `:8000`):

```bash
docker compose up
```

`docker-compose.yml` pins the pushed `:latest` images from GHCR and includes
`build:` sections so you can build and push those same tags:

```bash
docker compose build
docker compose push        # requires: docker login ghcr.io
```

Override the registry, tag, or ports with env vars:

```bash
REGISTRY=ghcr.io/you TAG=v1 FRONTEND_PORT=3000 docker compose up
```

> The frontend's API URL is baked in at build time (`VITE_API_URL`, default
> `http://localhost:8000`). For a non-local deploy, rebuild with
> `--build-arg VITE_API_URL=https://your-api`.

### CI

`.github/workflows/docker-publish.yml` builds and pushes both images to GHCR
(`:latest` + short-SHA tags) on every push to `main`.

## Development

```bash
make setup          # one-time: venv + node deps
make run-backend    # FastAPI with hot reload  (http://localhost:8000, docs at /docs)
make run-frontend   # Vite dev server          (http://localhost:5173)
```

The backend auto-creates tables and applies additive migrations on startup, and
seeding is idempotent — safe to re-run.

### Exercise images

Images are vendored into `frontend/public/exercise-images/` so the app works
offline. To refresh or extend them after changing the seed data:

```bash
backend/.venv/bin/python backend/scripts/import_exercise_images.py
```

This re-matches the seed exercises against free-exercise-db, downloads the
matches, and rewrites `backend/exercise_images.json` (consumed by the seeder).

## Testing

```bash
make e2e     # Playwright: boots an isolated backend + frontend, runs the suite
```

The suite covers workouts/rounds, the timed runner and Skip, exercise images,
category filters, the theme toggle, and history range/import/export.

## Project structure

```
backend/            FastAPI app
  app/
    main.py         app + CORS + startup migrations
    models/         SQLAlchemy models
    routers/        exercises, workouts, sessions
    schemas.py      Pydantic schemas
  seed.py           exercise catalog + starter workouts
  scripts/          image importer, fake-history seeder
  Dockerfile
frontend/           React + Vite PWA
  src/
    api.ts          typed API client
    components/      tabs, runner, editor, controls
    sound.ts        audio cues + TTS
  e2e/              Playwright tests
  Dockerfile, nginx.conf
docker-compose.yml
Makefile
```

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, SQLite, Uvicorn
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, vite-plugin-pwa,
  Phosphor icons
- **Tooling:** Playwright, Docker, GitHub Actions
