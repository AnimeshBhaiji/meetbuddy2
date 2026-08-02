// meetbuddy2/e2e/calendar-open-plan.cjs
// Task 5 gate: clicking a calendar event and hitting "Open plan" actually
// opens THAT itinerary in the editor, with its own title and times loaded.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);
const API = "http://localhost:8000";

const fail = (msg) => { console.log("OPEN PLAN: FAIL —", msg); process.exit(1); };

const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const iso = (dt) => {
  const off = -dt.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:00${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
};

(async () => {
  // Two plans on different days, so "opened the right one" is a real assertion.
  const mk = async (title, dayNum, hour) => {
    const start = new Date(d.getFullYear(), d.getMonth(), dayNum, hour, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), dayNum, hour + 2, 0, 0, 0);
    const r = await fetch(`${API}/itineraries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: USER_ID, title, start_at: iso(start), end_at: iso(end), all_day: false,
        stops: [{ step: "restaurant", place: { title: `${title} stop` }, note: "" }],
      }),
    });
    if (!r.ok) fail(`seed failed: ${await r.text()}`);
    return r.json();
  };

  const decoy = await mk("E2E Decoy Plan", 10, 9);
  const target = await mk("E2E Target Plan", 20, 16);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
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

    // the old modal had two buttons that both did nothing useful
    await page.locator(".rbc-event", { hasText: "E2E Target Plan" }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    const modalText = await page.locator('[role="dialog"]').innerText();
    if (/View details/.test(modalText)) fail("dead 'View details' button still present");

    await page.click("text=Open plan");

    // must land in the editor with the TARGET plan loaded, not the decoy
    await page.waitForSelector('input[aria-label="Itinerary title"]', { timeout: 30000 });
    await page.waitForTimeout(800);
    const loaded = {
      title: await page.inputValue('input[aria-label="Itinerary title"]'),
      date: await page.inputValue('input[aria-label="Planned date"]'),
      start: await page.inputValue('input[aria-label="Start time"]'),
      end: await page.inputValue('input[aria-label="End time"]'),
    };
    console.log("opened editor:", JSON.stringify(loaded));

    if (loaded.title !== "E2E Target Plan") fail(`opened the wrong plan: ${loaded.title}`);
    if (loaded.date !== `${d.getFullYear()}-${p(d.getMonth() + 1)}-20`) fail(`wrong date: ${loaded.date}`);
    if (loaded.start !== "16:00") fail(`wrong start: ${loaded.start}`);
    if (loaded.end !== "18:00") fail(`wrong end: ${loaded.end}`);

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("OPEN PLAN: PASS");
  } finally {
    for (const id of [decoy.id, target.id]) {
      await fetch(`${API}/itineraries/${id}?user_id=${USER_ID}`, { method: "DELETE" }).catch(() => {});
    }
    await browser.close();
  }
})();
