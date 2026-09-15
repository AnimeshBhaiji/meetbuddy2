// meetbuddy2/e2e/map-tiles.cjs
// The map's base tiles load from a provider that needs no API key (CARTO's
// dark tiles started returning an "API KEY REQUIRED" watermark), and zooming in
// past the provider's last real zoom level never requests the "Map data not yet
// available" placeholder tiles. The session response is replaced with known
// places, so this spends no SerpAPI credits. Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };
const TILE_HOST = "server.arcgisonline.com";
const MAX_NATIVE_ZOOM = 16;

const place = (i, title) => ({
  place_id: `tile-${i}`, title, type: "Restaurant", types: ["Restaurant"], attributes: {}, rating: 4.4,
  reviews_count: 900, address: "Indiranagar", lat: 12.9716 + i * 0.003, lng: 77.6412 + i * 0.002,
  distance_meters: 400 + i * 100, thumbnail: null, link: "",
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const tileRequests = [];
  const tileFailures = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image" && /\/tile\/|basemaps|\/\d+\/\d+\/\d+/.test(r.url())) tileRequests.push(r.url());
  });
  page.on("response", (r) => {
    if (tileRequests.includes(r.url()) && r.status() >= 400) tileFailures.push(`${r.status()} ${r.url()}`);
  });

  let user = null;
  try {
    user = await createTestUser("tiles");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, { ...DEFAULT_PREFS, planningStyle: "Full control", planningStyle_sub: { fc_filters: ["Price"] } });
    await page.route((u) => new URL(u).pathname === "/planner/session", (route) =>
      route.request().method() !== "POST" ? route.continue() : route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ session_id: "tiles", initial: {
          options: ["Chianti", "Bohemians", "MisoSexy"].map((t, i) => place(i, t)),
          recommended_flow: ["restaurant"], plan_mode: "full",
          directives: { filters: ["price"], shortlist: null }, location_hint: "Indiranagar" } }),
      }));

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector(".snap-start", { timeout: 30000 });
    await page.waitForSelector("img.leaflet-tile-loaded", { timeout: 20000 });
    await page.waitForTimeout(1500);

    const hosts = await page.locator("img.leaflet-tile").evaluateAll((imgs) => imgs.map((i) => new URL(i.src).host));
    const wrongHosts = [...new Set(hosts.filter((h) => h !== "server.arcgisonline.com"))];
    if (!hosts.length) fail("no map tiles rendered");
    if (wrongHosts.length) fail(`tiles still load from ${wrongHosts.join(", ")}`);
    console.log(`initial view: ${hosts.length} tiles, all from ${TILE_HOST}`);

    // zoom in to street level, past the provider's last real zoom
    const box = await page.locator(".leaflet-container").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(450); }
    await page.waitForTimeout(2000);
    const zooms = tileRequests.map((u) => Number((u.match(/\/tile\/(\d+)\//) || u.match(/\/(\d+)\/\d+\/\d+/) || [])[1])).filter((z) => z);
    const tooDeep = zooms.filter((z) => z > MAX_NATIVE_ZOOM);
    if (tooDeep.length) fail(`requested ${tooDeep.length} tiles beyond zoom ${MAX_NATIVE_ZOOM} (placeholder tiles)`);
    console.log(`zoomed in: highest tile zoom requested ${Math.max(...zooms)}, none beyond ${MAX_NATIVE_ZOOM}`);

    if (tileFailures.length) fail(`tile requests failed: ${tileFailures.slice(0, 3).join(" | ")}`);
    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("MAP TILES: PASS");
  } catch (e) {
    console.log("MAP TILES: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
