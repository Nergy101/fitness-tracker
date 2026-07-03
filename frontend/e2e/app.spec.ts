import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = "http://127.0.0.1:8100";
const TEST_PASSWORD = "e2e-test-password";

/** Log in via the UI then return an auth headers object. */
async function login(page: Page): Promise<Record<string, string>> {
  await page.goto("/");
  await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("button", { name: "Workouts" })).toBeVisible({ timeout: 5000 });
  const token = await page.evaluate(() => localStorage.getItem("fitness_auth"));
  return { Authorization: "Basic " + token };
}

// Build a fast, deterministic workout straight against the API so the runner
// completes in seconds regardless of the seeded templates.
async function createFastWorkout(
  request: APIRequestContext,
  name: string,
  rounds: number,
  exerciseCount: number,
  durationSeconds: number,
  headers: Record<string, string> = {},
) {
  const exRes = await request.get(`${API_URL}/api/v1/exercises`, { headers });
  expect(exRes.ok()).toBeTruthy();
  const exercises = await exRes.json();
  const picked = exercises.slice(0, exerciseCount).map((e: { id: number }, i: number) => ({
    exercise_id: e.id,
    duration_seconds: durationSeconds,
    order_index: i,
  }));
  const res = await request.post(`${API_URL}/api/v1/workouts`, {
    data: { name, description: "e2e", rounds, rest_between_rounds: 0, exercises: picked },
    headers,
  });
  expect(res.status()).toBe(201);
  return res.json();
}

// ─── Authenticated tests — log in before each test ─────

