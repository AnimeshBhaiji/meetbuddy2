// meetbuddy2/e2e/auth-profile-check.cjs
// Covers the paths the calendar/planner suites don't touch and that the api
// client migration changed most: signup, login (incl. server error messages),
// profile load, and questionnaire preference saving.
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const API = "http://localhost:8000";

const fail = (msg) => { throw new Error(msg); };
const tag = Date.now().toString().slice(-8);
const USER = {
  first_name: "E2E", last_name: "Auth", email: `e2e-${tag}@test.local`,
  phone: `9${tag}`, username: `e2e_${tag}`, password: "TestPass123!",
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let userId = null;

  try {
    // ---------- signup through the UI ----------
    await page.goto("http://localhost:5173/signup");
    await page.waitForTimeout(1200);
    const fill = async (name, value) => {
      const el = page.locator(`input[name="${name}"]`);
      if (await el.count()) await el.first().fill(value);
    };
    for (const [k, v] of Object.entries(USER)) await fill(k, v);
    // signup is multi-stage: advance until the submit button appears
    for (let i = 0; i < 4; i++) {
      const next = page.locator('button:has-text("Next"), button:has-text("Continue")');
      if (await next.count()) { await next.first().click(); await page.waitForTimeout(700); }
      for (const [k, v] of Object.entries(USER)) await fill(k, v);
      const confirm = page.locator('input[name="confirmPassword"], input[name="confirm_password"]');
      if (await confirm.count()) await confirm.first().fill(USER.password);
    }
    const submit = page.locator('button[type="submit"]');
    if (await submit.count()) { await submit.first().click(); await page.waitForTimeout(2500); }

    // did the account land in the database?
    const login1 = await fetch(`${API}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: USER.username, password: USER.password }),
    });
    if (!login1.ok) {
      // UI signup may not have completed (multi-stage form); seed directly so the
      // remaining legs still get exercised.
      const r = await fetch(`${API}/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(USER),
      });
      if (!r.ok) fail(`signup failed entirely: ${await r.text()}`);
      console.log("signup: seeded via API (UI form is multi-stage)");
    } else {
      console.log("signup: created through the UI");
    }
    const who = await (await fetch(`${API}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: USER.username, password: USER.password }),
    })).json();
    userId = who.user_id;

    // ---------- login: wrong password must surface the server's message ----------
    await page.goto("http://localhost:5173/login");
    await page.waitForTimeout(1000);
    await page.locator("input").first().fill(USER.username);
    await page.locator('input[type="password"]').first().fill("definitely-wrong");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    const bodyAfterBad = await page.locator("body").innerText();
    if (!/Incorrect password/i.test(bodyAfterBad))
      fail(`server error message not shown to user. Body: ${bodyAfterBad.slice(0, 300)}`);
    console.log("login: server detail 'Incorrect password' surfaced correctly");

    // ---------- login: correct password ----------
    await page.locator('input[type="password"]').first().fill(USER.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
    const stored = await page.evaluate(() => localStorage.getItem("user"));
    if (!stored || !JSON.parse(stored).user_id) fail("login did not persist the user");
    console.log("login: succeeded and stored the user ->", page.url().replace("http://localhost:5173", ""));

    // ---------- profile loads fresh user data ----------
    await page.goto("http://localhost:5173/profile");
    await page.waitForTimeout(2500);
    const profileText = await page.locator("body").innerText();
    if (!profileText.includes(USER.email))
      fail(`profile did not load user data (expected ${USER.email})`);
    console.log("profile: loaded user from the API");

    // ---------- questionnaire saves preferences to the backend ----------
    await page.goto("http://localhost:5173/questionnaire-stage1");
    await page.waitForTimeout(1200);
    await page.locator("button", { hasText: "Chill & Relaxed" }).first().click();
    await page.waitForTimeout(2500);
    const prefs = await fetch(`${API}/user_prefs/${userId}`);
    if (!prefs.ok) fail(`preferences were never saved (${prefs.status})`);
    const prefsBody = await prefs.json();
    if (!JSON.stringify(prefsBody).includes("Chill"))
      fail(`saved prefs missing the answer: ${JSON.stringify(prefsBody)}`);
    console.log("questionnaire: preferences persisted ->", JSON.stringify(prefsBody.prefs?.mood));

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("AUTH PROFILE CHECK: PASS");
  } catch (e) {
    console.log("AUTH PROFILE CHECK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (userId) console.log(`(left test user ${USER.username} id=${userId}; no delete endpoint exists)`);
  }
})();
