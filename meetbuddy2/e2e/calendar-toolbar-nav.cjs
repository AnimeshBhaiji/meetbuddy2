// meetbuddy2/e2e/calendar-toolbar-nav.cjs
// Task 7 gate: prev/next step by the unit the current view shows —
// a month in month view, 7 days in week view, 1 day in day view.
// Needs vite :5173 (no backend data required).
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn } = require("./_auth.cjs");

const fail = (msg) => { console.log("TOOLBAR NAV: FAIL —", msg); process.exit(1); };

// The range the grid is actually showing, read from the rendered cells.
const visibleDays = (page) => page.evaluate(() => {
  const cells = [...document.querySelectorAll(".rbc-date-cell, .rbc-header")]
    .map((el) => el.getAttribute("aria-label") || el.textContent.trim())
    .filter(Boolean);
  return cells.slice(0, 8);
});

const setView = async (page, name) => {
  await page.click('[role="combobox"]');
  await page.click(`[role="option"]:has-text("${name}")`);
  await page.waitForTimeout(700);
};

const heading = (page) => page.locator('[data-testid="calendar-heading"]').innerText();

(async () => {
  const user = await createTestUser("tb");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto("http://localhost:5173/");
    await signIn(page, user);
    await page.goto("http://localhost:5173/calendar");
    await page.waitForSelector(".rbc-calendar", { timeout: 30000 });
    await page.waitForTimeout(1500);

    const next = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-right") }).first();
    const prev = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-left") }).first();

    // ---------- month view: one month ----------
    const monthBefore = await heading(page);
    await next.click(); await page.waitForTimeout(600);
    const monthAfter = await heading(page);
    console.log(`month: "${monthBefore}" -> "${monthAfter}"`);
    if (monthBefore === monthAfter) fail("month view: next did not advance");
    await prev.click(); await page.waitForTimeout(600);
    if ((await heading(page)) !== monthBefore) fail("month view: prev did not return");

    // ---------- week view: exactly 7 days ----------
    await setView(page, "Week");
    const weekBefore = await visibleDays(page);
    await next.click(); await page.waitForTimeout(700);
    const weekAfter = await visibleDays(page);
    console.log("week before:", weekBefore.slice(0, 3).join(" | "));
    console.log("week after: ", weekAfter.slice(0, 3).join(" | "));
    if (JSON.stringify(weekBefore) === JSON.stringify(weekAfter)) fail("week view: next did nothing");

    // the new week must start the day after the old week ended -> no overlap,
    // and no month-sized jump (which would leave a 3+ week gap)
    const dayNum = (s) => { const m = String(s).match(/(\d{1,2})/); return m ? Number(m[1]) : null; };
    const firstBefore = dayNum(weekBefore[0]), firstAfter = dayNum(weekAfter[0]);
    if (firstBefore == null || firstAfter == null) fail("could not read week day numbers");
    let delta = firstAfter - firstBefore;
    if (delta < 0) delta += 30; // crossed a month boundary
    if (delta !== 7) fail(`week view advanced ${delta} days, expected 7`);
    console.log("week advanced exactly 7 days");

    await prev.click(); await page.waitForTimeout(700);
    if (JSON.stringify(await visibleDays(page)) !== JSON.stringify(weekBefore))
      fail("week view: prev did not return to the same week");

    // ---------- day view: exactly 1 day ----------
    await setView(page, "Day");
    const dayBefore = await heading(page);
    await next.click(); await page.waitForTimeout(700);
    const dayAfter = await heading(page);
    console.log(`day: "${dayBefore}" -> "${dayAfter}"`);
    // heading reads like "August 3, 2026" — take the day, not the year
    const dbNum = Number(dayBefore.match(/\b(\d{1,2}),/)?.[1] ?? dayNum(dayBefore));
    const daNum = Number(dayAfter.match(/\b(\d{1,2}),/)?.[1] ?? dayNum(dayAfter));
    let dDelta = daNum - dbNum;
    if (dDelta < 0) dDelta += 30;
    if (dDelta !== 1) fail(`day view advanced ${dDelta} days, expected 1`);
    console.log("day advanced exactly 1 day");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("TOOLBAR NAV: PASS");
  } finally {
    await browser.close();
    await deleteTestUser(user);
  }
})();