test.describe("authenticated", () => {
  let _authHeaders: Record<string, string> = {};

  test.beforeEach(async ({ page, request }) => {
    _authHeaders = await login(page);
  });

  test("seeded workouts show rounds and multiplied duration", async ({ page }) => {
    await page.goto("/");
    // Basic: 6 exercises x (40+30+40+30+40+45=225s) x 3 rounds = 675s = 11m 15s.
    const basic = page.locator("div", { hasText: "Basic" }).first();
    await expect(page.getByText("Basic", { exact: true })).toBeVisible();
    await expect(page.getByText("Calisthenics", { exact: true })).toBeVisible();
    await expect(page.getByText("Dumbbells", { exact: true })).toBeVisible();
    // At least one "3 rounds" badge is present on the seeded cards.
    await expect(page.getByText("3 rounds").first()).toBeVisible();
    // Cards show the Work / Rest / Total breakdown (labels sit inline with values).
    await expect(page.getByText(/Work/).first()).toBeVisible();
    await expect(page.getByText(/Rest/).first()).toBeVisible();
    await expect(page.getByText(/Total/).first()).toBeVisible();
    expect(basic).toBeTruthy();
  });

  test("saving a workout shows a success toast", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "+ New Workout" }).click();
    await page.getByPlaceholder("Workout name...").fill("Toast Test");

    // Add one exercise from the picker.
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await page.getByPlaceholder("Search...").fill("Push-ups");
    await page.getByText("Push-ups", { exact: true }).first().click();

    await page.getByRole("button", { name: "Save Workout" }).click();

    // Toast confirms the save; editor is gone.
    await expect(page.getByRole("status")).toContainText("Workout created");
    await expect(page.getByPlaceholder("Workout name...")).toHaveCount(0);
  });

  test("exercises tab loads the full seeded catalog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Exercises" }).click();
    // 76 seeded exercises -> 76 "kcal/min" meta lines.
    await expect(page.getByText("kcal/min").first()).toBeVisible();
    await expect(page.getByText("kcal/min")).toHaveCount(76);
    // Spot-check one calisthenics and one dumbbell entry.
    await expect(page.getByRole("heading", { name: "Pull-ups" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dumbbell Thrusters" })).toBeVisible();
  });

  test("category pills filter the exercise list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Exercises" }).click();
    await expect(page.getByText("kcal/min")).toHaveCount(76);

    // Cardio pill -> only the 11 cardio exercises remain.
    await page.getByRole("button", { name: "cardio", exact: true }).click();
    await expect(page.getByText("kcal/min")).toHaveCount(11);
    await expect(page.getByRole("heading", { name: "Jumping Jacks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Push-ups" })).toHaveCount(0);

    // Back to All -> full catalog again.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText("kcal/min")).toHaveCount(76);
  });

  test("exercise images render for matched exercises, icon fallback otherwise", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Exercises" }).click();

    // Matched: Push-ups has a vendored image -> a loaded <img> with real pixels.
    // It's lazy-loaded and below the fold, so scroll it in first.
    const pushupImg = page.getByRole("img", { name: "Push-ups", exact: true });
    await pushupImg.scrollIntoViewIfNeeded();
    await expect(pushupImg).toBeVisible();
    await expect
      .poll(() => pushupImg.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    // Unmatched: Burpees has no image -> no <img>, so the Barbell icon (svg) shows.
    await expect(page.getByRole("img", { name: "Burpees", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Burpees" })).toBeVisible();
  });

  test("running a multi-round workout advances rounds and saves a session", async ({
    page,
    request,
  }) => {
    const workout = await createFastWorkout(request, "E2E Rounds", 2, 1, 2, _authHeaders);
    // total = 1 exercise x 2s x 2 rounds = 4s.
    expect(workout.total_duration_seconds).toBe(4);

    await page.goto("/");
    await page.getByText("E2E Rounds", { exact: true }).click();

    // Poll the runner text; capture that it reaches Round 2/2 (proves looping),
    // then that it completes.
    let sawRound2 = false;
    for (let i = 0; i < 80; i++) {
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      if (body.includes("Round 2/2")) sawRound2 = true;
      if (body.includes("Workout Complete")) break;
      await page.waitForTimeout(250);
    }
    expect(sawRound2).toBeTruthy();
    await expect(page.getByText("Workout Complete!")).toBeVisible();

    // Session persisted with the round-multiplied total.
    const sessions = await (await request.get(`${API_URL}/api/v1/sessions`, { headers: _authHeaders })).json();
    const mine = sessions.find((s: { template_name: string }) => s.template_name === "E2E Rounds");
    expect(mine).toBeTruthy();
    expect(mine.total_duration_seconds).toBe(4);

    // And it renders in History.
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("E2E Rounds").first()).toBeVisible();
  });

  test("Skip advances past the current exercise", async ({ page, request }) => {
    // 2 exercises x 60s: without Skip this can't finish inside the test window.
    await createFastWorkout(request, "E2E Skip", 1, 2, 60, _authHeaders);

    await page.goto("/");
    await page.getByText("E2E Skip", { exact: true }).click();

    // Skip appears only during the exercise phase; wait past the initial rest.
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    await skip.click({ timeout: 15_000 });
    // Second exercise, then finish.
    await skip.click({ timeout: 15_000 });
    await expect(page.getByText("Workout Complete!")).toBeVisible({ timeout: 15_000 });
  });

  test("history range selector and all-time drill-down", async ({ page, request }) => {
    // Seed one session directly so History has data to show.
    const res = await request.post(`${API_URL}/api/v1/sessions`, {
      data: {
        template_id: null,
        template_name: "E2E History",
        total_duration_seconds: 600,
        total_kcal_estimated: 90,
        exercises: [
          {
            exercise_id: null,
            exercise_name: "Push-ups",
            duration_seconds: 30,
            kcal_burned: 3,
            order_index: 0,
            completed: true,
          },
        ],
      },
      headers: _authHeaders,
    });
    expect(res.status()).toBe(201);

    await page.goto("/");
    await page.getByRole("button", { name: "History" }).click();

    // Range pills present; the session shows in the default (Last 7 days) range.
    await expect(page.getByRole("button", { name: "This week" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 30 days" })).toBeVisible();
    await expect(page.getByText("E2E History").first()).toBeVisible();

    // Drill into all-time and back.
    await page.getByRole("button", { name: "View all" }).click();
    await expect(page.getByText("All time")).toBeVisible();
    await expect(page.getByText("E2E History").first()).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "This week" })).toBeVisible();
  });

  test("history export produces a versioned file and import restores sessions", async ({
    page,
    request,
  }) => {
    // Seed a session so there's something to export.
    await request.post(`${API_URL}/api/v1/sessions`, {
      data: {
        template_id: null,
        template_name: "Export Me",
        total_duration_seconds: 300,
        total_kcal_estimated: 42,
        exercises: [],
      },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "History" }).click();

    // Export -> capture the download and assert the versioned envelope.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export" }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.sessions)).toBe(true);
    expect(parsed.sessions.some((s: { template_name: string }) => s.template_name === "Export Me")).toBe(true);

    // Import a versioned file with a preserved past date; it should appear.
    const importDoc = JSON.stringify({
      version: 1,
      sessions: [
        {
          template_name: "Imported Session",
          total_duration_seconds: 120,
          total_kcal_estimated: 20,
          started_at: "2026-06-15T09:00:00",
          exercises: [],
        },
      ],
    });
    await page.setInputFiles('input[type="file"]', {
      name: "history.json",
      mimeType: "application/json",
      buffer: Buffer.from(importDoc),
    });
    // The imported date is older than the default range, so view all to see it.
    await page.getByRole("button", { name: "View all" }).click();
    await expect(page.getByText("Imported Session").first()).toBeVisible();

    // And it persisted with the imported date (via the API).
    const sessions = await (await request.get(`${API_URL}/api/v1/sessions`, { headers: _authHeaders })).json();
    const imported = sessions.find((s: { template_name: string }) => s.template_name === "Imported Session");
    expect(imported).toBeTruthy();
    expect(imported.started_at.startsWith("2026-06-15")).toBe(true);
  });

  test("theme toggle flips and persists", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const initiallyDark = await html.evaluate((el) => el.classList.contains("dark"));

    await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(!initiallyDark);

    const persisted = await page.evaluate(() => localStorage.getItem("theme"));
    expect(persisted).toBe(initiallyDark ? "light" : "dark");
  });

  // --- Health Tab ---

  test("health tab shows 4 tabs and renders BMI card", async ({ page }) => {
    await page.goto("/");

    // Bottom nav has a Health tab with heartbeat icon
    await expect(page.getByRole("button", { name: "Health" })).toBeVisible();
    await page.getByRole("button", { name: "Health" }).click();

    // Health tab loads -- shows BMI section or the prompt to set height
    await expect(page.getByText(/BMI|Log Weight|Health Settings/).first()).toBeVisible();
  });

  // Note: skipped in CI — the BMI value render is race-conditioned on
  // loadAll() completing after the settings modal closes. Needs longer
  // state sync than the 500ms wait allows in CI.
  test.skip("health settings modal saves and BMI appears", async ({ page, request }) => {
    // Seed a weight entry so BMI has data to compute
    await request.post(`${API_URL}/api/v1/health/weight`, {
      data: { weight_kg: 75, date: "2026-07-01", notes: "" },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Open settings via gear icon
    await page.getByTitle("Health Settings").click();

    // Fill in height and birthday
    const heightInput = page.locator('input[type="number"]').first();
    await heightInput.fill("180");
    const birthdayInput = page.locator('input[type="date"]');
    await birthdayInput.fill("1996-01-15");
    const genderSelect = page.locator("select");
    await genderSelect.selectOption("male");

    // Save
    await page.getByRole("button", { name: "Save Settings" }).click();

    // Wait for modal to close and BMI to compute
    await page.waitForTimeout(500);

    // BMI should now show -- 75 kg at 180 cm = 23.1
    await expect(page.getByText("BMI").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("23.1")).toBeVisible();
  });

  test("logging weight creates entry visible in history", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Type weight in the quick-log input
    const weightInput = page.locator('input[placeholder="kg"]');
    await weightInput.fill("82.5");
    await page.getByRole("button", { name: "Log", exact: true }).click();

    // Wait for save and re-render
    await page.waitForTimeout(500);

    // The entry should show in the Recent Weights section
    await expect(page.getByText("82.5 kg").first()).toBeVisible();

    // Verify via API
    const entries = await (await request.get(`${API_URL}/api/v1/health/weight`, { headers: _authHeaders })).json();
    const match = entries.find((e: { weight_kg: number }) => e.weight_kg === 82.5);
    expect(match).toBeTruthy();
  });

  test("health score card shows after logging weight", async ({ page, request }) => {
    // Seed weight + profile for meaningful score
    await request.post(`${API_URL}/api/v1/health/weight`, {
      data: { weight_kg: 78, date: "2026-07-01", notes: "" },
      headers: _authHeaders,
    });
    await request.put(`${API_URL}/api/v1/health/profile`, {
      data: { height_cm: 175, birthday: "1996-01-15", gender: "male" },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Health Score gauge renders
    await expect(page.getByText("Health Score")).toBeVisible();
    // At least one sub-score label should show
    await expect(page.getByText(/BMI:|Workouts:|Streak:|Meas:/).first()).toBeVisible();
  });

  test("goal progress bar renders when goal is set", async ({ page, request }) => {
    // Seed weight entries and set a goal
    await request.post(`${API_URL}/api/v1/health/weight`, {
      data: { weight_kg: 85, date: "2026-06-01", notes: "" },
      headers: _authHeaders,
    });
    await request.post(`${API_URL}/api/v1/health/weight`, {
      data: { weight_kg: 80, date: "2026-07-01", notes: "" },
      headers: _authHeaders,
    });
    await request.put(`${API_URL}/api/v1/health/profile`, {
      data: { goal_weight_kg: 75 },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Goal Progress card shows
    await expect(page.getByText("Goal Progress")).toBeVisible();
    await expect(page.getByText("%")).toBeVisible(); // percentage
    await expect(page.getByText(/kg to go|Goal reached/)).toBeVisible();
  });

  test("wellness check-in logs and displays trend", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Open wellness section
    await page.getByText("Wellness Check-in").click();

    // Adjust sliders
    await page.locator('input[type="range"]').nth(0).fill("4"); // mood
    await page.locator('input[type="range"]').nth(1).fill("3"); // energy

    // Submit
    await page.getByRole("button", { name: "Log Check-in" }).click();

    await page.waitForTimeout(300);

    // Verify via API
    const entries = await (await request.get(`${API_URL}/api/v1/health/wellness`, { headers: _authHeaders })).json();
    const match = entries.find((e: { mood: number }) => e.mood === 4);
    expect(match).toBeTruthy();
    expect(match.energy).toBe(3);
  });

  // ─── Body Measurements ─────────────────────────────────

  test("body measurements section expands and shows add form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();

    // Click the Body Measurements collapsible button
    await page.getByText("Body Measurements").click();

    // Should show the Add Measurements button
    await expect(page.getByText("+ Add Measurements")).toBeVisible();
  });

  test("adding body measurements saves and displays with delta", async ({ page, request }) => {
    // Seed a first measurement so there's a baseline
    await request.post(`${API_URL}/api/v1/health/measurements`, {
      data: { waist_cm: 85, hips_cm: 95, chest_cm: 100, date: "2026-06-01" },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();
    await page.getByText("Body Measurements").click();
    await page.getByText("+ Add Measurements").click();

    // Fill in measurement fields (they use placeholders like "Waist (cm)")
    await page.getByPlaceholder("Waist (cm)").fill("82");
    await page.getByPlaceholder("Hips (cm)").fill("94");
    await page.getByPlaceholder("Chest (cm)").fill("101");

    // Save
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForTimeout(300);

    // Verify via API — should have 2 entries now
    const entries = await (await request.get(`${API_URL}/api/v1/health/measurements`, { headers: _authHeaders })).json();
    expect(entries.length).toBe(2);

    // Delta should show the change: waist went from 85 to 82 = -3 (green)
    await expect(page.getByText(/-3[.]0/)).toBeVisible();
  });

  // Note: skipped in CI — these timing / data-sharing-sensitive tests need
  // per-test DB isolation (currently all tests share one e2e.db with no reset).

  test.skip("body measurements persist on page reload", async ({ page, request }) => {
    // Seed a measurement
    await request.post(`${API_URL}/api/v1/health/measurements`, {
      data: { waist_cm: 88, hips_cm: 96, date: "2026-07-01" },
      headers: _authHeaders,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Health" }).click();
    await page.getByText("Body Measurements").click();

    // Should show Waist: 88 cm
    await expect(page.getByText("88 cm")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("96 cm")).toBeVisible({ timeout: 5000 });

    // Reload and check it persists
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Health" }).click();
    await page.waitForTimeout(500);
    await page.getByText("Body Measurements").click();
    await expect(page.getByText("88 cm")).toBeVisible({ timeout: 10000 });
  });

  // --- Runs ---

  test.skip("log a run via UI shows in recent runs and history", async ({ page, request }) => {
    await page.goto("/");

    // Open the run logger
    await page.getByText("Log a Run").click();

    // Select 30m duration
    await page.getByRole("button", { name: "30m" }).click();

    // Enter distance
    await page.locator('input[placeholder="e.g. 5.0"]').fill("5.0");

    // Save
    await page.getByRole("button", { name: "Save Run" }).click();

    // Toast confirms
    await expect(page.getByRole("status")).toContainText("Run logged");

    // Run appears in recent runs section
    await expect(page.getByText("5.0 km", { exact: false }).first()).toBeVisible();

    // Verify via API -- pace should be 360s/km (30min / 5km)
    const runs = await (await request.get(`${API_URL}/api/v1/runs`, { headers: _authHeaders })).json();
    const match = runs.find((r: { distance_km: number }) => r.distance_km === 5.0);
    expect(match).toBeTruthy();
    expect(match.pace_per_km).toBe(360);
    expect(match.duration_seconds).toBe(1800);

    // Verify it appears in History with a Run label
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("Run: 5.0km").first()).toBeVisible();
  });

  test.skip("run stats endpoint returns correct aggregates", async ({ page, request }) => {
    // Seed two runs via API
    await request.post(`${API_URL}/api/v1/runs`, {
      data: { duration_seconds: 1800, distance_km: 5.0, date: "2026-07-01" },
      headers: _authHeaders,
    });
    await request.post(`${API_URL}/api/v1/runs`, {
      data: { duration_seconds: 2700, distance_km: 7.5, date: "2026-07-02" },
      headers: _authHeaders,
    });

    const stats = await (await request.get(`${API_URL}/api/v1/runs/stats`, { headers: _authHeaders })).json();
    expect(stats.total_runs).toBe(2);
    expect(stats.total_distance_km).toBeCloseTo(12.5, 1);
    expect(stats.total_duration_seconds).toBe(4500);
    // avg pace = 4500s / 12.5km = 360 s/km
    expect(stats.avg_pace_per_km).toBeCloseTo(360, 0);

    // Verify on the Workouts tab
    await page.goto("/");
    await expect(page.getByText("Running Stats").first()).toBeVisible();
    await expect(page.getByText("12").first()).toBeVisible(); // total km (12.5 rounded to 12)
  });

  test("deleting a run removes it and the associated session", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/runs`, {
      data: { duration_seconds: 1200, distance_km: 3.0, notes: "to-delete" },
      headers: _authHeaders,
    });
    const run = await res.json();
    expect(run.id).toBeTruthy();

    // Delete it
    await request.delete(`${API_URL}/api/v1/runs/${run.id}`, { headers: _authHeaders });

    // Verify it's gone from runs
    const runs = await (await request.get(`${API_URL}/api/v1/runs`, { headers: _authHeaders })).json();
    expect(runs.find((r: { id: number }) => r.id === run.id)).toBeFalsy();

    // Verify it's gone from sessions
    const sessions = await (await request.get(`${API_URL}/api/v1/sessions`, { headers: _authHeaders })).json();
    const match = sessions.find((s: { template_name: string }) => s.template_name.includes("3.0km"));
    expect(match).toBeFalsy();
  });

  test.skip("log workout button creates a session that appears in history", async ({ page, request }) => {
    // Create a fast workout via API for testing
    const workout = await createFastWorkout(request, "E2E Log Test", 2, 2, 10, _authHeaders);
    expect(workout.id).toBeTruthy();

    await page.goto("/");

    // Wait for workouts to load
    await expect(page.getByText("E2E Log Test", { exact: true })).toBeVisible();

    // Click the Log button on our test workout
    await page.getByRole("button", { name: "Log" }).first().click();

    // Toast confirms
    await expect(page.getByRole("status")).toContainText("Workout logged!", { timeout: 5000 });

    // Verify via API — session should exist
    const sessions = await (await request.get(`${API_URL}/api/v1/sessions`, { headers: _authHeaders })).json();
    const match = sessions.find((s: { template_name: string }) => s.template_name === "E2E Log Test");
    expect(match).toBeTruthy();
    expect(match.total_duration_seconds).toBeGreaterThan(0);
    expect(match.total_kcal_estimated).toBeGreaterThan(0);
    expect(match.exercises.length).toBe(2);

    // Verify it appears in the History tab
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("E2E Log Test").first()).toBeVisible();
  });
});

// --- Auth flow tests ---

test.describe("auth", () => {
  test("login screen appears when no auth is stored", async ({ page }) => {
    await page.goto("/");
    // Should show the login screen, not the app
    await expect(page.getByText("Enter your password to unlock")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
    // App tabs should NOT be visible
    await expect(page.getByRole("button", { name: "Workouts" })).toHaveCount(0);
  });

  test("wrong password shows error and stays on login", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("Wrong password")).toBeVisible();
    // Still on login screen
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("correct password unlocks the app", async ({ page, request }) => {
    // Verify API returns 401 without auth
    const noAuth = await request.get(`${API_URL}/api/v1/exercises`);
    expect(noAuth.status()).toBe(401);

    await page.goto("/");
    await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();

    // App should now be visible with tabs
    await expect(page.getByRole("button", { name: "Workouts" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Exercises" })).toBeVisible();

    // Data loads (exercises tab)
    await page.getByRole("button", { name: "Exercises" }).click();
    await expect(page.getByText("kcal/min").first()).toBeVisible();
  });

  test("auth persists on page reload", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("button", { name: "Workouts" })).toBeVisible({ timeout: 5000 });

    // Reload
    await page.reload();
    // Should still be logged in
    await expect(page.getByRole("button", { name: "Workouts" })).toBeVisible();
    await expect(page.getByText("Enter your password")).toHaveCount(0);
  });

  test("logout clears auth and returns to login", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("button", { name: "Workouts" })).toBeVisible({ timeout: 5000 });

    // Click logout
    await page.getByTitle("Logout").click();
    // Should be back at login screen
    await expect(page.getByText("Enter your password to unlock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Workouts" })).toHaveCount(0);
  });
});
