// meetbuddy2/e2e/filter-chips.cjs
// Full-control filter chips match Google's own place attributes, not words in a
// place's name: "Olive Bar & Kitchen" is not a live music venue because "olive"
// contains "live". The planner's session response is replaced with five known
// places, so the check is deterministic and spends no SerpAPI credits.
// Needs backend :8000 (for the test account) + vite :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

const PREFS = {
  ...DEFAULT_PREFS,
  planningStyle: "Full control",
  planningStyle_sub: { fc_filters: ["Private seating", "Dietary options", "Live music"] },
};

const place = (i, title, type, attributes) => ({
  place_id: `chip-${i}`, title, type, types: [type], attributes, rating: 4.5, reviews_count: 500,
  address: "Indiranagar, Bengaluru", lat: 12.9716 + i * 0.001, lng: 77.6412, distance_meters: 300 + i * 50,
  thumbnail: null, link: "",
});

const OPTIONS = [
  place(1, "Casa Nova", "Italian restaurant", { offerings: ["Private dining room", "Wine"] }),
  place(2, "Green Theory", "Cafe", { offerings: ["Vegetarian options", "Vegan options"] }),
  place(3, "Hard Rock Cafe", "American restaurant", { highlights: ["Live music"] }),
  place(4, "Olive Bar & Kitchen", "Bar", { offerings: ["Cocktails"], atmosphere: ["Trendy"] }),
  place(5, "Sattvam", "Vegetarian restaurant", { atmosphere: ["Casual"] }),
];

const EXPECTED = {
  "private seating": ["Casa Nova"],
  "dietary options": ["Green Theory", "Sattvam"],
  "live music": ["Hard Rock Cafe"],
};

const titles = async (page) =>
  (await page.locator(".snap-start p.font-semibold").allTextContents()).map((t) => t.trim()).sort();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let user = null;
  try {
    user = await createTestUser("chips");
    await page.goto("http://localhost:5173/");
    await signIn(page, user, PREFS);

    await page.route((url) => new URL(url).pathname === "/planner/session", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          session_id: "chips-session",
          initial: {
            options: OPTIONS, recommended_flow: ["restaurant"], plan_mode: "full",
            directives: { filters: Object.keys(EXPECTED), shortlist: null },
            location_hint: "Indiranagar",
          },
        }),
      });
    });

    await page.goto("http://localhost:5173/planner");
    await page.waitForTimeout(1200);
    await page.click("text=Generate itinerary");
    await page.waitForSelector(".snap-start", { timeout: 30000 });
    if ((await titles(page)).length !== OPTIONS.length) fail(`expected ${OPTIONS.length} cards, saw ${await titles(page)}`);

    await page.click('[aria-label="Filters and steps"]');
    for (const [chip, want] of Object.entries(EXPECTED)) {
      const button = page.locator("button", { hasText: chip }).first();
      await button.click();
      await page.waitForTimeout(600);
      const got = await titles(page);
      if (JSON.stringify(got) !== JSON.stringify([...want].sort()))
        fail(`chip "${chip}" showed ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
      console.log(`chip "${chip}": ${JSON.stringify(got)}`);
      await button.click(); // clear it before the next chip
      await page.waitForTimeout(400);
    }

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("FILTER CHIPS: PASS");
  } catch (e) {
    console.log("FILTER CHIPS: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
