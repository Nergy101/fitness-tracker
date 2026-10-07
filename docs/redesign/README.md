# FitnessTracker redesign — "Bento Mosaic"

Handoff package for implementing the redesign in `frontend/`. Read this file
first, then open `index.html` (all screens side by side) or the PNGs.

Every number, name and date in the mocks is **sample data**. Wire the real
values from the existing API calls; do not copy the sample values.

## What's in here

| Path | What it is |
|------|------------|
| `index.html` | Gallery of every screen (open in a browser) |
| `png/` | 2× screenshots of each screen. Files under `more/` show light and dark side by side |
| `html/` | The same screens as standalone static HTML. Open one to inspect exact sizes, colors and spacing in devtools |
| `source/` | The original design files (`.dc.html`) and `canvas.json` layout, for reference only |

The design target is the **Bento Mosaic** set: `app/*` and `more/*`.
`Bento*.png` at the top level are earlier explorations (Bento, Bento Pulse,
Mosaic/Stack/Mono variations), kept for context. Implement `app/` + `more/`.

## Design direction

- **Logging first.** The home tab becomes **Today**: a mosaic of tinted
  activity tiles with one-tap presets (Run 3/5/10 km, Walk +30 min, Ride
  +45 min, Box +6 rounds) plus a Workout tile that opens templates. Starting a
  template is secondary.
- **Bento tiles.** Content lives in rounded tiles (26–28px radius) on a soft
  grey ground. Each activity has a tinted tile color (light: pastel bg +
  dark text; dark: deep bg + light text).
- **One accent.** A yellow accent (`#ffd23f`) marks the primary action on
  every screen (Save, Start, active nav item). Text on it is always dark.
- **Floating pill nav.** The bottom nav is a dark rounded pill, inset from the
  edges, icons only; the active tab is an accent pill.
- **Sheets for input.** Every logger (run/walk, ride, boxing, weight +
  check-in, injury, measurements) is a bottom sheet with a grabber, a tinted
  icon + title, big numeric steppers, quick-pick chips, a live preview tile
  and one full-width Save button.

## Tokens

The app already maps CSS variables to Tailwind utilities in
`frontend/src/index.css` (`bg-bg`, `bg-surface`, `text-fg`, `bg-accent`,
`text-on-accent`, `--track`). Keep that system and **update/add variables**.
Do not hardcode hex values in components (see AGENTS.md "Theme System").

### Core

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#f1f2f6` | `#111118` | Page ground |
| `--surface` | `#ffffff` | `#1c1c26` | Neutral tiles, sheets |
| `--fg` | `#1b1b24` | `#f1f1f6` | Primary text |
| `--muted` (new) | `#5a5b6b` | `#a3a4b5` | Secondary text, labels |
| `--track` | `#e9eaef` | `#2c2c3a` | Dividers, empty bars, ring tracks |
| `--field` (new) | `#f1f2f6` | `#262633` | Input / stepper / chip fill inside a surface |
| `--accent` | `#ffd23f` | `#ffd23f` | Primary buttons, active nav |
| `--on-accent` | `#1b1b24` | `#1b1b24` | Text/icons on accent |
| `--inverse` (new) | `#1b1b24` | `#f1f1f6` | Selected chips/segments ("Today", "8W") |
| `--on-inverse` (new) | `#ffffff` | `#111118` | Text on inverse |
| `--nav` (new) | `#1b1b24` | `#26263a` | Floating nav pill |
| `--nav-icon` (new) | `#b8b9c8` | `#a3a4b5` | Inactive nav icons |
| `--scrim` (new) | `rgba(20,20,32,.5)` | `rgba(0,0,0,.62)` | Sheet/dialog backdrop |

The accent is a tweakable choice in the mocks; the alternatives tried were
`#7ee0a8`, `#ff9d6b` and `#9fc5ff`. Confirm with the owner before shipping
if the current green brand accent (`#27855b`) should stay instead.

### Activity tints

Keep `ACTIVITY_COLORS` in `frontend/src/activity.tsx` for charts (bars,
lines, legend dots). Add a tint set per kind for tiles, chips and icon badges:

