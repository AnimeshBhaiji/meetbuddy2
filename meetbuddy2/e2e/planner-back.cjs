// meetbuddy2/e2e/planner-back.cjs
// Back undoes the latest pick and reopens *that* step with the options you
// chose from — not the step before it — and it does so from memory, without
// re-downloading the whole session.
//   restaurant (pick) -> activity (pick) -> stay
//   Back -> activity options, 1 pick left
//   Back -> restaurant options, 0 picks left
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { API, createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

// Full control lets the test add steps, so the flow is always 3 long.
const FULL_CONTROL_PREFS = {
  ...DEFAULT_PREFS,
  planningStyle: "Full control",
  planningStyle_sub: { fc_filters: ["Price"] },
};

const titles = async (page) =>
  (await page.locator(".snap-start p.font-semibold").allTextContents()).join("|");
const waitForNewOptions = (page, old) =>
  page.waitForFunction(
    (prev) => {
      const t = [...document.querySelectorAll(".snap-start p.font-semibold")].map((p) => p.textContent);
      return t.length > 0 && t.join("|") !== prev;
    },
    old, { timeout: 120000 });
// Picks are the numbered markers on the map.
const pickCount = (page) =>
  page.locator(".leaflet-marker-icon").evaluateAll((els) =>
    els.filter((e) => /^\s*\d+\s*$/.test(e.textContent)).length);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // The server must forget an undone pick too: every place it holds in the
  // session is excluded from later suggestions.
  let sessionId = null;
  page.on("response", async (r) => {
    if (r.request().method() === "POST" && /\/planner\/session$/.test(r.url())) {
      try { sessionId = (await r.json()).session_id; } catch { /* not JSON */ }
    }
  });
  // Read from Node, not the page, so the "no re-download" check below stays honest.
  const serverPicks = async () => {
    const res = await fetch(`${API}/planner/session/${sessionId}`, { headers: user.headers });
    return (await res.json()).steps.length;
  };

  let user = null;
  try {
    user = await createTestUser("back");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, FULL_CONTROL_PREFS);

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector(".snap-start", { timeout: 120000 });

    // make sure the flow has activity and stay after the first step
    await page.click('[aria-label="Filters and steps"]');
    for (const step of ["Activity", "Stay"]) {
      const add = page.locator("button", { hasText: `+` }).filter({ hasText: step });
      if (await add.count()) await add.first().click();
    }
    await page.click('[aria-label="Filters and steps"]');

    const restaurantOptions = await titles(page);

    await page.locator('.snap-start button:has-text("Select")').first().click();
    await waitForNewOptions(page, restaurantOptions);
    await page.waitForTimeout(1000);
    const activityOptions = await titles(page);
    console.log("picked a restaurant -> activity options");

    await page.locator('.snap-start button:has-text("Select")').first().click();
    await waitForNewOptions(page, activityOptions);
    await page.waitForTimeout(1000);
    if ((await pickCount(page)) !== 2) fail(`expected 2 picks on the map, saw ${await pickCount(page)}`);
    if (!sessionId) fail("never saw the planner session id");
    if ((await serverPicks()) !== 2) fail(`server holds ${await serverPicks()} picks, expected 2`);
    console.log("picked an activity -> stay options, 2 picks (server agrees)");

    // ---------- Back #1: reopens activity, from memory ----------
    const sessionFetches = [];
    page.on("request", (r) => {
      if (r.method() === "GET" && /\/planner\/session\/[^/]+$/.test(r.url())) sessionFetches.push(r.url());
    });

    await page.getByRole("button", { name: /^Back$/ }).click();
    await page.waitForTimeout(1500);
    const afterBack1 = await titles(page);
    if (afterBack1 === restaurantOptions)
      fail("Back reopened the restaurant step instead of the activity step it undid");
    if (afterBack1 !== activityOptions)
      fail("Back did not restore the activity options the pick was made from");
    if ((await pickCount(page)) !== 1) fail(`expected 1 pick after Back, saw ${await pickCount(page)}`);
    if ((await serverPicks()) !== 1)
      fail(`after Back the server still holds ${await serverPicks()} picks, so the undone place stays excluded`);
    console.log("back #1: activity options restored, 1 pick left (server agrees)");

    // ---------- Back #2: reopens restaurant ----------
    await page.getByRole("button", { name: /^Back$/ }).click();
    await page.waitForTimeout(1500);
    if ((await titles(page)) !== restaurantOptions)
      fail("second Back did not restore the restaurant options");
    if ((await pickCount(page)) !== 0) fail(`expected 0 picks, saw ${await pickCount(page)}`);
    if ((await serverPicks()) !== 0) fail(`after two Backs the server still holds ${await serverPicks()} picks`);
    console.log("back #2: restaurant options restored, 0 picks left (server agrees)");

    if (sessionFetches.length)
      fail(`Back re-downloaded the session ${sessionFetches.length}x though the options were in memory`);
    console.log("no session re-download on Back");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("PLANNER BACK: PASS");
  } catch (e) {
    console.log("PLANNER BACK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
