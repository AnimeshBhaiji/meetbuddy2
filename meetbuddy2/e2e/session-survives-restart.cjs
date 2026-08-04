// meetbuddy2/e2e/session-survives-restart.cjs
// The reason planner sessions moved into Postgres: a backend restart used to
// drop whoever was mid-plan. Starts a session, restarts uvicorn, then checks the
// session is still there and still usable.
//
// Needs backend :8000 (this script restarts it) + vite :5173.
const { spawn, execSync } = require("child_process");
const path = require("path");
const { API, createTestUser, deleteTestUser } = require("./_auth.cjs");

const BACKEND_DIR = path.join(__dirname, "..", "backend");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const up = async () => {
  try {
    const r = await fetch(`${API}/docs`);
    return r.ok;
  } catch { return false; }
};

const waitFor = async (want, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if ((await up()) === want) return true;
    await wait(500);
  }
  return false;
};

(async () => {
  let user = null, child = null;
  const fail = (m) => { throw new Error(m); };

  try {
    user = await createTestUser("sr");

    // ---- start a planning session ----
    const started = await (await fetch(`${API}/planner/session`, {
      method: "POST", headers: user.headers,
      body: JSON.stringify({
        preferences: { mood: "Romantic", planningStyle: "Surprise me",
                       adventureLevel: "Stick to the city", memorableFactor: "Amazing food" },
        location: "Indiranagar Bangalore",
      }),
    })).json();
    const sid = started.session_id;
    if (!sid) fail(`no session created: ${JSON.stringify(started).slice(0, 200)}`);
    console.log("session created:", sid);

    const before = await (await fetch(`${API}/planner/session/${sid}`, { headers: user.headers })).json();
    if (before.session_id !== sid) fail("session not readable before restart");

    // ---- restart the backend ----
    console.log("restarting backend...");
    try {
      execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'python.exe\'\\" | ' +
               'Where-Object { $_.CommandLine -like \'*uvicorn*main:app*\' } | ' +
               'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: "ignore" });
    } catch { /* nothing running is fine */ }

    if (!(await waitFor(false))) fail("backend did not stop");
    console.log("backend stopped");

    child = spawn("python", ["-m", "uvicorn", "main:app", "--port", "8000"],
                  { cwd: BACKEND_DIR, detached: true, stdio: "ignore" });
    child.unref();
    if (!(await waitFor(true))) fail("backend did not come back up");
    console.log("backend restarted");

    // ---- the session must still be there ----
    const res = await fetch(`${API}/planner/session/${sid}`, { headers: user.headers });
    if (res.status !== 200) fail(`session gone after restart (HTTP ${res.status})`);
    const after = await res.json();
    if (after.session_id !== sid) fail("wrong session returned after restart");
    if (JSON.stringify(after.payload) !== JSON.stringify(before.payload))
      fail("session payload changed across the restart");
    console.log("session survived the restart with its payload intact");

    // ---- and is still usable, not just readable ----
    const skip = await fetch(`${API}/planner/session/${sid}/skip`, {
      method: "POST", headers: user.headers, body: JSON.stringify({ next_step: "done" }),
    });
    if (skip.status !== 200) fail(`session not usable after restart (HTTP ${skip.status})`);
    console.log("session still usable after restart");

    console.log("SESSION SURVIVES RESTART: PASS");
  } catch (e) {
    console.log("SESSION SURVIVES RESTART: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await deleteTestUser(user);   // removes the account and its sessions
  }
})();
