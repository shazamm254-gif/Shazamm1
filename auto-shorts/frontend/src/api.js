/**
 * API client.
 *
 * Every error the server sends carries what / why / fix. This layer preserves
 * those three fields on the thrown object so any component can render a useful
 * message instead of "Request failed".
 */

const BASE = '/api';

export class ApiError extends Error {
  constructor(payload, status) {
    super(payload.what || 'Request failed');
    this.name = 'ApiError';
    this.code = payload.code || 'ERROR';
    this.what = payload.what || 'Something went wrong.';
    this.why = payload.why || 'The server did not explain why.';
    this.fix = payload.fix || 'Try again.';
    this.detail = payload.detail;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({
      code: 'NETWORK',
      what: 'Could not reach the AUTO SHORTS server.',
      why: 'The request never completed. The server may have stopped, or the page may be offline.',
      fix: 'Check that the server is still running in your terminal, then reload this page.',
    }, 0);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(data || {
      what: `The server returned ${res.status}.`,
      why: 'It sent a response that could not be read as JSON.',
      fix: 'Reload the page. If it keeps happening, check the terminal running the server.',
    }, res.status);
  }
  return data;
}

/** Poll a job until it finishes. onTick receives the job on each poll. */
export async function waitForJob(jobId, onTick, { intervalMs = 450, timeoutMs = 1000 * 60 * 30 } = {}) {
  const started = Date.now();
  for (;;) {
    const { job } = await request(`/projects/jobs/${jobId}`);
    if (onTick) onTick(job);

    if (job.status === 'done') return job.result;
    if (job.status === 'failed') throw new ApiError(job.error || {}, 500);

    if (Date.now() - started > timeoutMs) {
      throw new ApiError({
        code: 'JOB_TIMEOUT',
        what: 'That step is taking much longer than expected.',
        why: 'The job has been running for over 30 minutes without finishing.',
        fix: 'Check the terminal running the server for errors, then try again with shorter media.',
      }, 504);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export const api = {
  capabilities: () => request('/capabilities'),
  health: () => request('/health'),

  listProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, patch) => request(`/projects/${id}`, { method: 'PATCH', body: patch }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  uploadMedia: (id, files, role, onProgress) => new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    if (role) form.append('role', role);

    // XHR rather than fetch: upload progress is worth having on a phone.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/projects/${id}/media`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (_) { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      reject(new ApiError(data || {
        what: 'The upload failed.',
        why: `The server replied with ${xhr.status}.`,
        fix: 'Check the file format and try again.',
      }, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError({
      what: 'The upload could not be sent.',
      why: 'The connection to the server dropped mid-upload.',
      fix: 'Check the server is still running, then try the upload again.',
    }, 0));
    xhr.send(form);
  }),

  updateMedia: (id, mediaId, patch) => request(`/projects/${id}/media/${mediaId}`, { method: 'PATCH', body: patch }),
  deleteMedia: (id, mediaId) => request(`/projects/${id}/media/${mediaId}`, { method: 'DELETE' }),

  autoEdit: (id, directives = []) => request(`/projects/${id}/auto-edit`, { method: 'POST', body: { directives } }),
  reEdit: (id, directives) => request(`/projects/${id}/re-edit`, { method: 'POST', body: { directives } }),
  getEdl: (id) => request(`/projects/${id}/edl`),
  putEdl: (id, edl) => request(`/projects/${id}/edl`, { method: 'PUT', body: { edl } }),
  timelineOp: (id, op, args) => request(`/projects/${id}/timeline/${op}`, { method: 'POST', body: args }),
  regenerateCaptions: (id, style) => request(`/projects/${id}/captions/regenerate`, { method: 'POST', body: { style } }),
  importSrt: (id, srt) => request(`/projects/${id}/captions/import`, { method: 'POST', body: { srt } }),

  renderPreview: (id) => request(`/projects/${id}/preview`, { method: 'POST' }),
  exportVideo: (id, preset) => request(`/projects/${id}/export`, { method: 'POST', body: { preset } }),
  listExports: (id) => request(`/projects/${id}/exports`),
  deleteExport: (id, exportId) => request(`/projects/${id}/exports/${exportId}`, { method: 'DELETE' }),

  sfxUrl: (name) => `${BASE}/sfx/${name}`,
};
