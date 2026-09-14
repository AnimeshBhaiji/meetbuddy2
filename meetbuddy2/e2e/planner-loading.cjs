// meetbuddy2/e2e/planner-loading.cjs
// Picking a place no longer blanks the screen with a full-page overlay:
//   - the pick appears on the map straight away
//   - placeholder cards stand in for the next step's options while they load
//   - Back is disabled until they arrive, so it can't undo a pick mid-request
//   - if the request fails, the pick is rolled back and the options come back
// The select request is slowed down on purpose so the loading state is visible.
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

const FULL_CONTROL_PREFS = {
  ...DEFAULT_PREFS,
  planningStyle: "Full control",
  planningStyle_sub: { fc_filters: ["Price"] },
};

const titles = async (page) =>
  (await page.locator(".snap-start p.font-semibold").allTextContents()).join("|");
const pickCount = (page) =>
  page.locator(".leaflet-marker-icon").evaluateAll((els) =>
    els.filter((e) => /^\s*\d+\s*$/.test(e.textContent)).length);
const backButton = (page) => page.getByRole("button", { name: /^Back$/ });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let user = null;
  try {
    user = await createTestUser("load");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, FULL_CONTROL_PREFS);

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector(".snap-start", { timeout: 120000 });

    // make sure there is a next step to load
    await page.click('[aria-label="Filters and steps"]');
    const addActivity = page.locator("button", { hasText: "+" }).filter({ hasText: "Activity" });
    if (await addActivity.count()) await addActivity.first().click();
    await page.click('[aria-label="Filters and steps"]');

    const firstOptions = await titles(page);

    // ---------- slow success: placeholders, instant pick, Back locked ----------
    let delaySelect = true;
    await page.route("**/planner/session/*/select", async (route) => {
      if (delaySelect) await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });

    await page.locator('.snap-start button:has-text("Select")').first().click();
    await page.waitForTimeout(700); // well inside the 2.5s delay

    if (await page.locator("text=Preparing next options").count())
      fail("the full-screen overlay still covers the page while the next step loads");
    if (!(await page.locator('[data-testid="options-loading"]').isVisible()))
      fail("no placeholder cards while the next step loads");
    if ((await pickCount(page)) !== 1)
      fail(`the pick should be on the map straight away, saw ${await pickCount(page)} picks`);
    if (!(await backButton(page).isDisabled()))
      fail("Back is clickable while the pick is still being saved");
    console.log("loading: placeholder cards, pick already on the map, Back disabled, no overlay");

    await page.waitForFunction(
      (prev) => {
        const t = [...document.querySelectorAll(".snap-start p.font-semibold")].map((p) => p.textContent);
        return t.length > 0 && t.join("|") !== prev;
      },
      firstOptions, { timeout: 120000 });
    await page.waitForTimeout(500);
    if (await page.locator('[data-testid="options-loading"]').count())
      fail("placeholder cards stayed after the options arrived");
    if (await backButton(page).isDisabled()) fail("Back stayed disabled after the options arrived");
    if ((await pickCount(page)) !== 1) fail(`expected 1 pick after loading, saw ${await pickCount(page)}`);
    console.log("loaded: real options replaced the placeholders, Back enabled, 1 pick");

    // ---------- failure: the pick is rolled back, options come back ----------
    const secondOptions = await titles(page);
    await page.unroute("**/planner/session/*/select");
    await page.route("**/planner/session/*/select", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"boom"}' }));

    await page.locator('.snap-start button:has-text("Select")').first().click();
    await page.waitForSelector("text=Selection failed", { timeout: 15000 });
    await page.waitForTimeout(500);
    if ((await pickCount(page)) !== 1)
      fail(`a failed pick should be rolled back to 1 pick, saw ${await pickCount(page)}`);
    if ((await titles(page)) !== secondOptions)
      fail("the options the user was choosing from did not come back after the failure");
    if (await page.locator('[data-testid="options-loading"]').count())
      fail("placeholder cards stayed after the failure");
    console.log("failure: pick rolled back, options restored, error shown");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("PLANNER LOADING: PASS");
  } catch (e) {
    console.log("PLANNER LOADING: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
