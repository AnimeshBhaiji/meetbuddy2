// meetbuddy2/e2e/planner-flow.cjs
// Requires the playwright devDependency (npm install) plus browsers: npx playwright install chromium
// Smoke: seeded prefs -> 3-step planner flow -> summary. Needs backend :8000
// and vite :5173 running, and a warm/valid SerpAPI or cached searches.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn } = require("./_auth.cjs");

(async () => {
  const user = await createTestUser("pf");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await page.evaluate(() => localStorage.clear());
  await signIn(page, user);
  await page.evaluate(() => {
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
  await deleteTestUser(user);
  process.exit(done ? 0 : 1);
})();
