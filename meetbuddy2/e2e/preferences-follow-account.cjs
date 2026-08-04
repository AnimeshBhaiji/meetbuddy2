// meetbuddy2/e2e/preferences-follow-account.cjs
// Signing in used to clear localStorage preferences while nothing ever read the
// server's copy, so a returning user was asked to retake the questionnaire.
// Answers the questionnaire in one browser context, then signs in from a clean
// one and checks the answers came back from the account.
// Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const { API, createTestUser, deleteTestUser } = require("./_auth.cjs");

(async () => {
  const browser = await chromium.launch();
  const fail = (m) => { throw new Error(m); };
  let user = null;

  try {
    user = await createTestUser("pf");

    // ---------- answer the questionnaire for real ----------
    const first = await browser.newContext();
    const page = await first.newPage();
    await page.goto("http://localhost:5173/");
    await page.evaluate(({ id, username, token }) => {
      localStorage.setItem("user", JSON.stringify({ user_id: id, username }));
      localStorage.setItem("token", token);
    }, { id: user.id, username: user.username, token: user.token });

    await page.goto("http://localhost:5173/questionnaire-stage1");
    await page.waitForTimeout(1200);
    await page.locator("button", { hasText: "Chill & Relaxed" }).first().click();
    await page.waitForTimeout(2500);

    const saved = await (await fetch(`${API}/user_prefs/me`, { headers: user.headers })).json();
    if (!JSON.stringify(saved.prefs).includes("Chill"))
      fail(`answer never reached the account: ${JSON.stringify(saved)}`);
    console.log("questionnaire answered ->", JSON.stringify(saved.prefs.mood));
    await first.close();

    // ---------- a clean browser: no cached preferences at all ----------
    const second = await browser.newContext();
    const page2 = await second.newPage();
    await page2.goto("http://localhost:5173/");
    await page2.evaluate(({ id, username, token }) => {
      localStorage.clear();                    // nothing cached, as on a new device
      localStorage.setItem("user", JSON.stringify({ user_id: id, username }));
      localStorage.setItem("token", token);
    }, { id: user.id, username: user.username, token: user.token });

    const before = await page2.evaluate(() => localStorage.getItem("userPreferences"));
    if (before) fail("cache was not actually empty at the start");

    await page2.goto("http://localhost:5173/planner");
    await page2.waitForTimeout(3000);

    const hydrated = await page2.evaluate(() => localStorage.getItem("userPreferences"));
    if (!hydrated) fail("preferences were not loaded from the account");
    if (!JSON.stringify(hydrated).includes("Chill"))
      fail(`wrong preferences hydrated: ${hydrated}`);
    console.log("clean browser hydrated from the account ->", hydrated);

    // the planner should be usable rather than demanding the questionnaire again
    const body = await page2.locator("body").innerText();
    if (/log in and save preferences first/i.test(body))
      fail("planner still says preferences are missing");
    console.log("planner accepts the account's saved answers");

    // ---------- and the plan really is driven by the saved answers ----------
    const started = await page2.evaluate(async () => {
      const r = await fetch("http://localhost:8000/planner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json",
                   Authorization: `Bearer ${localStorage.getItem("token")}` },
        // deliberately contradicting the saved answers
        body: JSON.stringify({ preferences: { mood: "Business-y" },
                               location: "Indiranagar Bangalore" }),
      });
      return { status: r.status, body: await r.json() };
    });
    if (started.status !== 200) fail(`planner session failed: ${started.status}`);
    const sid = started.body.session_id;
    const session = await (await fetch(`${API}/planner/session/${sid}`,
      { headers: user.headers })).json();
    const mood = JSON.stringify(session.payload.preferences.mood);
    if (!mood.includes("Chill"))
      fail(`request body overrode the saved answers (mood=${mood})`);
    console.log("client-sent preferences ignored; account's answers used ->", mood);

    console.log("PREFERENCES FOLLOW ACCOUNT: PASS");
  } catch (e) {
    console.log("PREFERENCES FOLLOW ACCOUNT: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await deleteTestUser(user);
    await browser.close();
  }
})();