| Kind | Chart color | Light tile bg / fg / chip | Dark tile bg / fg / chip |
|------|-------------|---------------------------|--------------------------|
| run | `#38bdf8` | `#d4f0ff` / `#0b3a52` / `#ffffff` | `#0f2a36` / `#bfe8fb` / `#17394a` |
| walk | `#4ade80` | `#d6f5e0` / `#0e4425` / `#ffffff` | `#10291a` / `#c4f5d4` / `#173a25` |
| cycling | `#a78bfa` | `#e7e0ff` / `#33206e` / `#ffffff` | `#251c44` / `#e7e0ff` / `#33285a` |
| boxing | `#f87171` | `#ffdede` / `#6b1616` / `#ffffff` | `#2e1414` / `#ffd0d0` / `#451e1e` |
| workout | `#fb923c` | `#ffd9bf` / `#5a2106` / `#ffffff` | `#3a1f10` / `#ffd9bf` / `#4d2a15` |

Extra semantic tints used on Health/Stats: blue (consistency, BMI, rest
screen) light `#d6e8ff`/`#0b2a52` (bar `#2563c9`), dark `#13263f`/`#d6e8ff`
(bar `#60a5fa`); purple doubles as the weight color.

Suggested shape: CSS variables `--tint-run-bg`, `--tint-run-fg`,
`--tint-run-chip`, … flipped under `.dark`, plus an `ACTIVITY_TINTS` map
(or Tailwind theme entries like `bg-tint-run`) so tiles never branch on
theme in JS.

### Type, shape, spacing

- **Font:** Bricolage Grotesque (Google Fonts, weights 400/600/800,
  `opsz` axis). Self-host it for the PWA/offline. Body stays the same family.
- **Scale:** screen title 30–32/800, tile title 20–24/800, hero numbers
  36–64/800 with `letter-spacing: -0.03em…-0.04em`, body 14–16, labels 12–13/600–700.
- **Radii:** tiles 26–28px, sheets 32px top corners, inputs/steppers 18–24px,
  chips/pills fully rounded.
- **Spacing:** 16px page gutter, 10px between tiles, 12–14px inside sheets,
  tile padding 14–16px.
- **Targets:** every interactive control is ≥ 40px, primary buttons 56px.
- **Icons:** keep Phosphor (`@phosphor-icons/react`); the mocks use simple
  stroke icons as stand-ins.

## Shared components to build

| Component | Where it appears |
|-----------|------------------|
| `Tile` (variant: surface / tint kind / inverse / accent) | Everywhere |
| `BottomSheet` (grabber, icon + title, close, scrim) | All loggers, session/exercise detail, swap picker |
| `NumberStepper` (− value unit +, inputmode numeric) + `QuickPicks` chips row | Distance and duration in run/ride/boxing, weight, reps/kg in runner |
| `Segmented` (pill group; inverse = selected) | Run/Walk, range 7D/8W/6M/1Y, theme, date format, intensity |
| `PreviewTile` (2–3 live computed stats) | Pace/speed/kcal in loggers |
| `DateChips` (Today / Yesterday / calendar) | Every logger |
| `FloatingNav` | App shell (replaces current bottom nav) |
| `StatTile` | Extend existing `StatCard`/`health/StatCard.tsx` |
| `ChartTile` | Wrap existing `ChartCard` with the tile style |
| `Toast` / banners / confirm dialog | `more/States` |

## Screen → code mapping

