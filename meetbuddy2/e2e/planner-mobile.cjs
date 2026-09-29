// meetbuddy2/e2e/planner-mobile.cjs
// The step page at phone width: its header sits below the app's navigation bar
// (the page used to stay scrolled from the long planner home, hiding the header
// under the fixed nav) and every top-bar control fits on screen (Skip, Start
// new planner and Cancel used to run off the right edge). The session response
// is replaced with known places, so no SerpAPI credits. Needs :8000 + :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };
const WIDTH = 390;

const place = (i, title) => ({
  place_id: `mob-${i}`, title, type: "Restaurant", types: ["Restaurant"], attributes: {}, rating: 4.4,
  reviews_count: 900, address: "100 Feet Rd, Indiranagar", lat: 12.9716 + (i % 3) * 0.003,
  lng: 77.6412 + (i % 2) * 0.003, distance_meters: 300 + i * 90, thumbnail: null, link: "",
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let user = null;
  try {
    user = await createTestUser("mob");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, { ...DEFAULT_PREFS, planningStyle: "Full control", planningStyle_sub: { fc_filters: ["Price"] } });
    await page.route((u) => new URL(u).pathname === "/planner/session", (r) =>
      r.request().method() !== "POST" ? r.continue() : r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ session_id: "mob", initial: {
          options: ["Chianti", "Bohemians", "MisoSexy", "PHURR"].map((t, i) => place(i, t)),
          recommended_flow: ["restaurant", "activity", "stay"], plan_mode: "full",
          directives: { filters: ["price"], shortlist: null }, location_hint: "Indiranagar Bangalore",
          origin: { lat: 12.9733, lng: 77.6405, exact: false, label: "Indiranagar Bangalore" } } }),
      }));

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1500);
    await page.click("text=Generate itinerary"); // scrolls the long planner home down to the button
    await page.waitForSelector(".snap-start", { timeout: 30000 });
    await page.waitForTimeout(1500);

    const layout = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const nav = box(document.querySelector("nav") || document.querySelector("header"));
      const header = box(document.querySelector('[data-testid="step-header"]'));
      const controls = [...document.querySelectorAll('[data-testid="step-controls"] button')].map((b) => ({
        name: b.getAttribute("aria-label") || b.textContent.trim(), left: box(b).left, right: box(b).right, top: box(b).top,
      }));
      return { navBottom: nav.bottom, headerTop: header.top, headerRight: header.right, controls,
               pageWidth: document.documentElement.scrollWidth };
    });
    if (layout.headerTop < layout.navBottom)
      fail(`step header starts at ${Math.round(layout.headerTop)}px, under the navigation bar (ends ${Math.round(layout.navBottom)}px)`);
    if (layout.headerRight > WIDTH) fail(`step header runs off screen (right edge ${Math.round(layout.headerRight)}px)`);
    if (!layout.controls.length) fail("no top-bar controls found");
    const off = layout.controls.filter((c) => c.left < 0 || c.right > WIDTH || c.top < layout.navBottom);
    if (off.length) fail(`controls off screen or under the nav: ${off.map((c) => c.name).join(", ")}`);
    if (layout.pageWidth > WIDTH) fail(`page scrolls sideways (${layout.pageWidth}px wide)`);
    console.log(`header below nav (${Math.round(layout.headerTop)} >= ${Math.round(layout.navBottom)}), `
      + `${layout.controls.length} controls on screen: ${layout.controls.map((c) => c.name).join(", ")}`);

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("PLANNER MOBILE: PASS");
  } catch (e) {
    console.log("PLANNER MOBILE: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
