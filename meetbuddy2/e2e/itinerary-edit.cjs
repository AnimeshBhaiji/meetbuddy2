// meetbuddy2/e2e/itinerary-edit.cjs
// Plan -> summary -> edit (note + remove) -> save -> reopen from My Plans.
// Needs backend :8000 + vite :5173 and a real logged-in user id (env USER_ID).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await page.evaluate((uid) => {
    localStorage.clear();
    localStorage.setItem("user", JSON.stringify({ user_id: uid, username: "test" }));
    localStorage.setItem("userPreferences", JSON.stringify({
      mood: "Romantic", planningStyle: "Surprise me", adventureLevel: "Stick to the city",
      memorableFactor: "Amazing food", location: "Indiranagar Bangalore",
    }));
  }, USER_ID);

  // Surprise mode -> straight to summary
  await page.goto("http://localhost:5173/planner");
  await page.waitForTimeout(1500);
  await page.click("text=Generate itinerary");
  await page.waitForSelector("text=Save itinerary", { timeout: 120000 });

  const stopsBefore = await page.locator('[aria-label="Remove stop"]').count();
  console.log("stops:", stopsBefore);

  // note on first stop
  await page.locator('[aria-label="Edit note"]').first().click();
  await page.fill('input[placeholder*="book a window table"]', "e2e note");
  await page.keyboard.press("Enter");

  // remove last stop (if >1)
  if (stopsBefore > 1) await page.locator('[aria-label="Remove stop"]').last().click();

  // title + save
  await page.fill('[aria-label="Itinerary title"]', "E2E plan");
  await page.click("text=Save itinerary");
  await page.waitForSelector("text=Saved!", { timeout: 30000 });

  // reopen from My Plans
  await page.goto("http://localhost:5173/itineraries");
  await page.waitForSelector("text=E2E plan", { timeout: 15000 });
  await page.click("text=Open");
  await page.waitForSelector("text=Save changes", { timeout: 15000 });
  const noteThere = (await page.locator("text=e2e note").count()) > 0;
  const stopsAfter = await page.locator('[aria-label="Remove stop"]').count();

  const pass = noteThere && (stopsBefore <= 1 || stopsAfter === stopsBefore - 1);
  console.log(pass ? "ITINERARY EDIT: PASS" : `ITINERARY EDIT: FAIL note=${noteThere} stops=${stopsAfter}/${stopsBefore}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
