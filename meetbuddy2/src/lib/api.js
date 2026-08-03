// Single entry point for every backend call.
//
// Built on native fetch rather than axios: the only axios features in use were
// JSON parsing, query-param serialisation and timeouts, all of which fetch +
// AbortSignal cover — so this drops a dependency instead of wrapping one.
//
// When JWT validation is turned on, the Authorization header goes in `headers()`
// below and every call site gets it at once.
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
  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: { ...DEFAULT_HEADERS, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    throw new NetworkError(
      timedOut ? `Request to ${path} timed out after ${timeout}ms` : `Could not reach the server`,
      timedOut
    );
  }

  // 204 and empty bodies are valid; don't blow up parsing them.
  const text = await res.text();
  let parsed = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!res.ok) {
    const detail = readDetail(parsed);
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
