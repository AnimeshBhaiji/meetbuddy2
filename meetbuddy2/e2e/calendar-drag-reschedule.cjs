// meetbuddy2/e2e/calendar-drag-reschedule.cjs
// Task 6 gate: dragging an event to a new time persists via PUT and survives a
// page reload; resizing changes the duration; a failed write rolls back.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const { API, createTestUser, deleteTestUser, signIn } = require("./_auth.cjs");

// Throws rather than process.exit: exiting here would skip the finally block
// and leave seeded plans behind in the database.
const fail = (msg) => { throw new Error(msg); };
const report = (e) => { console.log("DRAG RESCHEDULE: FAIL —", e.message); process.exitCode = 1; };

const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const iso = (dt) => {
  const off = -dt.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:00${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
};

// Put the event mid-way through the CURRENT week (weeks start Monday here), so
// week view shows it without needing toolbar navigation.
const monday = new Date(d);
monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
const target = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
const startAt = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 10, 0, 0, 0);
const endAt = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0, 0);

let user = null;
const fetchPlan = async (id) =>
  (await fetch(`${API}/itineraries/${id}`, { headers: user.headers })).json();

(async () => {
  user = await createTestUser("dr");
  const created = await (await fetch(`${API}/itineraries`, {
    method: "POST", headers: user.headers,
    body: JSON.stringify({
      title: "E2E Drag Plan",
      start_at: iso(startAt), end_at: iso(endAt), all_day: false,
      stops: [{ step: "restaurant", place: { title: "Drag stop" }, note: "" }],
    }),
  })).json();
  if (!created.id) fail("could not seed plan");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const gotoWeekOfEvent = async () => {
    await page.goto("http://localhost:5173/calendar");
    await page.waitForSelector(".rbc-calendar", { timeout: 30000 });
    await page.click('[role="combobox"]');
    await page.click('[role="option"]:has-text("Week")');
    await page.waitForSelector(".rbc-time-content", { timeout: 15000 });
    await page.waitForTimeout(1200);
    // scroll the event into the middle of the grid, clear of the fixed navbar
    await page.evaluate(() => {
      const content = document.querySelector(".rbc-time-content");
      const ev = document.querySelector(".rbc-event");
      if (content && ev) content.scrollTop = Math.max(0, ev.offsetTop - 220);
    });
    await page.waitForTimeout(400);
  };

  try {
    await page.goto("http://localhost:5173/");
    await signIn(page, user);

    await gotoWeekOfEvent();

    const before = await fetchPlan(created.id);
    console.log("before drag:", before.start_at, "->", before.end_at);

    // ---------- drag the event down two hours ----------
    const ev = page.locator(".rbc-event", { hasText: "E2E Drag Plan" }).first();
    let box = await ev.boundingBox();
    if (!box) fail("event not rendered in week view");
    if (box.y < 140) fail(`event under the navbar (y=${box.y}); cannot drag reliably`);

    const slotH = await page.evaluate(() => {
      const g = document.querySelector(".rbc-day-slot .rbc-timeslot-group");
      return g ? g.getBoundingClientRect().height : 0;   // one hour
    });
    if (!slotH) fail("could not measure hour height");

    const cx = box.x + box.width / 2, cy = box.y + 10;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + slotH, { steps: 12 });      // +1h
    await page.mouse.move(cx, cy + slotH * 2, { steps: 12 });  // +2h
    await page.mouse.up();
    await page.waitForTimeout(2000);

    const afterDrag = await fetchPlan(created.id);
    console.log("after drag: ", afterDrag.start_at, "->", afterDrag.end_at);
    if (afterDrag.start_at === before.start_at) fail("drag did not persist a new start time");

    const movedHours =
      (new Date(afterDrag.start_at) - new Date(before.start_at)) / 3600000;
    if (movedHours <= 0) fail(`event moved backwards (${movedHours}h)`);
    const durBefore = new Date(before.end_at) - new Date(before.start_at);
    const durAfter = new Date(afterDrag.end_at) - new Date(afterDrag.start_at);
    if (durBefore !== durAfter) fail("drag changed the duration; it should only move the block");
    console.log(`moved +${movedHours}h, duration preserved (${durAfter / 3600000}h)`);

    // ---------- reload: the new time must stick ----------
    await gotoWeekOfEvent();
    const reloaded = await fetchPlan(created.id);
    if (reloaded.start_at !== afterDrag.start_at) fail("time did not survive reload");
    const shown = await page.locator(".rbc-event", { hasText: "E2E Drag Plan" }).count();
    if (shown === 0) fail("event missing from the grid after reload");
    console.log("survived reload at", reloaded.start_at);

    // ---------- resize the bottom edge ----------
    // Scope the anchor to THIS event: the grid holds several resize anchors and
    // a page-wide .last() picks a zero-height one belonging to something else.
    const eventEl = page.locator(".rbc-event", { hasText: "E2E Drag Plan" }).first();
    await eventEl.hover();
    const handle = eventEl.locator(".rbc-addons-dnd-resize-ns-anchor").last();
    const hb = await handle.boundingBox();
    if (!hb) fail("bottom resize anchor not found on the event");

    const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx, hy + slotH / 2, { steps: 8 });
    await page.mouse.move(hx, hy + slotH, { steps: 8 });   // +1h
    await page.mouse.up();
    await page.waitForTimeout(2000);

    const afterResize = await fetchPlan(created.id);
    const newDur = new Date(afterResize.end_at) - new Date(afterResize.start_at);
    console.log("after resize duration:", newDur / 3600000, "h");
    if (newDur <= durAfter) fail("resize did not lengthen the plan");
    if (afterResize.start_at !== afterDrag.start_at) fail("resize moved the start time");

    // ---------- failed write must roll back ----------
    await gotoWeekOfEvent();
    const stateBeforeFail = await fetchPlan(created.id);
    await page.route("**/itineraries/**", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue());

    box = await page.locator(".rbc-event", { hasText: "E2E Drag Plan" }).first().boundingBox();
    const fx = box.x + box.width / 2, fy = box.y + 10;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    await page.mouse.move(fx, fy + slotH * 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    if (!/Couldn't save the new time/.test(bodyText)) fail("no rollback message on failed save");
    const unchanged = await fetchPlan(created.id);
    if (unchanged.start_at !== stateBeforeFail.start_at) fail("server changed despite aborted PUT");
    console.log("failed write rolled back and reported");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("DRAG RESCHEDULE: PASS");
  } catch (e) {
    report(e);
  } finally {
    await deleteTestUser(user);   // removes the account and its plan
    await browser.close();
  }
})();
