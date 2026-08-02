// meetbuddy2/e2e/calendar-slot-prefill.cjs
// Task 4 gate: clicking an empty calendar slot carries that date AND time into
// the planner, and the itinerary editor opens with them prefilled.
// Week-view click -> exact clicked time. Month-view click -> 12:00-14:00.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

const fail = (msg) => { console.log("SLOT PREFILL: FAIL —", msg); process.exit(1); };

const seedUser = (page) => page.evaluate((uid) => {
  localStorage.setItem("user", JSON.stringify({ user_id: uid, username: "test" }));
  localStorage.setItem("userPreferences", JSON.stringify({
    mood: "Romantic", planningStyle: "Surprise me", adventureLevel: "Stick to the city",
    memorableFactor: "Amazing food", location: "Indiranagar Bangalore",
  }));
}, USER_ID);

// Read what the planner actually received, without paying for a full plan run.
const slotFromState = (page) => page.evaluate(() => window.history.state?.usr?.slot ?? null);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto("http://localhost:5173/");
    await seedUser(page);

    // ---------- week view: click a specific hour ----------
    await page.goto("http://localhost:5173/calendar");
    await page.waitForSelector(".rbc-calendar", { timeout: 30000 });
    // view switcher is a Radix Select, not a button group
    await page.click('[role="combobox"]');
    await page.click('[role="option"]:has-text("Week")');
    await page.waitForSelector(".rbc-time-content", { timeout: 15000 });

    // Click the 9th hour row (rbc renders 24 hour-slot groups per day column).
    // Scroll the calendar's own time container — scrolling the page slides the
    // target under the fixed navbar, which then eats the click. Use raw mouse
    // coordinates: rbc's own overlay divs fail Playwright's actionability check
    // even though a real click passes straight through them to the day slot.
    await page.evaluate(() => {
      const content = document.querySelector(".rbc-time-content");
      const group = document.querySelectorAll(".rbc-day-slot .rbc-timeslot-group")[9];
      if (content && group) content.scrollTop = group.offsetTop - 60;
    });
    await page.waitForTimeout(400);

    const box = await page.locator(".rbc-day-slot").nth(2)
      .locator(".rbc-timeslot-group").nth(9).boundingBox();
    if (!box) fail("could not locate the 9:00 slot");
    if (box.y < 140) fail(`9:00 slot sits under the navbar (y=${box.y})`);
    const x = box.x + box.width / 2, y = box.y + 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();

    await page.waitForURL("**/planner", { timeout: 15000 });
    const weekSlot = await slotFromState(page);
    if (!weekSlot) fail("week click did not pass a slot to the planner");
    console.log("week click ->", JSON.stringify(weekSlot));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekSlot.date)) fail(`bad date: ${weekSlot.date}`);
    if (weekSlot.startTime !== "09:00") fail(`expected 09:00 start, got ${weekSlot.startTime}`);
    if (weekSlot.endTime !== "11:00") fail(`expected 2h block ending 11:00, got ${weekSlot.endTime}`);

    // ---------- month view: click a day cell ----------
    await page.goto("http://localhost:5173/calendar");
    await page.waitForSelector(".rbc-month-view", { timeout: 30000 });
    await page.locator(".rbc-day-bg").nth(15).click();

    await page.waitForURL("**/planner", { timeout: 15000 });
    const monthSlot = await slotFromState(page);
    if (!monthSlot) fail("month click did not pass a slot to the planner");
    console.log("month click ->", JSON.stringify(monthSlot));
    if (monthSlot.startTime !== "12:00") fail(`expected 12:00 default, got ${monthSlot.startTime}`);
    if (monthSlot.endTime !== "14:00") fail(`expected 14:00 default, got ${monthSlot.endTime}`);

    // ---------- the prefill actually lands in the editor ----------
    await page.waitForTimeout(1500);
    await page.click("text=Generate itinerary");
    await page.waitForSelector('input[aria-label="Planned date"]', { timeout: 120000 });
    const editor = {
      date: await page.inputValue('input[aria-label="Planned date"]'),
      start: await page.inputValue('input[aria-label="Start time"]'),
      end: await page.inputValue('input[aria-label="End time"]'),
    };
    console.log("editor prefilled:", JSON.stringify(editor));
    if (editor.date !== monthSlot.date) fail(`editor date ${editor.date} != slot ${monthSlot.date}`);
    if (editor.start !== "12:00") fail(`editor start ${editor.start}`);
    if (editor.end !== "14:00") fail(`editor end ${editor.end}`);

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("SLOT PREFILL: PASS");
  } finally {
    await browser.close();
  }
})();
