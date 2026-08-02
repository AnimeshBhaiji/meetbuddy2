// meetbuddy2/e2e/schedule-editor.cjs
// Task 2 gate: the itinerary editor can set a date + start/end time, the times
// persist to the API, and reopening the saved plan shows them again.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

const fail = (msg) => { console.log("SCHEDULE EDITOR: FAIL —", msg); process.exit(1); };

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

  await page.goto("http://localhost:5173/planner");
  await page.waitForTimeout(1500);
  await page.click("text=Generate itinerary");
  await page.waitForSelector("text=Save itinerary", { timeout: 120000 });

  // --- set date + times ---
  await page.fill('input[aria-label="Planned date"]', "2026-08-05");
  await page.fill('input[aria-label="Start time"]', "15:00");
  await page.fill('input[aria-label="End time"]', "17:00");

  const title = "E2E scheduled plan";
  await page.fill('input[aria-label="Itinerary title"]', title);

  await page.click("text=Save itinerary");
  await page.waitForSelector("text=Saved", { timeout: 30000 });

  // --- what actually reached the database ---
  const rows = await page.evaluate(async (uid) => {
    const r = await fetch(`http://localhost:8000/itineraries?user_id=${uid}`);
    return r.json();
  }, USER_ID);
  const saved = rows.find((r) => r.title === title);
  if (!saved) fail("saved plan not returned by the API");
  console.log("API row:", JSON.stringify({
    start_at: saved.start_at, end_at: saved.end_at, all_day: saved.all_day }));

  if (!/^2026-08-05T15:00:00/.test(saved.start_at)) fail(`start_at wrong: ${saved.start_at}`);
  if (!/^2026-08-05T17:00:00/.test(saved.end_at)) fail(`end_at wrong: ${saved.end_at}`);
  if (saved.all_day !== false) fail("all_day should be false");

  // --- reopen and confirm the fields come back populated ---
  await page.goto("http://localhost:5173/itineraries");
  await page.waitForSelector(`text=${title}`, { timeout: 20000 });
  const whenLabel = await page.locator("p.text-sm.text-muted-foreground").first().innerText();
  console.log("My Plans shows:", whenLabel.replace(/\s+/g, " ").trim());

  await page.locator(`text=${title}`).first().click({ force: true }).catch(() => {});
  await page.goto("http://localhost:5173/itineraries");
  await page.waitForSelector("text=Open", { timeout: 20000 });
  const cards = page.locator("text=Open");
  await cards.first().click();
  await page.waitForSelector('input[aria-label="Planned date"]', { timeout: 30000 });

  const reopened = {
    date: await page.inputValue('input[aria-label="Planned date"]'),
    start: await page.inputValue('input[aria-label="Start time"]'),
    end: await page.inputValue('input[aria-label="End time"]'),
  };
  console.log("reopened editor:", JSON.stringify(reopened));
  if (reopened.date !== "2026-08-05") fail(`date not restored: ${reopened.date}`);
  if (reopened.start !== "15:00") fail(`start not restored: ${reopened.start}`);
  if (reopened.end !== "17:00") fail(`end not restored: ${reopened.end}`);

  // cleanup
  await page.evaluate(async ({ uid, id }) => {
    await fetch(`http://localhost:8000/itineraries/${id}?user_id=${uid}`, { method: "DELETE" });
  }, { uid: USER_ID, id: saved.id });

  console.log("SCHEDULE EDITOR: PASS");
  await browser.close();
})();
