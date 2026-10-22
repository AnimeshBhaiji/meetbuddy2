// meetbuddy2/e2e/planned-flow.cjs
// The planner home's "Your planned flow" names the same steps the plan then
// runs. It used to show a fixed "Restaurant → Activity → Stay" while the real
// plan could be shorter; and answering "No" to Transport support dropped the
// stay step. Real backend (searches cached after the first run). Needs :8000 + :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };

const CASES = [
  { name: "romantic city date, no transport help", expect: ["Restaurant", "Activity / Things to do", "Stay / Hotel"],
    prefs: { mood: "Romantic", planningStyle: "Semi-custom", adventureLevel: "Stick to the city",
             location: "Indiranagar Bangalore", mood_sub: { ro_setting: "Candlelit / intimate" },
             adventureLevel_sub: { sc_area: "Central", sc_transport: "No" } } },
  { name: "business meeting", expect: ["Restaurant"],
    prefs: { mood: "Business-y", planningStyle: "Semi-custom", adventureLevel: "Stick to the city",
             location: "Indiranagar Bangalore" } },
];

const shownFlow = (page) => page.locator('[data-testid="planned-flow"]').innerText();

(async () => {
  const browser = await chromium.launch();
  let user = null;
  try {
    for (const c of CASES) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      user = await createTestUser("flow");
      await page.goto("http://localhost:5173/");
      await signIn(page, user, c.prefs);
      await page.goto("http://localhost:5173/planner");
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="planned-flow"]');
        return el && el.dataset.state === "ready";
      }, null, { timeout: 20000 });
      const shown = (await shownFlow(page)).split("→").map((s) => s.trim());
      if (JSON.stringify(shown) !== JSON.stringify(c.expect))
        fail(`${c.name}: home shows ${JSON.stringify(shown)}, expected ${JSON.stringify(c.expect)}`);

      await page.click("text=Generate itinerary");
      await page.waitForSelector('[data-testid="step-header"]', { timeout: 120000 });
      // the route dots exist only for flows longer than one step
      const run = await page.locator('[data-testid="step-header"] ol[aria-label="Plan progress"] li span[title]')
        .evaluateAll((els) => els.map((e) => e.getAttribute("title")));
      const runFlow = run.length ? run : ["Restaurant"];
      if (JSON.stringify(runFlow) !== JSON.stringify(shown))
        fail(`${c.name}: home showed ${JSON.stringify(shown)} but the plan runs ${JSON.stringify(runFlow)}`);
      console.log(`${c.name}: home and plan both ${shown.join(" → ")}`);
      await page.close();
      await deleteTestUser(user);
      user = null;
    }
    console.log("PLANNED FLOW: PASS");
  } catch (e) {
    console.log("PLANNED FLOW: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
