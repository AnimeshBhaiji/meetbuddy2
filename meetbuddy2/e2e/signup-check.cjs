// meetbuddy2/e2e/signup-check.cjs
// Drives the two-stage signup form for real, and checks that a server-side
// rejection (duplicate email) is shown to the user — the error branch rewritten
// during the api-client migration.
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const API = "http://localhost:8000";

const tag = Date.now().toString().slice(-8);
const U = {
  first_name: "E2E", last_name: "Signup", username: `su_${tag}`,
  email: `su-${tag}@test.local`, phone: `8${tag}`, password: "TestPass123!",
};

const fillStage1 = async (page, u) => {
  await page.fill('input[name="first_name"]', u.first_name);
  await page.fill('input[name="last_name"]', u.last_name);
  await page.fill('input[name="username"]', u.username);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="phone"]', u.phone);
};
const fillStage2 = async (page, u) => {
  await page.fill('input[name="password"]', u.password);
  await page.fill('input[name="repeatPassword"]', u.password);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fail = (m) => { throw new Error(m); };

  try {
    // ---------- happy path through the real form ----------
    await page.goto("http://localhost:5173/signup");
    await page.waitForSelector('input[name="first_name"]', { timeout: 20000 });
    await fillStage1(page, U);
    await page.click('button:has-text("Next step")');
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await fillStage2(page, U);
    await page.click('button:has-text("Create account")');

    await page.waitForURL("**/questionnaire-stage1", { timeout: 25000 });
    const stored = await page.evaluate(() => localStorage.getItem("user"));
    if (!stored || !JSON.parse(stored).user_id) fail("signup did not store the user");
    console.log("signup: account created through the UI, landed on questionnaire");

    // ---------- duplicate email must show the server's reason ----------
    await page.evaluate(() => localStorage.clear());
    await page.goto("http://localhost:5173/signup");
    await page.waitForSelector('input[name="first_name"]', { timeout: 20000 });
    await fillStage1(page, { ...U, username: `${U.username}x`, phone: `7${tag}` }); // same email
    await page.click('button:has-text("Next step")');
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await fillStage2(page, U);
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(2500);

    const body = await page.locator("body").innerText();
    if (!/Email already registered/i.test(body))
      fail(`server rejection not shown. Body: ${body.slice(0, 400)}`);
    if (page.url().includes("questionnaire")) fail("navigated away despite a failed signup");
    console.log("signup: duplicate rejected with the server's message, stayed on the form");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("SIGNUP CHECK: PASS");
  } catch (e) {
    console.log("SIGNUP CHECK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    // The account was created through the UI, so ask the login endpoint for its
    // id before removing it (cascading any itineraries it picked up).
    try {
      const r = await fetch(`${API}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: U.username, password: U.password }),
      });
      if (r.ok) {
        const { user_id, token } = await r.json();
        await fetch(`${API}/user/me`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`cleaned up test user ${U.username} (id=${user_id})`);
      }
    } catch { /* best effort */ }
  }
})();
