// Self-check for src/lib/api.js, run inside the browser through Vite so the
// "@/config" alias resolves exactly as it does in the app.
// Needs backend :8000 + vite :5173. Env USER_ID (default 1).
const { chromium } = require("playwright");
const USER_ID = Number(process.env.USER_ID || 1);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let createdId = null;

  try {
    await page.goto("http://localhost:5173/");

    const result = await page.evaluate(async (uid) => {
      const { api, ApiError, NetworkError } = await import("/src/lib/api.js");
      const log = [];
      const ok = (cond, msg) => { if (!cond) throw new Error(msg); log.push(msg); };
      let id = null;

      // POST returns the parsed body directly — no .data wrapper
      const created = await api.post("/itineraries", {
        user_id: uid, title: "API client check",
        start_at: "2026-08-05T15:00:00+05:30", end_at: "2026-08-05T17:00:00+05:30",
        all_day: false, stops: [],
      });
      id = created.id;
      ok(!!created.id && created.title === "API client check", "POST returns parsed body");

      // GET with query params
      const list = await api.get("/itineraries", { params: { user_id: uid } });
      ok(Array.isArray(list) && list.some((r) => r.id === id), "GET serialises params");

      // PUT
      const updated = await api.put(`/itineraries/${id}`, { user_id: uid, title: "Renamed" });
      ok(updated.title === "Renamed", "PUT sends a JSON body");

      // null/undefined params are dropped rather than sent literally
      const single = await api.get(`/itineraries/${id}`,
        { params: { user_id: uid, missing: undefined, empty: null } });
      ok(single.id === id, "empty params are dropped from the query string");

      // 404 -> ApiError carrying status and FastAPI's detail
      try {
        await api.get("/itineraries/99999999", { params: { user_id: uid } });
        throw new Error("404 should have thrown");
      } catch (e) {
        ok(e instanceof ApiError, "404 raises ApiError");
        ok(e.status === 404, "ApiError carries the status");
        ok(e.detail === "Itinerary not found", "ApiError carries FastAPI's detail");
      }

      // 422 -> validation messages flattened into something readable
      try {
        await api.post("/itineraries", {
          user_id: uid, title: "Backwards",
          start_at: "2026-08-05T15:00:00Z", end_at: "2026-08-05T14:00:00Z",
        });
        throw new Error("422 should have thrown");
      } catch (e) {
        ok(e.status === 422, "422 raises with status");
        ok(typeof e.detail === "string" && e.detail.length > 0, "422 detail is readable text");
      }

      // timeout -> NetworkError, flagged as a timeout
      try {
        await api.get("/itineraries", { params: { user_id: uid }, timeout: 1 });
        throw new Error("timeout should have thrown");
      } catch (e) {
        ok(e instanceof NetworkError && e.timedOut === true, "timeout raises NetworkError");
      }

      // DELETE
      const gone = await api.del(`/itineraries/${id}`, { params: { user_id: uid } });
      ok(gone.message === "deleted", "DELETE works");
      id = null;

      return { log, id };
    }, USER_ID);

    createdId = result.id;
    result.log.forEach((l) => console.log("  ✓", l));
    console.log("API CLIENT CHECK: PASS");
  } catch (e) {
    console.log("API CLIENT CHECK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    if (createdId) {
      await fetch(`http://localhost:8000/itineraries/${createdId}?user_id=${USER_ID}`,
        { method: "DELETE" }).catch(() => {});
    }
    await browser.close();
  }
})();
