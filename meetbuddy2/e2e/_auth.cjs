// Shared test-account helper. Routes are scoped to the bearer token now, so a
// suite can no longer act on a fixed USER_ID — it needs a real account and a
// real token, and should delete both when it finishes.
const API = "http://localhost:8000";

/** Create a throwaway account. Returns {id, username, password, token, headers}. */
async function createTestUser(prefix = "t") {
  const tag = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
  const creds = {
    first_name: "E2E", last_name: "User", username: `${prefix}_${tag}`,
    email: `${prefix}-${tag}@test.local`, phone: `9${tag}`.slice(0, 15),
    password: "TestPass123!",
  };
  const res = await fetch(`${API}/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(`test signup failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    id: data.user_id,
    username: creds.username,
    password: creds.password,
    token: data.token,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
  };
}

/** Delete the account and everything it owns. Safe to call twice. */
async function deleteTestUser(user) {
  if (!user?.token) return;
  await fetch(`${API}/user/me`, {
    method: "DELETE", headers: { Authorization: `Bearer ${user.token}` },
  }).catch(() => {});
}

/** Save questionnaire answers for this account (what the questionnaire posts). */
async function savePreferences(user, prefs) {
  // location/coords are cached client-side only; /save_preferences stores just
  // the questionnaire answers.
  const questionnaire = { ...prefs };
  delete questionnaire.location;
  delete questionnaire.coords;
  const r = await fetch(`${API}/save_preferences`, {
    method: "POST", headers: user.headers, body: JSON.stringify(questionnaire),
  });
  if (!r.ok) throw new Error(`save_preferences failed: ${r.status} ${await r.text()}`);
}

/**
 * Put the account into the browser exactly as a real sign-in would.
 * Preferences are saved server-side as well as cached locally: the planner now
 * reads them from the account, so a localStorage-only seed would be rejected.
 */
async function signIn(page, user, prefs = null) {
  if (prefs) await savePreferences(user, prefs);
  await page.evaluate(({ u, prefs }) => {
    localStorage.setItem("user", JSON.stringify({ user_id: u.id, username: u.username }));
    localStorage.setItem("token", u.token);
    if (prefs) localStorage.setItem("userPreferences", JSON.stringify(prefs));
  }, { u: { id: user.id, username: user.username, token: user.token }, prefs });
}

// Includes *_sub answers on purpose: they are {sub_question_id: answer} objects,
// and a fixture without them hides shape bugs in the whole stage-2 path.
const DEFAULT_PREFS = {
  mood: "Romantic", planningStyle: "Surprise me", adventureLevel: "Stick to the city",
  memorableFactor: "Amazing food", location: "Indiranagar Bangalore",
  mood_sub: { ro_setting: "Candlelit / intimate", ro_surprise: "No — keep it simple" },
  planningStyle_sub: { sm_prior: ["Food quality", "Ambience"] },
  adventureLevel_sub: { sc_area: "Central", sc_transport: "Parking assistance" },
};

/** Authenticated fetch against the API for a given test user. */
const asUser = (user) => (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}),
               Authorization: `Bearer ${user.token}` },
  });

module.exports = { API, createTestUser, deleteTestUser, signIn, savePreferences,
                   asUser, DEFAULT_PREFS };
