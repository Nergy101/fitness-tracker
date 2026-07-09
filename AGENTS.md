# AGENTS.md — FitnessTracker

## Project Overview

- **Stack**: React 19 + TypeScript + Vite + Tailwind v4, FastAPI + SQLAlchemy + SQLite
- **PWA** with iOS safe-area support, light/dark theme, push notifications
- **Repo**: `github.com/Nergy101/fitness-tracker` (direct to main, no feature branches)
- **Production**: `https://fit.nergy.space` (auto-deploy on push to main via Docker Compose + SSH)
- **Linear**: Team "Nergy" (NER-XXX), project "FitnessTracker"
- **Commit style**: `🔖 type(NER-XXX): description` or `🐛 fix:` / `🔖 feat:` for non-Linear changes

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Testing — Always Run These Before Committing

| Suite | Command | Notes |
|-------|---------|-------|
| **Backend** | `cd backend && .venv/bin/python -m pytest tests/` | ~205 tests, in-memory SQLite |
| **TypeScript** | `cd frontend && npx tsc --noEmit` | Must be clean |
| **Vitest** | `cd frontend && npx vitest run` | ~55 tests |
| **Build** | `cd frontend && npm run build` | PWA output, must pass |
| **E2E** | `cd frontend && fuser -k 8100/tcp 5299/tcp; npx playwright test` | Kill stale servers first |

**Critical rule**: When logic changes, check if corresponding tests need updating.
The CI runs all suites — a test that passed locally but fails in CI means you
forgot to update it.

## Theme System — NEVER use hardcoded colors

The app uses CSS variables mapped to Tailwind utilities:

- `text-fg` → adapts to theme (dark: #fff, light: #1e1e2e)
- `bg-bg` / `bg-surface` → adapt to theme
- `bg-accent` / `text-accent` → brand orange

**NEVER use `text-white`, `bg-white`, `text-black`, or `bg-black` for primary content.**
`text-white` is invisible on light theme. The ONLY exceptions:
- `bg-black/60` — modal backdrops
- `bg-yellow-500/90 text-black` — offline banner
- `bg-accent text-on-accent` — accent buttons

## iOS Safe Area

Any `fixed top-0` element must include `pt-[calc(env(safe-area-inset-top,0px)+8px)]`.
Fullscreen overlays (WorkoutRunner, session detail, swap picker) need:
```jsx
style={{ paddingTop: "max(env(safe-area-inset-top), 68px)" }}
```

## Backend Patterns

### Adding a new model (full-stack feature)

1. **models.py** — new `Base` subclass with Columns
2. **schemas.py** — `XxxCreate` + `XxxResponse` (with `from_attributes = True`)
3. **Alembic migration** — `cd backend && .venv/bin/alembic revision --autogenerate -m "description"`
   - Review the generated migration for correctness
   - Verify: `DATABASE_URL=sqlite:////tmp/test.db .venv/bin/alembic upgrade head`
   - **Never** use `create_all()` or `drop_all()` in app code
4. **Router** — add to most logical existing router; avoid creating new router files for single-model features
5. **Register** in `main.py` — import + `app.include_router()`
6. **Tests** — update any tests affected by new tables (especially `test_migrations.py` which uses `Base.metadata.create_all` for pre-Alembic adoption tests — new post-baseline tables need to be dropped in those tests)
7. **Frontend** — types in `api.ts`, API methods, component, wire up

### Run/walk mirror pattern

Runs/walks create a mirror `WorkoutSession` with `"Run: X.Xkm"` / `"Walk: X.Xkm"` template_name.
The `is_run_mirror()` helper excludes these from workout stats so runs/walks aren't double-counted.
If adding a new activity type that mirrors into sessions, update `is_run_mirror()` accordingly.

### total_duration_seconds — keep in sync across 3 locations

When adding workout phases (warmup, cooldown, etc.), the total duration computation lives in:
1. Backend `_build_template_response()` in `routers/workouts.py`
2. Frontend `WorkoutRunner.tsx` — `totalDuration` memo
3. Frontend `WorkoutTab.tsx` — `logWorkout()` function

Missing any one means saved sessions have wrong totals.

## Frontend Patterns

### Activity types

Defined in `activity.tsx`: `ActivityKind = "workout" | "run" | "walk"`.
`activityKind(templateName)` returns the kind based on session name prefix.
Colors and icons are centralized in `ACTIVITY_COLORS` / `ACTIVITY_ICONS`.

### Streak logic (2-day gap)

Streaks allow at most 1 rest day between activity days. Mon + Wed = 3-day streak (Mon+rest+Tue+Wed).
A 2-day gap breaks the streak. Both weight logging streaks and activity streaks use this rule.
If changing streak logic, update BOTH `_longest_streak()` AND `weight_streak()` in `health.py`,
plus any streak tests in `test_prs.py`.

### Pre-commit checklist

```bash
# Backend changes
cd backend && ruff check . && .venv/bin/python -m pytest tests/

# Frontend changes
cd frontend && npx tsc --noEmit && npx vitest run && npm run build

# Watch for runtime artifacts before git add
git status  # check for backup_config.json, backups/*.json
```

## E2E Test Gotchas

- Kill stale servers: `fuser -k 8100/tcp 5299/tcp` before running E2E
- Settings modal pills vs nav buttons: use `button.rounded-full` for pills, not `getByRole`
- `toBeHidden()` doesn't detect `opacity-0` — use conditional rendering instead
- Use `aria-label` over `getByTitle` for testability
- Strict mode violations: use `.first()` or more specific locators when text matches multiple elements
- Prefer `{ exact: true }` for phase labels that share text with buttons

## Alembic Migration Workflow

```bash
cd backend
# Apply existing migrations
.venv/bin/alembic upgrade head
# Generate new one
.venv/bin/alembic revision --autogenerate -m "description"
# Verify
DATABASE_URL=sqlite:////tmp/verify.db .venv/bin/alembic upgrade head
# Check downgrade works
DATABASE_URL=sqlite:////tmp/verify.db .venv/bin/alembic downgrade -1
```

After `git pull --rebase`, check for new remote migrations that share your `down_revision`.
If both fork from the same parent, update yours to point at the new one.

## Pitfalls

- **`git add -A` stages runtime artifacts** — check `git status` before commit
- **Alembic package shadowing** — the local `alembic/` directory shadows the installed package;
  use `.venv/bin/alembic` not `python -m alembic`
- **`patch` tool can corrupt nested Python/JSX blocks** — verify after patching, prefer `write_file` for large changes
- **stat/summary cards** — use the `StatCard` component for consistency
- **Weight unit** — always kg internally, conversion to lbs is display-only
- **Dates** — use the `DateField` coerce type in Pydantic schemas for optional date fields
