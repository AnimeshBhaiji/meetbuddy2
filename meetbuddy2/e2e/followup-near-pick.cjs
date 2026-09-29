// meetbuddy2/e2e/followup-near-pick.cjs
// With a typed location (no GPS), each next step's options must be near the
// place just picked. They used to centre on the previous pick, and the first
// follow-up had no location at all: "things to do" came back from Portugal.
// Real searches (cached after the first run). Needs backend :8000.
const { API, createTestUser, deleteTestUser, savePreferences } = require("./_auth.cjs");

const fail = (m) => { throw new Error(m); };
const MAX_KM = 15;

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

(async () => {
  let user = null;
  try {
    user = await createTestUser("near");
    await savePreferences(user, {
      mood: "Romantic", planningStyle: "Full control", adventureLevel: "Stick to the city",
      mood_sub: { ro_setting: "Candlelit / intimate" },
    });
    const post = async (path, body) => {
      const r = await fetch(`${API}${path}`, { method: "POST", headers: user.headers, body: JSON.stringify(body) });
      if (!r.ok) fail(`${path} -> ${r.status} ${await r.text()}`);
      return r.json();
    };

    const start = await post("/planner/session", { location: "Indiranagar Bangalore", coords: null });
    const sid = start.session_id;
    let options = start.initial.options;
    if (!options.length) fail("no initial options");

    for (const [step, next] of [["restaurant", "activity"], ["activity", "stay"]]) {
      const pick = options.find((o) => o.lat != null);
      const res = await post(`/planner/session/${sid}/select`, { step, place: pick, next_step: next, selected_tokens: [] });
      options = res.options || [];
      if (!options.length) fail(`no ${next} options after picking ${pick.title}`);
      const far = options.filter((o) => o.lat != null && km(pick, o) > MAX_KM);
      if (far.length)
        fail(`${far.length} ${next} options are over ${MAX_KM} km from "${pick.title}", e.g. ${far[0].title} (${far[0].address})`);
      const maxKm = Math.max(...options.filter((o) => o.lat != null).map((o) => km(pick, o)));
      console.log(`${next}: ${options.length} options, all within ${maxKm.toFixed(1)} km of "${pick.title}"`);
    }

    const done = await post(`/planner/session/${sid}/select`,
      { step: "stay", place: options[0], next_step: "done", selected_tokens: [] });
    if (done.next_step !== "done" || (done.options || []).length) fail("the final pick returned more options");
    console.log("final pick: plan complete, no extra search");

    console.log("FOLLOWUP NEAR PICK: PASS");
  } catch (e) {
    console.log("FOLLOWUP NEAR PICK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await deleteTestUser(user);
  }
})();
