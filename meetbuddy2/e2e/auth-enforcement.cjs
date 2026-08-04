// meetbuddy2/e2e/auth-enforcement.cjs
// Task 3 gate: the browser sends a real token, protected pages work with it,
// and a tampered/absent token lands the user on /login instead of showing data.
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const API = "http://localhost:8000";

const tag = Date.now().toString().slice(-8);
const U = {
  first_name: "Auth", last_name: "Enf", username: `ae_${tag}`,
  email: `ae-${tag}@test.local`, phone: `1${tag}`, password: "TestPass123!",
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fail = (m) => { throw new Error(m); };
  let token = null;

  try {
    // ---------- signup issues a real JWT ----------
    const signed = await (await fetch(`${API}/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(U),
    })).json();
    token = signed.token;
    if (!token || token.split(".").length !== 3) fail(`signup returned no JWT: ${token}`);
    console.log("signup issued a 3-part JWT");

    // ---------- the browser actually sends it ----------
    await page.goto("http://localhost:5173/");
    await page.evaluate(({ u, t }) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", t);
    }, { u: { user_id: signed.user_id, username: U.username }, t: token });

    // Only backend calls — the page navigation to /itineraries is a document
    // request and legitimately carries no Authorization header.
    const sentAuth = [];
    page.on("request", (r) => {
      const u = r.url();
      if (u.startsWith(API) || u.includes("/api/")) sentAuth.push({ u, ok: !!r.headers()["authorization"] });
    });

    await page.goto("http://localhost:5173/itineraries");
    await page.waitForTimeout(2500);
    if (sentAuth.length === 0) fail("no API request observed on My Plans");
    const missing = sentAuth.filter((r) => !r.ok);
    if (missing.length) fail(`API request(s) sent with no Authorization header: ${missing.map((m) => m.u).join(", ")}`);
    console.log(`Authorization header present on all ${sentAuth.length} API request(s)`);

    if (/Couldn't load/i.test(await page.locator("body").innerText()))
      fail("My Plans failed to load with a valid token");
    console.log("protected page loads with a valid token");

    // ---------- profile reads /user/me ----------
    await page.goto("http://localhost:5173/profile");
    await page.waitForTimeout(2500);
    if (!(await page.locator("body").innerText()).includes(U.email))
      fail("profile did not load the account via /user/me");
    console.log("profile loaded through /user/me");

    // ---------- a tampered token must not show data ----------
    const bad = token.slice(0, -3) + "xyz";       // same shape, broken signature
    await page.evaluate((t) => localStorage.setItem("token", t), bad);
    await page.goto("http://localhost:5173/itineraries");
    await page.waitForURL("**/login**", { timeout: 20000 });
    // waitForURL resolves mid-navigation; wait for the notice itself to render
    // rather than sampling a half-loaded page.
    await page.waitForSelector("text=/session expired/i", { timeout: 15000 })
      .catch(() => fail("no expiry notice shown on the login page"));
    const cleared = await page.evaluate(() => ({
      user: localStorage.getItem("user"), token: localStorage.getItem("token"),
    }));
    if (cleared.user || cleared.token) fail(`session not cleared: ${JSON.stringify(cleared)}`);
    console.log("tampered token -> redirected to /login, session cleared, notice shown");

    // ---------- no token at all: protected route bounces ----------
    await page.evaluate(() => localStorage.clear());
    await page.goto("http://localhost:5173/calendar");
    await page.waitForTimeout(1500);
    if (!page.url().includes("/login")) fail(`no-token visit stayed on ${page.url()}`);
    console.log("no token -> protected route redirects to /login");

    // ---------- the API itself refuses anonymous callers ----------
    const anon = await page.evaluate(async () => {
      const r = await fetch("http://localhost:8000/itineraries");
      return r.status;
    });
    if (anon !== 401) fail(`anonymous GET /itineraries returned ${anon}, expected 401`);
    console.log("anonymous API call rejected with 401");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("AUTH ENFORCEMENT: PASS");
  } catch (e) {
    console.log("AUTH ENFORCEMENT: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    if (token) {
      await fetch(`${API}/user/me`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    await browser.close();
  }
})();
