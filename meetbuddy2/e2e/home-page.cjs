// meetbuddy2/e2e/home-page.cjs
// The signed-in home shows the account's real plans: the next dated plan on
// the ticket, that day lit in the week strip, every saved plan in the row,
// and a first-meetup invitation for an account with none. Opening the ticket
// opens that plan in the planner. Needs :8000 + :5173.
const { chromium } = require("playwright");
const { createTestUser, deleteTestUser, signIn, API, DEFAULT_PREFS } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };
const inDays = (n, h) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(h)}:00:00`;
};
const stop = (step, title) => ({ step, place: { title }, note: "" });

(async () => {
  const browser = await chromium.launch();
  let withPlans = null, fresh = null;
  try {
    withPlans = await createTestUser("homea");
    fresh = await createTestUser("homeb");
    const plans = [
      { title: "Later dinner", start_at: inDays(5, 20), end_at: inDays(5, 22), stops: [stop("restaurant", "A")] },
      { title: "Soonest outing", start_at: inDays(2, 19), end_at: inDays(2, 21), stops: [stop("restaurant", "B"), stop("activity", "C")] },
      { title: "Undated idea", stops: [stop("activity", "D")] },
    ];
    for (const p of plans) {
      const r = await fetch(`${API}/itineraries`, { method: "POST", headers: withPlans.headers, body: JSON.stringify(p) });
      if (!r.ok) fail(`saving a plan returned ${r.status}`);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:5173/");
    await signIn(page, withPlans, DEFAULT_PREFS);
    await page.goto("http://localhost:5173/home");

    const ticket = page.locator(".hp-ticket");
    await ticket.waitFor({ timeout: 15000 });
    const ticketText = await ticket.innerText();
    if (!ticketText.includes("Soonest outing")) fail(`ticket shows ${JSON.stringify(ticketText)}, expected the soonest plan`);
    if (!/2\s*days to go/.test(ticketText)) fail(`ticket countdown reads ${JSON.stringify(ticketText)}`);

    const litDays = await page.locator(".hp-day.has-plan").count();
    if (litDays !== 2) fail(`week strip lights ${litDays} days, expected 2`);

    const saved = await page.locator('.hp-plan:not([tabindex="-1"]) .hp-plan__title').allInnerTexts();
    for (const t of ["Later dinner", "Soonest outing", "Undated idea"])
      if (!saved.includes(t)) fail(`saved row is missing ${t}: ${JSON.stringify(saved)}`);

    await ticket.click();
    await page.waitForURL("**/planner**", { timeout: 10000 });
    await page.getByText("Your perfect").first().waitFor({ timeout: 15000 });
    await page.close();

    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page2.goto("http://localhost:5173/");
    await signIn(page2, fresh, DEFAULT_PREFS);
    await page2.goto("http://localhost:5173/home");
    await page2.getByText("Your first meetup starts here.").waitFor({ timeout: 15000 });
    if (await page2.locator(".hp-ticket").count()) fail("a new account shows a ticket");
    await page2.close();

    console.log("HOME PAGE: PASS");
  } catch (e) {
    console.log("HOME PAGE: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await deleteTestUser(withPlans);
    await deleteTestUser(fresh);
  }
})();
