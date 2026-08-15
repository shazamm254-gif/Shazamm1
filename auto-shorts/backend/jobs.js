'use strict';
/**
 * Background job queue.
 *
 * Analysis and rendering take longer than an HTTP request should, so they run
 * as jobs the frontend polls. Concurrency is capped because each render can
 * saturate the CPU, and a queued job reports its position so the UI can say
 * "waiting behind 1 render" instead of appearing frozen.
 *
 * Failures are captured as structured errors, so a failed job tells the creator
 * what happened, why, and what to do about it — the same contract as every
 * other error path in the app.
 */

const config = require('../config');
const { id } = require('../utils');
const { AppError } = require('../utils/errors');

const jobs = new Map();
const queue = [];
let running = 0;

function create(kind, meta = {}) {
  const job = {
    id: id('job'),
    kind,
    meta,
    status: 'queued',
    progress: 0,
    label: 'Queued',
    result: null,
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
  jobs.set(job.id, job);
  return job;
}

function get(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    ...job,
    queuePosition: job.status === 'queued'
      ? queue.findIndex((q) => q.job.id === jobId) + 1
      : 0,
  };
}

/** Queue a job. `fn` receives an onProgress(fraction, label) callback. */
function run(kind, fn, meta = {}) {
  const job = create(kind, meta);
  queue.push({ job, fn });
  pump();
  return job;
}

function pump() {
  while (running < config.jobs.maxConcurrent && queue.length) {
    const entry = queue.shift();
    running++;
    execute(entry).finally(() => {
      running--;
      pump();
    });
  }
}

async function execute({ job, fn }) {
  job.status = 'running';
  job.startedAt = Date.now();
  job.label = 'Starting';

  const onProgress = (fraction, label) => {
    if (typeof fraction === 'number' && isFinite(fraction)) {
      job.progress = Math.max(0, Math.min(1, fraction));
    }
    if (label) job.label = label;
  };

  try {
    job.result = await fn(onProgress);
    job.status = 'done';
    job.progress = 1;
    job.label = 'Done';
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof AppError
      ? err.toJSON()
      : {
        error: true,
        code: 'UNEXPECTED',
        what: 'Something went wrong during this step.',
        why: err.message || String(err),
        fix: 'Try the step again. If it keeps failing, check the server log for the full stack trace.',
      };
    job.label = 'Failed';
    // Keep the stack in the server log; it never goes to the browser.
    if (!(err instanceof AppError)) console.error(`[job ${job.kind}]`, err);
  } finally {
    job.finishedAt = Date.now();
    sweep();
  }
}

/** Drop finished jobs after the retention window so the map cannot grow forever. */
function sweep() {
  const cutoff = Date.now() - config.jobs.retentionMs;
  for (const [key, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(key);
  }
}

/** Jobs belonging to one project, newest first. */
function forProject(projectId) {
  return Array.from(jobs.values())
    .filter((j) => j.meta.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map((j) => get(j.id));
}

function stats() {
  return {
    running,
    queued: queue.length,
    total: jobs.size,
    maxConcurrent: config.jobs.maxConcurrent,
  };
}

module.exports = { run, get, forProject, stats, create };
