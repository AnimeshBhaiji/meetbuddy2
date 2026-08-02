// meetbuddy2/e2e/calendar-events.cjs
// Task 3 gate: saved plans (timed + all-day) actually render on the calendar,
// the fake "Team Lunch" sample is gone, and clicking an event shows real stops.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);
const API = "http://localhost:8000";

const fail = (msg) => { console.log("CALENDAR EVENTS: FAIL —", msg); process.exit(1); };

// A date the calendar will be showing: the 15th of the current month.
const d = new Date();
const day = new Date(d.getFullYear(), d.getMonth(), 15);
const iso = (dt) => {
  const p = (n) => String(n).padStart(2, "0");
  const off = -dt.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:00${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
};

(async () => {
  // --- seed via the API ---
  const mk = async (body) => {
    const r = await fetch(`${API}/itineraries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, ...body }),
    });
    if (!r.ok) fail(`seed failed: ${r.status} ${await r.text()}`);
    return r.json();
  };

  const timedStart = new Date(day); timedStart.setHours(15, 0, 0, 0);
  const timedEnd = new Date(day); timedEnd.setHours(17, 0, 0, 0);
  const allDayStart = new Date(day.getFullYear(), day.getMonth(), 16, 0, 0, 0, 0);
  const allDayEnd = new Date(day.getFullYear(), day.getMonth(), 17, 0, 0, 0, 0);

  const timed = await mk({
    title: "E2E Timed Plan", start_at: iso(timedStart), end_at: iso(timedEnd), all_day: false,
    stops: [{ step: "restaurant", place: { title: "Test Bistro", address: "1 Test Rd" }, note: "window seat" }],
  });
  const allDay = await mk({
    title: "E2E All Day Plan", start_at: iso(allDayStart), end_at: iso(allDayEnd), all_day: true, stops: [],
  });
  const unscheduled = await mk({ title: "E2E Unscheduled Plan", stops: [] });

  const cleanup = async () => {
    for (const id of [timed.id, allDay.id, unscheduled.id]) {
      await fetch(`${API}/itineraries/${id}?user_id=${USER_ID}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto("http://localhost:5173/");
    await page.evaluate((uid) => {
      localStorage.setItem("user", JSON.stringify({ user_id: uid, username: "test" }));
    }, USER_ID);

    await page.goto("http://localhost:5173/calendar");
    await page.waitForSelector(".rbc-calendar", { timeout: 30000 });
    await page.waitForTimeout(2500);

    const bodyText = await page.locator("body").innerText();

    // the fake sample event must be gone
    if (/Team Lunch/.test(bodyText)) fail('hardcoded "Team Lunch" sample still rendering');

    // both scheduled plans must be on the grid
    if (!/E2E Timed Plan/.test(bodyText)) fail("timed plan not shown on the calendar");
    if (!/E2E All Day Plan/.test(bodyText)) fail("all-day plan not shown on the calendar");

    // the unscheduled plan must NOT be (it has no date to sit on)
    if (/E2E Unscheduled Plan/.test(bodyText)) fail("unscheduled plan should not appear on the calendar");
    console.log("timed + all-day rendered; unscheduled correctly hidden");

    // all-day plans belong in the all-day row, not as a timed block
    const allDayRow = await page.locator(".rbc-event", { hasText: "E2E All Day Plan" }).count();
    if (allDayRow === 0) fail("all-day event element missing");

    // --- click the timed event: modal shows real stops from the API ---
    await page.locator(".rbc-event", { hasText: "E2E Timed Plan" }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(1500);
    const modal = await page.locator('[role="dialog"]').innerText();
    if (!/Test Bistro/.test(modal)) fail(`modal missing real stop. Got: ${modal.replace(/\s+/g, " ")}`);
    if (!/window seat/.test(modal)) fail("modal missing the stop note");
    const when = await page.locator('[data-testid="event-when"]').innerText();
    console.log("modal when:", when.trim(), "| stops shown: Test Bistro ✓");
    if (!/3:00 PM/.test(when)) fail(`modal time wrong: ${when}`);

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("CALENDAR EVENTS: PASS");
  } finally {
    await cleanup();
    await browser.close();
  }
})();
