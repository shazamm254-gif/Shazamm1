// The browser only ever talks to OUR backend. Printify calls, and the token,
// stay on the server.
export class ApiError extends Error {
  constructor(message, { status = 0, detail = '', source = 'app' } = {}) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.source = source;
  }
}

let onLocked = () => {};
export function setLockedHandler(fn) {
  onLocked = fn;
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'pod-type-studio' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError('Could not reach the app server. Check your connection (and that the server is running).', { detail: String(err) });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON error page
  }
  if (res.ok) return data;
  if (res.status === 401 && data?.source !== 'printify') onLocked();
  throw new ApiError(data?.error || `The server answered ${res.status}.`, {
    status: res.status,
    detail: data?.detail || '',
    source: data?.source || 'app',
  });
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  patch: (url, body = {}) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};
