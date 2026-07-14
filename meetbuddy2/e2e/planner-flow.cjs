// meetbuddy2/e2e/planner-flow.cjs
// Requires the playwright devDependency (npm install) plus browsers: npx playwright install chromium
// Smoke: seeded prefs -> 3-step planner flow -> summary. Needs backend :8000
// and vite :5173 running, and a warm/valid SerpAPI or cached searches.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({ user_id: 1, username: "test" }));
    localStorage.setItem("userPreferences", JSON.stringify({
      mood: "Romantic", planningStyle: "Full control", adventureLevel: "Stick to the city",
      memorableFactor: "Amazing food",
      location: "Indiranagar Bangalore",
    }));
  });
  await page.goto("http://localhost:5173/planner");
  await page.waitForTimeout(1500);
  await page.click("text=Generate itinerary");
  await page.waitForSelector("text=Select", { timeout: 90000 });
  for (let i = 0; i < 3; i++) {
    const sel = page.locator('button:has-text("Select")').first();
    if (!(await sel.count())) break;
    await sel.click();
    await page.waitForTimeout(4000);
    if (await page.locator("text=Your perfect").count()) break;
  }
  const done = (await page.locator("text=Your perfect").count()) > 0;
  console.log(done ? "PLANNER FLOW: PASS" : "PLANNER FLOW: FAIL");
  await browser.close();
  process.exit(done ? 0 : 1);
})();
