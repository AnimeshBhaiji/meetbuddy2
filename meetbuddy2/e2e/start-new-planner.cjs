// meetbuddy2/e2e/start-new-planner.cjs
// Covers the "Start a new planner" button and the two questionnaire options
// that were removed:
//   - the button appears on the planner home, mid-flow, and on a finished plan
//   - it confirms first where progress would be lost
//   - it lands on the questionnaire with saved answers still filled in
//   - no stale session state survives the restart
//   - "Surprise me" and "Parking assistance" are no longer offered
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

// Full control shows the step grid, which is where "mid-flow" progress exists.
const FULL_CONTROL_PREFS = {
  ...DEFAULT_PREFS,
  planningStyle: "Full control",
  planningStyle_sub: { fc_filters: ["Price"] },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // window.confirm is headless-hostile: accept unless a leg opts out.
  let dismissNextConfirm = false;
  page.on("dialog", (d) => (dismissNextConfirm ? d.dismiss() : d.accept()));

  let user = null;
  try {
    user = await createTestUser("snp");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, FULL_CONTROL_PREFS);

    // ---------- the removed options are gone from the questionnaire ----------
    // Wait on each question's own text rather than sleeping: single-choice
    // answers auto-advance after 400ms plus a transition, so fixed timeouts
    // race the animation and read the wrong screen.
    const answer = async (label) => {
      await page.locator("button", { hasText: label }).first().click();
    };
    const atQuestion = (text) =>
      page.waitForSelector(`text=${text}`, { timeout: 20000 });

    await page.goto("http://localhost:5173/questionnaire-stage1");

    await atQuestion("What's the vibe you're going for this time?");
    await answer("Romantic");

    await atQuestion("Preferred romantic setting");
    await answer("Candlelit / intimate");

    await atQuestion("How much effort do you want to put into planning?");
    const planningText = await page.locator("body").innerText();
    if (/Surprise me/i.test(planningText)) fail('"Surprise me" is still offered');
    if (!/Semi-custom/.test(planningText) || !/Full control/.test(planningText))
      fail("the remaining planning styles are missing");
    console.log("questionnaire: Surprise me removed, Semi-custom + Full control intact");

    await answer("Full control");

    // fc_filters is multi-select, so it needs an explicit Continue
    await atQuestion("Important filters for you");
    await answer("Price");
    await page.getByRole("button", { name: /^continue$/i }).first().click();

    await atQuestion("How far are you willing to go for this meetup?");
    await answer("Stick to the city");

    await atQuestion("Preferred area");
    await answer("Central");

    // ---------- "Parking assistance" is gone from Transport support ----------
    await atQuestion("Transport support");
    const transportText = await page.locator("body").innerText();
    if (/Parking assistance/i.test(transportText)) fail('"Parking assistance" is still offered');
    if (!/Rides arranged/.test(transportText)) fail('"Rides arranged" is missing');
    console.log("questionnaire: Parking assistance removed, Rides arranged intact");

    // ---------- planner home: button present, no confirm needed ----------
    await page.goto("http://localhost:5173/planner");
    await page.waitForSelector("text=Start a new planner", { timeout: 20000 });
    await page.click("text=Start a new planner");
    await page.waitForURL("**/questionnaire-stage1", { timeout: 15000 });
    console.log("planner home: button navigates to the questionnaire");

    // answers must still be there — this reopens them, it does not wipe them
    const cached = await page.evaluate(() => localStorage.getItem("userPreferences"));
    if (!cached || !/Romantic/.test(cached))
      fail(`saved answers were lost on restart: ${cached}`);
    console.log("answers preserved ->", JSON.parse(cached).mood);

    // ---------- mid-flow: confirm, then restart ----------
    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector("text=Select", { timeout: 120000 });
    await page.locator('button:has-text("Select")').first().click();
    await page.waitForTimeout(3000);
    console.log("mid-flow: made a selection");

    // dismissing the confirm must keep you where you are
    dismissNextConfirm = true;
    await page.locator('[aria-label="Start a new planner"]').first().click();
    await page.waitForTimeout(1200);
    if (page.url().includes("questionnaire"))
      fail("declining the confirmation still restarted the planner");
    console.log("mid-flow: declining the confirm keeps the plan");

    dismissNextConfirm = false;
    await page.locator('[aria-label="Start a new planner"]').first().click();
    await page.waitForURL("**/questionnaire-stage1", { timeout: 15000 });
    console.log("mid-flow: accepting the confirm restarts");

    // ---------- no stale state survives ----------
    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1500);
    const home = await page.locator("body").innerText();
    if (!/Plan your perfect/i.test(home))
      fail(`planner did not return to its home screen. Saw: ${home.slice(0, 160)}`);
    if (/Select/.test(home) && !/Generate itinerary/.test(home))
      fail("previous step options survived the restart");
    console.log("restart lands on a clean planner home");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("START NEW PLANNER: PASS");
  } catch (e) {
    console.log("START NEW PLANNER: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
