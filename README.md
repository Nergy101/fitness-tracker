# FitnessTracker

A complete fitness PWA — track workouts, runs, walks, boxing, health metrics, and wellness. Works on any device. Installable, offline-capable, dark/light theme.

**Live:** [fit.nergy.space](https://fit.nergy.space)

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 (frontend) · FastAPI + SQLAlchemy + SQLite + Alembic (backend) · Docker Compose + Nginx · GitHub Actions CI/CD

## Features

### Workouts
- **195 seeded exercises** with images — 37 cardio, 116 strength, 42 flexibility
- **5 circuit templates** (Basic, Calisthenics, Beginner Calisthenics, Cardio, Dumbbells) with per-exercise durations, configurable rounds, rest between rounds
- **Tabata mode** — fixed 20s work / 10s rest intervals per round
- **Warmup & cooldown phases** with separate timers
- **Full-screen runner** — progress ring, exercise image, audio cues + text-to-speech
- Skip, pause, and real-time duration editing during workouts

### Run & Walk Tracking
- Log runs and walks with distance, duration, pace, and randomized note prompts
- Run stats: total distance, best pace, average pace
- Walk stats: total distance, total hours

### Boxing Tracking
- Log boxing sessions with duration, rounds, kcal/min, and notes
- Boxing stats: total sessions, hours, kcal, PRs, monthly breakdown, trend charts

### History & Stats
- Session history with date range filtering (7 Days, 30 Days, This week, Calendar)
- Activity-colored left border on session cards (orange/blue/green/red)
- Weekday bar chart + GitHub-style contribution heatmap (30-day)
- JSON import/export of sessions
- Stats overview: total sessions, hours, kcal, streak tracking

### Health & Wellness
- **Weight tracking** with charts, goal progress bar, BMI calculator
- **Personal records** across weight, measurements, performance, runs, walks, boxing
- **Body measurements** (waist, hips, chest, arms, thighs, neck) with before/after deltas
- **Daily wellness check-ins** — mood, energy, stress, sleep hours — 8-week trends
- **Health score** (0-100) from BMI, workout consistency, streak, measurements
- **Apple Health import** — workouts + metrics from exported ZIP, Workout Intensity scatter chart

### PWA & UX
- Installable on iOS/Android/desktop with service worker precache
- Swipe left/right to navigate between tabs with native-feel slide animation
- Pill-shaped active indicator on bottom nav
- Loading skeleton states on all tabs
- Offline banner + ErrorBoundary for resilience
- Light/dark theme toggle, audio mute, selectable date format (D/M or M/D)
- Push notification support (Web Push API)
- Settings: health profile, backup/restore, notifications, Apple Health import

## Entity Relationship Diagram

```mermaid
erDiagram
    Exercise ||--o{ WorkoutTemplateExercise : "included in"
    Exercise ||--o{ SessionExercise : "logged as"
    WorkoutTemplate ||--o{ WorkoutTemplateExercise : contains
    WorkoutTemplate ||--o{ WorkoutSession : "creates"
    WorkoutSession ||--o{ SessionExercise : contains
    SessionExercise ||--o{ ExerciseLog : "sets logged"
    RunEntry ||--o| WorkoutSession : "mirrors to"
    BoxingEntry ||--o| WorkoutSession : "mirrors to"

    Exercise {
        int id PK
        string name
        string description
        string category "cardio|strength|flexibility|other"
        float default_kcal_per_min
        int default_duration_seconds
        string image_url
    }

    WorkoutTemplate {
        int id PK
        string name
        string description
        string mode "circuit|amrap|emom|tabata"
        int rounds
        int rest_between_rounds
        int warmup_seconds
        int cooldown_seconds
        bool is_pinned
    }

    WorkoutTemplateExercise {
        int id PK
        int template_id FK
        int exercise_id FK
        int duration_seconds
        int order_index
    }

    WorkoutSession {
        int id PK
        int template_id FK
        string template_name
        int run_entry_id FK
        int boxing_entry_id FK
        datetime started_at
        int total_duration_seconds
        float total_kcal_estimated
        text notes
    }

    SessionExercise {
        int id PK
        int session_id FK
        int exercise_id FK
        string exercise_name
        int duration_seconds
        float kcal_burned
        bool completed
    }

    ExerciseLog {
        int id PK
        int session_exercise_id FK
        float weight_kg
        int reps
        int set_number
    }

    RunEntry {
        int id PK
        int duration_seconds
        float distance_km
        float pace_per_km
        string run_type "run|walk"
        date date
        text notes
    }

    BoxingEntry {
        int id PK
        int duration_seconds
        float kcal_per_min
        int rounds
        date date
        text notes
    }

    UserProfile {
        int id PK
        float height_cm
        date birthday
        string gender
        float goal_weight_kg
        time reminder_time
    }

    WeightEntry {
        int id PK
        float weight_kg
        date date
        text notes
    }

    BodyMeasurement {
        int id PK
        date date
        float waist_cm
        float hips_cm
        float chest_cm
        float left_arm_cm
        float right_arm_cm
        float left_thigh_cm
        float right_thigh_cm
        float neck_cm
    }

    WellnessCheckin {
        int id PK
        date date
        int mood "1-5"
        int energy "1-5"
        int stress "1-5"
        float sleep_hours
    }

    HealthMetric {
        int id PK
        string metric_name
        date date
        string units
        float qty
        text data
    }

    HealthWorkout {
        int id PK
        string external_id UK
        string name
        datetime start
        datetime end
        float duration_seconds
        float distance_km
        float active_energy_kj
        float avg_heart_rate
    }
```

## CI/CD Pipeline

```mermaid
graph LR
    A[Push to main] --> B[Lint<br/>ruff + eslint]
    B --> C[Backend Tests<br/>258 pytest]
    B --> D[Frontend Tests<br/>tsc + vitest 122]
    C --> E[E2E Tests<br/>Playwright 38]
    D --> E
    E --> F[Docker Build<br/>multi-arch amd64 + arm64]
    F --> G[Push to GHCR]
    G --> H[Deploy via SSH<br/>docker compose pull + up]
```

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
lint (ruff + eslint) → backend tests (258) → frontend type-check + vitest (122) → E2E (Playwright, 38) → Docker build/push (multi-arch) → deploy via SSH
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
cd backend && .venv/bin/python -m pytest tests/ -v   # 258 tests
```

Frontend unit tests:
```bash
cd frontend && npx vitest run                         # 122 tests
```

## Project structure

```
backend/               FastAPI app
  app/
    main.py            app + CORS + startup migrations
    models/            SQLAlchemy models (14 tables)
    routers/           exercises, workouts, sessions, stats, runs, boxing, health, backup, auth, notifications, health_import
    schemas.py         Pydantic schemas
  alembic/             7 migrations with forward/backward validation
  seed.py              195 exercises + 5 starter workouts
  scripts/             image importer, fake-history seeder, migration validator
  Dockerfile
frontend/              React + Vite PWA
  src/
    api.ts             typed API client
    components/        tabs, runner, editor, health, stats, history, settings, controls
    sound.ts           audio cues + TTS
  e2e/                 Playwright tests (38)
  Dockerfile, nginx.conf
docker-compose.yml
Makefile
```
