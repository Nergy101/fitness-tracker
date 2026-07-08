# FitnessTracker

A complete fitness PWA — track workouts, runs, health metrics, and wellness. Works on any device. Installable, offline-capable, dark/light theme.

**Live:** [fitness.nergy.space](https://fitness.nergy.space)

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 (frontend) · FastAPI + SQLAlchemy + SQLite + Alembic (backend) · Docker Compose + Nginx · GitHub Actions CI/CD

## Features

### Workouts
- **76 seeded exercises** with images (cardio, calisthenics, dumbbell, flexibility)
- **Circuit templates** with per-exercise durations, configurable rounds, rest between rounds
- **Warmup & cooldown phases** with separate timers
- **Full-screen runner** — progress ring, exercise image, audio cues + text-to-speech
- Skip, pause, and real-time duration editing during workouts

### Run Tracking
- Log distance runs with GPS, duration, pace, and notes
- Run stats: total distance, best pace, average pace

### History & Stats
- Session history with date range filtering (this week, last 7/30 days, all time)
- Weekday bar chart + GitHub-style contribution heatmap
- JSON import/export of sessions
- Stats overview: total sessions, hours, kcal, streak tracking

### Health & Wellness
- **Weight tracking** with charts, goal progress bar, BMI calculator
- **Personal records** across weight, measurements, and performance
- **Body measurements** (waist, hips, chest, arms, thighs, neck) with before/after deltas
- **Daily wellness check-ins** — mood, energy, stress, sleep hours — 8-week trends
- **Health score** (0-100) from BMI, workout consistency, streak, measurements
- **Apple Health import** — workouts + metrics from exported ZIP

### PWA & UX
- Installable on iOS/Android/desktop with service worker precache
- Offline banner + ErrorBoundary for resilience
- Light/dark theme toggle, audio mute, selectable date format (D/M or M/D)
- Push notification support (Web Push API)
- Settings: health profile, backup/restore, notifications, Apple Health import

## Quick start

```bash
make        # venv + node deps, seed DB, start backend + frontend, open browser
```

Ports are configurable:
```bash
make FRONTEND_PORT=5210 BACKEND_PORT=8010
```

## Docker

```bash
docker compose up
```

Then open **http://localhost:8080**. The frontend proxies `/api` to the backend over an internal Docker network — no CORS, no API URL to configure.

`docker-compose.yml` pins `:latest` images from GHCR with `build:` sections for local builds:

```bash
docker compose build
docker compose push        # requires: docker login ghcr.io
```

## CI/CD

`.github/workflows/docker-publish.yml` runs on every push to `main`:

```
lint → unit tests → E2E (Playwright) → Docker build/push (multi-arch) → deploy via SSH
```

## Development

```bash
make setup          # one-time: venv + node deps
make run-backend    # FastAPI with hot reload (http://localhost:8000, docs at /docs)
make run-frontend   # Vite dev server (http://localhost:5173)
```

The backend auto-creates tables and applies Alembic migrations on startup. Seeding is idempotent.

## Testing

```bash
make e2e     # Playwright: boots isolated backend + frontend, runs the suite
```

Backend unit tests:
```bash
cd backend && python -m pytest tests/ -v
```

## Project structure

```
backend/               FastAPI app
  app/
    main.py            app + CORS + startup migrations
    models/            SQLAlchemy models (14 tables)
    routers/           exercises, workouts, sessions, stats, runs, health, backup, notifications
    schemas.py         Pydantic schemas
  alembic/             5 migrations with forward/backward validation
  seed.py              exercise catalog + starter workouts
  scripts/             image importer, fake-history seeder, migration validator
  Dockerfile
frontend/              React + Vite PWA
  src/
    api.ts             typed API client
    components/        tabs, runner, editor, health, settings, controls
    sound.ts           audio cues + TTS
  e2e/                 Playwright tests
  Dockerfile, nginx.conf
docker-compose.yml
Makefile
```