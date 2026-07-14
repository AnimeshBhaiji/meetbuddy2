// meetbuddy2/e2e/itinerary-edit.cjs
// Requires playwright (not a repo dependency): npm i -D playwright && npx playwright install chromium — or set NODE_PATH to a directory containing it.
// Plan -> summary -> edit (note + cached add + reorder + remove) -> save -> reopen from My Plans.
// Needs backend :8000 + vite :5173 and a real logged-in user id (env USER_ID).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

const firstStopTitle = (page) =>
  page.locator("p.text-sm.text-white.font-medium.truncate").first().textContent();

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

  let stopCount = await page.locator('[aria-label="Remove stop"]').count();
  console.log("stops:", stopCount);

  // note on first stop
  await page.locator('[aria-label="Edit note"]').first().click();
  await page.fill('input[placeholder*="book a window table"]', "e2e note");
  await page.keyboard.press("Enter");

  // --- cached add: pick a cached suggestion if one exists, else close cleanly ---
  await page.locator("text=add a stop here").first().click();
  await page.waitForSelector('[aria-label="Close"]', { timeout: 10000 });
  const suggestionRows = page.locator("button:has(p.truncate)");
  if ((await suggestionRows.count()) > 0) {
    await suggestionRows.first().click();
    stopCount += 1;
  } else {
    console.log("add: no cached suggestions, skipped");
    await page.click('[aria-label="Close"]');
  }
  await page.waitForSelector('[aria-label="Close"]', { state: "hidden", timeout: 10000 });

  // --- reorder: real drag of the first stop's handle past the second row ---
  let reorderOk = false;
  let titleAfterDrag = null;
  if (stopCount > 1) {
    const titleBeforeDrag = await firstStopTitle(page);
    for (let attempt = 1; attempt <= 3 && !reorderOk; attempt++) {
      const handle = page.locator("svg.lucide-grip-vertical").first();
      const rows = page.locator(".cursor-grab");
      const startBox = await handle.boundingBox();
      const secondRowBox = await rows.nth(1).boundingBox();
      const startX = startBox.x + startBox.width / 2;
      const startY = startBox.y + startBox.height / 2;
      const targetY = secondRowBox.y + secondRowBox.height + 10;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(startX, startY + ((targetY - startY) * i) / steps);
        await page.waitForTimeout(40);
      }
      await page.mouse.up();
      await page.waitForTimeout(300);

      titleAfterDrag = await firstStopTitle(page);
      reorderOk = titleAfterDrag !== titleBeforeDrag;
      if (!reorderOk) console.log(`reorder: attempt ${attempt} produced no change`);
    }
    console.log(reorderOk ? "REORDER: PASS (order changed)" : "REORDER: FAIL after 3 attempts (see distinct finding)");
  } else {
    console.log("reorder: fewer than 2 stops, skipped");
  }

  // remove last stop (if >1)
  if (stopCount > 1) {
    await page.locator('[aria-label="Remove stop"]').last().click();
    stopCount -= 1;
  }

  // title + save
  await page.fill('[aria-label="Itinerary title"]', "E2E plan");
  await page.click("text=Save itinerary");
  await page.waitForSelector("text=Saved!", { timeout: 30000 });

  // reopen from My Plans
  await page.goto("http://localhost:5173/itineraries");
  await page.waitForSelector("text=E2E plan", { timeout: 15000 });
  await page.locator("div.p-5", { hasText: "E2E plan" }).getByText("Open").click();
  await page.waitForSelector("text=Save changes", { timeout: 15000 });
  const noteThere = (await page.locator("text=e2e note").count()) > 0;
  const stopsAfter = await page.locator('[aria-label="Remove stop"]').count();
  const titleAfterReopen = await firstStopTitle(page);
  const reorderPersisted = !reorderOk || titleAfterReopen === titleAfterDrag;

  const pass = noteThere && stopsAfter === stopCount && reorderPersisted && (stopCount <= 1 || reorderOk);
  console.log(pass
    ? "ITINERARY EDIT: PASS"
    : `ITINERARY EDIT: FAIL note=${noteThere} stops=${stopsAfter}/${stopCount} reorderOk=${reorderOk} reorderPersisted=${reorderPersisted}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
