// meetbuddy2/e2e/delete-account.cjs
// Drives Profile -> "Delete account" through the confirmation dialog and checks
// that the account AND its itineraries are gone, while another user's plans are
// untouched. Needs backend :8000 + vite :5173.
const { chromium } = require("playwright");
const API = "http://localhost:8000";

const tag = Date.now().toString().slice(-8);
const mkUser = (p) => ({
  first_name: "Del", last_name: "Acct", username: `da_${p}${tag}`,
  email: `da-${p}${tag}@test.local`, phone: `5${p}${tag}`, password: "TestPass123!",
});

const signup = async (u) => {
  const r = await fetch(`${API}/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u),
  });
  if (!r.ok) throw new Error(`signup failed: ${await r.text()}`);
  return (await r.json()).user_id;
};
const addPlan = (uid, title) => fetch(`${API}/itineraries`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_id: uid, title, stops: [] }),
});
const planCount = async (uid) =>
  (await (await fetch(`${API}/itineraries?user_id=${uid}`)).json()).length;
const userStatus = async (uid) => (await fetch(`${API}/user/${uid}`)).status;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fail = (m) => { throw new Error(m); };

  let victim = null, bystander = null;
  try {
    const vUser = mkUser("v"), bUser = mkUser("b");
    victim = await signup(vUser);
    bystander = await signup(bUser);
    await addPlan(victim, "Victim plan 1");
    await addPlan(victim, "Victim plan 2");
    await addPlan(bystander, "Bystander plan");

    if (await planCount(victim) !== 2) fail("seed failed for the account under test");
    if (await planCount(bystander) !== 1) fail("seed failed for the bystander");

    // log in as the victim, then delete the account from Profile
    await page.goto("http://localhost:5173/");
    await page.evaluate((u) => localStorage.setItem("user", JSON.stringify(u)),
      { user_id: victim, username: vUser.username });

    await page.goto("http://localhost:5173/profile");
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText();
    if (!body.includes(vUser.email)) fail("profile did not load the account");

    await page.locator("button", { hasText: /delete account/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.locator("button", { hasText: /yes, delete my account/i }).first().click();

    // the app signs the user out to /signup on success
    await page.waitForURL("**/signup", { timeout: 25000 });
    console.log("UI: confirmed deletion and redirected to /signup");

    const leftover = await page.evaluate(() => localStorage.getItem("user"));
    if (leftover) fail("stored user was not cleared after deletion");

    // ---- server state ----
    const vStatus = await userStatus(victim);
    if (vStatus !== 404) fail(`account still exists (GET /user -> ${vStatus})`);
    const vPlans = await planCount(victim);
    if (vPlans !== 0) fail(`itineraries were not cascaded (${vPlans} left)`);
    console.log("server: account gone (404) and its 2 itineraries cascaded");

    // ---- the other account must be untouched ----
    if (await userStatus(bystander) !== 200) fail("bystander account was deleted");
    if (await planCount(bystander) !== 1) fail("bystander's plan was deleted");
    console.log("server: other account and its plan untouched");

    if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
    console.log("DELETE ACCOUNT: PASS");
  } catch (e) {
    console.log("DELETE ACCOUNT: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    for (const id of [victim, bystander]) {
      if (id) await fetch(`${API}/user/${id}`, { method: "DELETE" }).catch(() => {});
    }
    await browser.close();
  }
})();
