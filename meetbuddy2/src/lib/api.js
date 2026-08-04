// Single entry point for every backend call.
//
// Built on native fetch rather than axios: the only axios features in use were
// JSON parsing, query-param serialisation and timeouts, all of which fetch +
// AbortSignal cover — so this drops a dependency instead of wrapping one.
//
// It also attaches the bearer token and handles its expiry, so no call site
// has to think about authentication.
import { API_BASE_URL, DEFAULT_HEADERS } from "@/config";

/** Non-2xx response. `status` and `detail` are what callers actually branch on. */
export class ApiError extends Error {
  constructor(message, { status, detail, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.detail = detail;
    this.body = body;
  }
}

/** Request never reached the server, or ran out of time. */
export class NetworkError extends ApiError {
  constructor(message, timedOut = false) {
    super(message, { status: 0 });
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

const DEFAULT_TIMEOUT_MS = 30000;

/** Routes that must work before there is a token to send. */
const PUBLIC_PATHS = ["/login", "/signup"];

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * The token is gone, expired, or was rejected. Clear the session and send the
 * user to login. Done here rather than per call site so no screen can end up
 * rendering against an identity the server has already refused.
 */
export const SESSION_EXPIRED_FLAG = "session_expired";

const onSessionExpired = () => {
  for (const key of ["user", "token", "userPreferences", "questionnaireAnswers",
                     "planner_session_id"]) {
    localStorage.removeItem(key);
  }
  // Flag in sessionStorage rather than relying on the ?expired=1 query: clearing
  // the token above lets ProtectedRoute's client-side <Navigate> reach /login
  // first, dropping the query string. The flag survives either route.
  try { sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1"); } catch { /* private mode */ }

  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login?expired=1");
  }
};

const buildUrl = (path, params) => {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  ).toString();
  return qs ? `${url}?${qs}` : url;
};

// FastAPI errors are {detail: "..."} or {detail: [{msg, loc}, ...]} for 422.
const readDetail = (body) => {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg).filter(Boolean).join("; ") || null;
  return null;
};

async function request(method, path, { params, body, timeout = DEFAULT_TIMEOUT_MS, headers } = {}) {
  const asNetworkError = (e) => {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return new NetworkError(
      timedOut ? `Request to ${path} timed out after ${timeout}ms` : "Could not reach the server",
      timedOut
    );
  };

  let res;
  let text;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: { ...DEFAULT_HEADERS, ...authHeader(), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    // The body read shares the abort signal, so it has to share the error
    // handling: a timeout that lands mid-download rejects here, not above, and
    // would otherwise escape as a raw DOMException past every `instanceof
    // ApiError` check in the app.
    text = await res.text();
  } catch (e) {
    throw asNetworkError(e);
  }

  // 204 and empty bodies are valid; don't blow up parsing them.
  let parsed = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!res.ok) {
    const detail = readDetail(parsed);
    // 401 on a protected route means this session is over — never surface it to
    // the caller as an ordinary error it might swallow with `catch {}`.
    if (res.status === 401 && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      onSessionExpired();
    }
    throw new ApiError(detail || `${method} ${path} failed with ${res.status}`,
      { status: res.status, detail, body: parsed });
  }
  return parsed;
}

export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  put: (path, body, opts) => request("PUT", path, { ...opts, body }),
  del: (path, opts) => request("DELETE", path, opts),
};

export default api;