| Mock | Replaces / restyles |
|------|---------------------|
| `app/Today` | `WorkoutTab.tsx` (+ `RecentWorkouts.tsx`, `WorkoutCard.tsx`); rename tab "Workouts" → "Today" in `App.tsx` `TABS` |
| `app/Exercises` | `ExercisesTab.tsx` — templates move here as a "My workouts" tile |
| `app/Health`, `more/HealthFull` | `HealthAndStatsTab.tsx` + `health/*` (StatCards, Wellness, PRs, Measurements, Injury, ActivityStatsCard, boxing & cycling trends) |
| `app/History` | `HistoryTab.tsx` + `history/*` (calendar heatmap, StatsGrid, SessionList) |
| `app/Stats`, `more/StatsFull` | `StatsTab.tsx` + `health/AppleHealthCharts.tsx` (all existing charts kept: activity/energy/distance daily+weekly, training mix, volume, run pace, weight journey, Apple Health metrics + 6 charts) |
| `more/LogRun` | `RunLogger.tsx` (run + walk) |
| `more/LogRide` | `CyclingLogger.tsx` |
| `more/LogBoxing` | `BoxingLogger.tsx` |
| `more/LogWeight` | Weight entry + `health/WellnessSection.tsx` (combined sheet) |
| `more/LogInjury` | `health/InjurySection.tsx` form (severity 1–5: Niggling … Can't train) |
| `more/Measurements` | `health/MeasurementsSection.tsx` form (8 fields) |
| `more/Editor` | `WorkoutEditor.tsx` |
| `more/RunnerExercise` | `workout-runner/ExerciseScreen.tsx` (+ `WorkoutRunner.tsx` header) |
| `more/RunnerRest` | `RestScreen.tsx`; apply the same full-bleed tint to `RoundRestScreen`, `WarmupScreen`, `CooldownScreen` |
| `more/RunnerFinished` | `FinishedScreen.tsx` |
| `more/RunnerDialogs` | `StopConfirmDialog.tsx`, `SwapExercisePicker.tsx` |
| `more/SessionDetail` | `history/SessionDetail.tsx` |
| `more/ExerciseDetail` | Exercise detail modal in `ExercisesTab.tsx` |
| `more/Settings` | `AppSettingsModal.tsx` (+ `BackupSection`, `ExportSection`; Health tab = `HealthSettingsSection`) |
| `more/Login` | `LoginScreen.tsx` |
| `more/Onboarding` | `Onboarding.tsx` |
| `more/States` | `Toast.tsx`, `OfflineBanner.tsx`, `UpdateBanner.tsx`, skeletons, delete confirms, empty states |

Not mocked (follow the same patterns): `TabataRunner.tsx`, the
new-exercise form, date-picker sheet, History search/filter, `ImportExport`.

## New behavior in the mocks (not just restyling)

Check each against the backend/API before building; some may need new
fields. Ask the owner if one isn't wanted.

1. **One-tap presets** on Today tiles log immediately (with an Undo toast).
2. **"Again"** on recent entries repeats an entry for today.
3. **Live preview** in loggers: pace/speed/kcal computed as you type
   (use the same formulas as `backend/app/energy.py`; display only).
4. **Duration and distance as steppers** with quick picks underneath
   (replaces the old 15m/30m/45m/1h/Custom chip row).
5. **Weigh-in sheet** also captures the daily check-in (mood/energy/stress/sleep).
6. **Measurements "Copy last"** prefills from the previous entry.
7. **Runner:** "+15 s" on rest, "Log set" as the primary action, session
   "How did it feel?" rating on the finished screen, and a "New best" callout.
8. **Onboarding** asks which activities you do and orders Today's tiles by it.
9. **Stop workout** offers "Save partial session" vs "Discard".

## Constraints from AGENTS.md (still apply)

- No `text-white` / `bg-white` / `text-black` / `bg-black` for content; use
  tokens. Exceptions stay: `bg-black/60` backdrops, the yellow offline banner,
  `bg-accent text-on-accent`.
- `fixed top-0` elements need the safe-area top padding; fullscreen overlays
  (runner, session detail, swap picker) keep `paddingTop: max(env(safe-area-inset-top), 68px)`.
- The floating nav must respect `env(safe-area-inset-bottom)` (keep the
  `.bottom-nav` rule's intent).
- Dates via `dayKey()` / `todayKey()` (never `toISOString().slice(0,10)`).
- Run the full test suites; E2E selectors rely on `aria-label`s and some
  text, so update `frontend/e2e` tests alongside the restyle.
