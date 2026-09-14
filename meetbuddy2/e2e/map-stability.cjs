// meetbuddy2/e2e/map-stability.cjs
// The step map must stay put while you browse it:
//   - hovering an option card does not re-fit (snap back) a map you have panned
//   - re-sorting options updates the markers without tearing the map down
//   - moving to the next step re-fits the map to the new options, same map
//   - option thumbnails load lazily
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

// Full control exposes the sort controls and a multi-step flow.
const FULL_CONTROL_PREFS = {
  ...DEFAULT_PREFS,
  planningStyle: "Full control",
  planningStyle_sub: { fc_filters: ["Price"] },
};

const paneTransform = (page) =>
  page.evaluate(() => document.querySelector(".leaflet-map-pane")?.style.transform || "");
// A marker on the container survives re-renders but not a remount.
const tagMap = (page) =>
  page.evaluate(() => { document.querySelector(".leaflet-container").dataset.probe = "same-map"; });
const sameMap = (page) =>
  page.evaluate(() => document.querySelector(".leaflet-container")?.dataset.probe === "same-map");
const carouselTitles = (page) =>
  page.locator(".snap-start p.font-semibold").allTextContents();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let user = null;
  try {
    user = await createTestUser("map");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, FULL_CONTROL_PREFS);

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector(".snap-start", { timeout: 120000 });
    await page.waitForSelector(".leaflet-marker-icon", { timeout: 20000 });
    await page.waitForTimeout(1500); // let the initial fit settle
    await tagMap(page);

    // ---------- hover must not re-fit a panned map ----------
    const box = await page.locator(".leaflet-container").boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height * 0.45;
    // The pointer is still where "Generate itinerary" was, which is now over a
    // card, so that card's popup is open mid-map. A drag that starts on a popup
    // doesn't pan the map, so move off the cards and let it close first.
    await page.mouse.move(cx, box.y + 5);
    await page.waitForFunction(() => !document.querySelector(".leaflet-popup"), null, { timeout: 5000 });
    const beforePan = await paneTransform(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 220, cy + 120, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const panned = await paneTransform(page);
    if (panned === beforePan)
      fail(`the drag did not pan the map (still ${panned}), so the hover checks would prove nothing`);

    // hovering a card opens that place's popup on the map, without moving it
    const card = page.locator(".snap-start").first();
    const cardTitle = (await card.locator("p.font-semibold").first().textContent()).trim();
    await card.hover();
    await page.waitForTimeout(900);
    const popupText = (await page.locator(".leaflet-popup-content").allTextContents()).join(" ");
    if (!popupText.includes(cardTitle))
      fail(`hovering "${cardTitle}" did not open its popup on the map (popups: "${popupText}")`);
    if ((await paneTransform(page)) !== panned)
      fail(`hovering a card moved the map: ${panned} -> ${await paneTransform(page)}`);
    console.log(`hover: "${cardTitle}" popup opened, map did not move`);

    await page.mouse.move(cx, box.y + 5); // leave the card
    await page.waitForTimeout(900);
    const afterHover = await paneTransform(page);
    if (afterHover !== panned)
      fail(`hovering a card moved the map: ${panned} -> ${afterHover}`);
    if (await page.locator(".leaflet-popup").count())
      fail("the popup stayed open after the pointer left the card");
    console.log("hover: popup closed on leave, panned map stays where you left it");

    // ---------- re-sorting keeps the same map ----------
    const before = await carouselTitles(page);
    await page.click('[aria-label="Filters and steps"]');
    let reordered = false;
    for (const label of ["Nearest", "Top rated"]) {
      await page.locator("button", { hasText: label }).first().click();
      await page.waitForTimeout(900);
      if ((await carouselTitles(page)).join("|") !== before.join("|")) { reordered = true; break; }
    }
    if (!reordered) fail("neither sort changed the option order, so remounting can't be checked");
    if (!(await sameMap(page))) fail("re-sorting options remounted the whole map");
    const markers = await page.locator(".leaflet-marker-icon").count();
    if (markers === 0) fail("markers vanished after re-sorting");
    console.log(`sort: order changed, same map, ${markers} markers`);
    await page.click('[aria-label="Filters and steps"]');

    // ---------- lazy thumbnails ----------
    const imgs = await page.locator(".snap-start img").evaluateAll((els) =>
      els.map((e) => e.getAttribute("loading")));
    if (imgs.length === 0) fail("no carousel thumbnails rendered");
    if (imgs.some((l) => l !== "lazy")) fail(`thumbnails not lazy: ${JSON.stringify(imgs)}`);
    console.log(`images: ${imgs.length} carousel thumbnails load lazily`);

    // ---------- next step re-fits the same map to the new options ----------
    const firstTitles = await carouselTitles(page);
    const beforeSelect = await paneTransform(page);
    await page.locator('.snap-start button:has-text("Select")').first().click();
    await page.waitForFunction(
      (old) => {
        const t = [...document.querySelectorAll(".snap-start p.font-semibold")].map((p) => p.textContent);
        return t.length > 0 && t.join("|") !== old;
      },
      firstTitles.join("|"), { timeout: 120000 });
    await page.waitForTimeout(1500);
    if (!(await sameMap(page))) fail("moving to the next step remounted the whole map");
    if ((await paneTransform(page)) === beforeSelect)
      fail(`the map did not re-fit to the next step's options (pane stayed at ${beforeSelect}; ` +
           `open popups: ${await page.locator(".leaflet-popup").count()})`);
    console.log("next step: same map, re-fitted to the new options");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("MAP STABILITY: PASS");
  } catch (e) {
    console.log("MAP STABILITY: FAIL —", e.message);
    if (errors.length) console.log("page errors:", errors.join(" | "));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
