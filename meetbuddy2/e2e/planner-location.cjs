// meetbuddy2/e2e/planner-location.cjs
// The step page header says which stop you're choosing, and the map shows where
// you are: a dot for GPS coordinates, an approximate-area circle when only a
// typed place was given. The session response is replaced with known data, so
// this spends no SerpAPI credits. Needs backend :8000 (test account) + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };
const LOCATION_COLOR = "#f43f5e";

const place = (i, title) => ({
  place_id: `loc-${i}`, title, type: "Restaurant", types: ["Restaurant"], attributes: {}, rating: 4.4,
  reviews_count: 900, address: "100 Feet Rd, Indiranagar", lat: 12.9716 + (i % 3) * 0.004,
  lng: 77.6412 + (i % 2) * 0.004, distance_meters: 400 + i * 100, thumbnail: null, link: "",
});

const response = (origin) => ({
  session_id: "loc-session",
  initial: {
    options: ["Chianti", "Bohemians", "MisoSexy"].map((t, i) => place(i, t)),
    recommended_flow: ["restaurant", "activity", "stay"], plan_mode: "full",
    directives: { filters: ["price"], shortlist: null },
    location_hint: "Indiranagar Bangalore", origin,
  },
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let origin = { lat: 12.9784, lng: 77.6408, exact: false, label: "Indiranagar Bangalore" };
  let user = null;
  try {
    user = await createTestUser("loc");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, { ...DEFAULT_PREFS, planningStyle: "Full control", planningStyle_sub: { fc_filters: ["Price"] } });
    await page.route((u) => new URL(u).pathname === "/planner/session", (route) =>
      route.request().method() !== "POST" ? route.continue()
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(origin)) }));

    const start = async () => {
      await page.goto("http://localhost:5173/planner");
      await page.waitForTimeout(1200);
      await page.click("text=Generate itinerary");
      await page.waitForSelector(".snap-start", { timeout: 30000 });
      await page.waitForTimeout(1500);
    };

    // ---------- typed place: header + approximate circle ----------
    await start();
    const header = page.locator('[data-testid="step-header"]');
    if (!(await header.count())) fail("no step header");
    const headerText = (await header.innerText()).replace(/\s+/g, " ");
    for (const want of ["Choose a place to eat", "Stop 1 of 3", "Near Indiranagar Bangalore"])
      if (!headerText.includes(want)) fail(`header is missing "${want}": ${headerText}`);
    if (/full control|guided/i.test(headerText)) fail(`header still shows the planning mode: ${headerText}`);
    const stops = page.locator('[data-testid="step-header"] ol[aria-label="Plan progress"] li');
    if ((await stops.count()) !== 3) fail(`route strip should have 3 stops, has ${await stops.count()}`);
    if ((await stops.nth(0).getAttribute("aria-current")) !== "step") fail("first stop is not marked current");
    console.log(`header: "${headerText}"`);

    const circles = page.locator(`path.leaflet-interactive[stroke="${LOCATION_COLOR}"]`);
    if ((await circles.count()) !== 1) fail(`expected one approximate-location circle, saw ${await circles.count()}`);
    if (await page.locator(".user-location-dot").count()) fail("GPS dot shown for a typed place");
    console.log("typed place: approximate-location circle, no GPS dot");

    // ---------- GPS coordinates: dot, no circle ----------
    origin = { lat: 12.9719, lng: 77.6412, exact: true, label: "Indiranagar Bangalore" };
    await page.click('[aria-label="Cancel planning"]');
    await start();
    if ((await page.locator(".user-location-dot").count()) !== 1) fail("no GPS location dot");
    if (await page.locator(`path.leaflet-interactive[stroke="${LOCATION_COLOR}"]`).count())
      fail("approximate circle shown for exact GPS coordinates");
    console.log("GPS: location dot, no circle");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("PLANNER LOCATION: PASS");
  } catch (e) {
    console.log("PLANNER LOCATION: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
