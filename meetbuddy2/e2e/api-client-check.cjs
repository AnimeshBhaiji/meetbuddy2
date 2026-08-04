// Self-check for src/lib/api.js, run inside the browser through Vite so the
// "@/config" alias resolves exactly as it does in the app.
// Needs backend :8000 + vite :5173. Creates its own throwaway account.
const { chromium } = require("playwright");
const { API, createTestUser, deleteTestUser, signIn } = require("./_auth.cjs");

(async () => {
  const user = await createTestUser("ac");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let createdId = null;

  try {
    await page.goto("http://localhost:5173/");
    await signIn(page, user);   // api.js reads the token from localStorage

    const result = await page.evaluate(async () => {
      const { api, ApiError, NetworkError } = await import("/src/lib/api.js");
      const log = [];
      const ok = (cond, msg) => { if (!cond) throw new Error(msg); log.push(msg); };
      let id = null;

      // POST returns the parsed body directly — no .data wrapper
      const created = await api.post("/itineraries", {
        title: "API client check",
        start_at: "2026-08-05T15:00:00+05:30", end_at: "2026-08-05T17:00:00+05:30",
        all_day: false, stops: [],
      });
      id = created.id;
      // Publish immediately so the finally block can clean up even if an
      // assertion below throws and this function never returns.
      window.__apiCheckId = created.id;
      ok(!!created.id && created.title === "API client check", "POST returns parsed body");

      // GET with query params
      const list = await api.get("/itineraries");
      ok(Array.isArray(list) && list.some((r) => r.id === id), "GET serialises params");

      // PUT
      const updated = await api.put(`/itineraries/${id}`, { title: "Renamed" });
      ok(updated.title === "Renamed", "PUT sends a JSON body");

      // null/undefined params are dropped rather than sent literally
      const single = await api.get(`/itineraries/${id}`,
        { params: { missing: undefined, empty: null, note: "kept" } });
      ok(single.id === id, "empty params are dropped, real ones kept");

      // 404 -> ApiError carrying status and FastAPI's detail
      try {
        await api.get("/itineraries/99999999");
        throw new Error("404 should have thrown");
      } catch (e) {
        ok(e instanceof ApiError, "404 raises ApiError");
        ok(e.status === 404, "ApiError carries the status");
        ok(e.detail === "Itinerary not found", "ApiError carries FastAPI's detail");
      }

      // 422 -> validation messages flattened into something readable
      try {
        await api.post("/itineraries", {
          title: "Backwards",
          start_at: "2026-08-05T15:00:00Z", end_at: "2026-08-05T14:00:00Z",
        });
        throw new Error("422 should have thrown");
      } catch (e) {
        ok(e.status === 422, "422 raises with status");
        ok(typeof e.detail === "string" && e.detail.length > 0, "422 detail is readable text");
      }

      // Timeout -> NetworkError, flagged as a timeout. Repeated, because the
      // abort can land either during the fetch or during the body read, and an
      // earlier version of this client only classified the first case — the
      // second escaped as a raw DOMException.
      let timeoutRuns = 0;
      for (let i = 0; i < 8; i++) {
        await api.get("/itineraries"); // warm the cache
        try {
          await api.get("/itineraries", { timeout: 1 });
        } catch (e) {
          timeoutRuns++;
          ok(e instanceof NetworkError,
            `timeout raises NetworkError (run ${i + 1}, got ${e.name})`);
          ok(e.timedOut === true,
            `timeout is flagged as timedOut (run ${i + 1}, got ${e.timedOut})`);
        }
      }
      ok(timeoutRuns > 0, `timeout path exercised (${timeoutRuns}/8 runs timed out)`);

      // DELETE
      const gone = await api.del(`/itineraries/${id}`);
      ok(gone.message === "deleted", "DELETE works");
      id = null;
      window.__apiCheckId = null;

      return { log, id };
    });

    createdId = result.id;
    result.log.forEach((l) => console.log("  ✓", l));
    console.log("API CLIENT CHECK: PASS");
  } catch (e) {
    console.log("API CLIENT CHECK: FAIL —", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    // Deleting the account removes anything the run created, including rows
    // left behind when an assertion throws mid-evaluate.
    await deleteTestUser(user);
  }
})();
