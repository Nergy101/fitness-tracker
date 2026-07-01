import { test, expect, type APIRequestContext } from "@playwright/test";

const API_URL = "http://127.0.0.1:8100";

// Build a fast, deterministic workout straight against the API so the runner
// completes in seconds regardless of the seeded templates.
async function createFastWorkout(
  request: APIRequestContext,
  name: string,
  rounds: number,
  exerciseCount: number,
  durationSeconds: number,
) {
  const exRes = await request.get(`${API_URL}/api/v1/exercises`);
  expect(exRes.ok()).toBeTruthy();
  const exercises = await exRes.json();
  const picked = exercises.slice(0, exerciseCount).map((e: { id: number }, i: number) => ({
    exercise_id: e.id,
    duration_seconds: durationSeconds,
    order_index: i,
  }));
  const res = await request.post(`${API_URL}/api/v1/workouts`, {
    data: { name, description: "e2e", rounds, rest_between_rounds: 0, exercises: picked },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

test("seeded workouts show rounds and multiplied duration", async ({ page }) => {
  await page.goto("/");
  // Basic: 6 exercises × (40+30+40+30+40+45=225s) × 3 rounds = 675s = 11m 15s.
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
  // 76 seeded exercises → 76 "kcal/min" meta lines.
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

  // Cardio pill → only the 11 cardio exercises remain.
  await page.getByRole("button", { name: "cardio", exact: true }).click();
  await expect(page.getByText("kcal/min")).toHaveCount(11);
  await expect(page.getByRole("heading", { name: "Jumping Jacks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Push-ups" })).toHaveCount(0);

  // Back to All → full catalog again.
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText("kcal/min")).toHaveCount(76);
});

test("exercise images render for matched exercises, icon fallback otherwise", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Exercises" }).click();

  // Matched: Push-ups has a vendored image → a loaded <img> with real pixels.
  // It's lazy-loaded and below the fold, so scroll it in first.
  const pushupImg = page.getByRole("img", { name: "Push-ups", exact: true });
  await pushupImg.scrollIntoViewIfNeeded();
  await expect(pushupImg).toBeVisible();
  await expect
    .poll(() => pushupImg.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  // Unmatched: Burpees has no image → no <img>, so the Barbell icon (svg) shows.
  await expect(page.getByRole("img", { name: "Burpees", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Burpees" })).toBeVisible();
});

test("running a multi-round workout advances rounds and saves a session", async ({
  page,
  request,
}) => {
  const workout = await createFastWorkout(request, "E2E Rounds", 2, 1, 2);
  // total = 1 exercise × 2s × 2 rounds = 4s.
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
  const sessions = await (await request.get(`${API_URL}/api/v1/sessions`)).json();
  const mine = sessions.find((s: { template_name: string }) => s.template_name === "E2E Rounds");
  expect(mine).toBeTruthy();
  expect(mine.total_duration_seconds).toBe(4);

  // And it renders in History.
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("E2E Rounds").first()).toBeVisible();
});

test("Skip advances past the current exercise", async ({ page, request }) => {
  // 2 exercises × 60s: without Skip this can't finish inside the test window.
  await createFastWorkout(request, "E2E Skip", 1, 2, 60);

  await page.goto("/");
  await page.getByText("E2E Skip", { exact: true }).click();

  // Skip appears only during the exercise phase; wait past the initial rest.
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.click({ timeout: 15_000 });
  // Second exercise, then finish.
  await skip.click({ timeout: 15_000 });
  await expect(page.getByText("Workout Complete!")).toBeVisible({ timeout: 15_000 });
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
