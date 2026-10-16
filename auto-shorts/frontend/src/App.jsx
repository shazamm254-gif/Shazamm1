import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, waitForJob, ApiError } from './api.js';
import { summarize, findClip, duration as edlDuration } from './lib/edl.js';
import Home from './components/Home.jsx';
import Preview from './components/Preview.jsx';
import Timeline from './components/Timeline.jsx';
import Inspector from './components/Inspector.jsx';
import {
  ErrorCard, MediaLibrary, ScriptPanel, AIReport, SettingsPanel, ExportPanel,
} from './components/Panels.jsx';

/**
 * The workflow the whole product is arranged around:
 *
 *   NEW SHORT -> UPLOAD MEDIA -> AUTO EDIT -> REVIEW -> EXPORT
 *
 * The step rail always shows where you are and what comes next, and steps you
 * cannot do yet say why rather than being silently dead.
 */
const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'edit', label: 'Auto Edit' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
];

export default function App() {
  const [route, setRoute] = useState({ view: 'home', projectId: null });
  const [capabilities, setCapabilities] = useState(null);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [caps, list] = await Promise.all([api.capabilities(), api.listProjects()]);
        setCapabilities(caps);
        setProjects(list.projects);
      } catch (err) {
        setError(err);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Deep-linking, so a reload keeps you in the project you were editing.
  useEffect(() => {
    const applyHash = () => {
      const m = /^#\/project\/([\w-]+)$/.exec(window.location.hash);
      setRoute(m ? { view: 'editor', projectId: m[1] } : { view: 'home', projectId: null });
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  useEffect(() => {
    if (route.view !== 'editor' || !route.projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    api.getProject(route.projectId)
      .then(({ project: p }) => { if (!cancelled) setProject(p); })
      .catch((err) => { if (!cancelled) { setError(err); window.location.hash = ''; } });
    return () => { cancelled = true; };
  }, [route]);

  const openProject = (id) => { window.location.hash = `#/project/${id}`; };
  const goHome = async () => {
    window.location.hash = '';
    try {
      setProjects((await api.listProjects()).projects);
    } catch (_) { /* the list refreshes on next load */ }
  };

  const createProject = async (data) => {
    try {
      const { project: p } = await api.createProject(data);
      setProjects((list) => [{ ...p, mediaCount: 0, hasEdit: false }, ...list]);
      openProject(p.id);
    } catch (err) {
      setError(err);
    }
  };

  const deleteProject = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This removes the project folder, its media and its exports.`)) return;
    try {
      await api.deleteProject(id);
      setProjects((list) => list.filter((p) => p.id !== id));
    } catch (err) {
      setError(err);
    }
  };

  if (booting) {
    return <div className="boot"><span className="wordmark">AUTO<span>SHORTS</span></span></div>;
  }

  if (route.view === 'editor' && project) {
    return (
      <Editor
        key={project.id}
        project={project}
        setProject={setProject}
        capabilities={capabilities}
        onHome={goHome}
      />
    );
  }

  return (
    <Home
      projects={projects}
      capabilities={capabilities}
      onCreate={createProject}
      onOpen={openProject}
      onDelete={deleteProject}
      error={error}
      onDismissError={() => setError(null)}
    />
  );
}

/* ------------------------------------------------------------------ editor */

function Editor({ project, setProject, capabilities, onHome }) {
  const [step, setStep] = useState(project.edl ? 'review' : 'upload');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);            // { label, progress }
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1.4);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exports, setExports] = useState(project.exports || []);

  // Undo/redo: a stack of whole EDLs. Because every timeline operation returns
  // a complete EDL, history is a list rather than a diff log.
  const [history, setHistory] = useState(() => (project.edl ? [project.edl] : []));
  const [historyIndex, setHistoryIndex] = useState(() => (project.edl ? 0 : -1));

  const edl = historyIndex >= 0 ? history[historyIndex] : project.edl;
  const summary = useMemo(() => (edl ? summarize(edl) : null), [edl]);
  const selectedClip = useMemo(() => (edl && selectedId ? findClip(edl, selectedId) : null), [edl, selectedId]);
  const styleDetail = capabilities?.captionStyleDetail;

  const pushHistory = useCallback((nextEdl) => {
    setHistory((h) => {
      const trimmed = h.slice(0, historyIndex + 1);
      const next = [...trimmed, nextEdl];
      // Cap the stack so a long session cannot grow without bound.
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
    setHistoryIndex((i) => Math.min(i + 1, 59));
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const applyHistoryAt = useCallback(async (index) => {
    const target = history[index];
    if (!target) return;
    setHistoryIndex(index);
    try {
      await api.putEdl(project.id, target);
    } catch (err) {
      setError(err);
    }
  }, [history, project.id]);

  const undo = useCallback(() => { if (canUndo) applyHistoryAt(historyIndex - 1); }, [canUndo, historyIndex, applyHistoryAt]);
  const redo = useCallback(() => { if (canRedo) applyHistoryAt(historyIndex + 1); }, [canRedo, historyIndex, applyHistoryAt]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  /* ------------------------------------------------------------ actions */

  const saveProject = async (patch) => {
    try {
      const { project: p } = await api.updateProject(project.id, patch);
      setProject(p);
      return p;
    } catch (err) {
      setError(err);
      return null;
    }
  };

  const upload = async (files, role) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const res = await api.uploadMedia(project.id, files, role, setUploadProgress);
      setProject(res.project);
      if (res.failed?.length) {
        setError({
          what: `${res.failed.length} file${res.failed.length === 1 ? '' : 's'} could not be imported.`,
          why: res.failed.map((f) => `${f.filename}: ${f.why}`).join(' '),
          fix: 'The rest were added. Convert the failed files to MP4, MP3 or JPG and upload them again.',
        });
      }
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (mediaId) => {
    try {
      const res = await api.deleteMedia(project.id, mediaId);
      setProject(res.project);
      if (res.project.edl) {
        setHistory([res.project.edl]);
        setHistoryIndex(0);
      }
    } catch (err) {
      setError(err);
    }
  };

  const tagMedia = async (mediaId, tags) => {
    try {
      await api.updateMedia(project.id, mediaId, { tags: tags.split(',') });
      const { project: p } = await api.getProject(project.id);
      setProject(p);
    } catch (err) {
      setError(err);
    }
  };

  /** Run a queued job with progress, then refresh the project. */
  const runJob = useCallback(async (label, starter) => {
    setBusy({ label, progress: 0 });
    setError(null);
    try {
      const { job } = await starter();
      const result = await waitForJob(job.id, (j) => {
        setBusy({ label: j.label || label, progress: j.progress || 0 });
      });
      const { project: p } = await api.getProject(project.id);
      setProject(p);
      if (p.edl) {
        setHistory([p.edl]);
        setHistoryIndex(0);
      }
      setSelectedId(null);
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setBusy(null);
    }
  }, [project.id]);

  const autoEdit = async () => {
    const res = await runJob('Auto-editing', () => api.autoEdit(project.id));
    if (res) {
      setStep('review');
      setCurrentTime(0);
    }
  };

  const reEdit = async (directives) => {
    const res = await runJob('Re-editing', () => api.reEdit(project.id, directives));
    if (res) setCurrentTime(0);
  };

  const regenerateCaptions = async (style) => {
    if (!project.edl) return;
    await runJob('Regenerating captions', () => api.regenerateCaptions(project.id, style));
  };

  const timelineOp = async (op, args) => {
    setError(null);
    try {
      const { edl: next } = await api.timelineOp(project.id, op, args);
      pushHistory(next);
    } catch (err) {
      setError(err);
    }
  };

  const runExport = async (preset) => {
    const res = await runJob('Exporting', () => api.exportVideo(project.id, preset));
    if (res) {
      const { exports: list } = await api.listExports(project.id);
      setExports(list);
    }
  };

  const renderPreview = async () => {
    const res = await runJob('Rendering preview', () => api.renderPreview(project.id));
    if (res?.url) window.open(res.url, '_blank', 'noopener');
  };

  useEffect(() => {
    api.listExports(project.id).then(({ exports: list }) => setExports(list)).catch(() => {});
  }, [project.id]);

  /* -------------------------------------------------------------- render */

  const hasMedia = (project.media || []).length > 0;
  const hasEdit = Boolean(edl && edl.timeline?.length);
  const stepBlocked = {
    edit: hasMedia ? null : 'Upload at least one video, image or voiceover first.',
    review: hasEdit ? null : 'Press AUTO EDIT to build the timeline.',
    export: hasEdit ? null : 'Press AUTO EDIT before exporting.',
  };

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onHome}>← Shorts</button>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          onBlur={(e) => saveProject({ name: e.target.value })}
        />
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/Cmd+Z)">↶</button>
          <button className="btn btn-ghost btn-sm" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)">↷</button>
        </div>
      </header>

      <nav className="steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            className={`step ${step === s.id ? 'is-on' : ''} ${stepBlocked[s.id] ? 'is-blocked' : ''}`}
            onClick={() => setStep(s.id)}
            title={stepBlocked[s.id] || ''}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {busy && (
        <div className="busybar">
          <span>{busy.label}…</span>
          <div className="progress"><div style={{ width: `${(busy.progress || 0) * 100}%` }} /></div>
        </div>
      )}

      <div className="editor-body">
        <div className="editor-left">
          <Preview
            project={project}
            edl={edl}
            styleDetail={styleDetail}
            currentTime={currentTime}
            onTimeChange={setCurrentTime}
            onDurationChange={() => {}}
          />

          {step !== 'upload' && (
            <Timeline
              edl={edl}
              analysis={project.analysis}
              currentTime={currentTime}
              selectedId={selectedId}
              onSeek={setCurrentTime}
              onSelect={setSelectedId}
              onOperation={timelineOp}
              zoom={zoom}
              onZoomChange={setZoom}
            />
          )}

          {step === 'review' && selectedClip && (
            <Inspector
              clip={selectedClip}
              project={project}
              currentTime={currentTime}
              onOperation={timelineOp}
              onClose={() => setSelectedId(null)}
              onSeek={setCurrentTime}
            />
          )}
        </div>

        <aside className="editor-right">
          <ErrorCard error={error} onDismiss={() => setError(null)} />

          {step === 'upload' && (
            <>
              <MediaLibrary
                project={project}
                onUpload={upload}
                onDeleteMedia={deleteMedia}
                onTagMedia={tagMedia}
                uploading={uploading}
                uploadProgress={uploadProgress}
              />
              <ScriptPanel project={project} onSave={saveProject} sttStatus={capabilities?.stt} />
              <button
                className="btn btn-primary btn-big"
                disabled={!hasMedia || Boolean(busy)}
                onClick={autoEdit}
                title={stepBlocked.edit || ''}
              >
                AUTO EDIT
              </button>
              {stepBlocked.edit && <p className="hint">{stepBlocked.edit}</p>}
            </>
          )}

          {step === 'edit' && (
            <div className="panel autoedit-panel">
              <h3 className="panel-title">AUTO EDIT</h3>
              <p>
                AUTO SHORTS will analyse your voice track, cut the silence, transcribe and time the
                captions, pick the words worth emphasising, add punch-ins, find B-roll moments,
                place sound design and balance the music.
              </p>
              <button className="btn btn-primary btn-big" disabled={!hasMedia || Boolean(busy)} onClick={autoEdit}>
                {project.edl ? 'RUN AUTO EDIT AGAIN' : 'AUTO EDIT'}
              </button>
              {stepBlocked.edit && <p className="hint">{stepBlocked.edit}</p>}
              <SettingsPanel
                project={project}
                capabilities={capabilities}
                onChange={saveProject}
                onRegenerateCaptions={regenerateCaptions}
                busy={Boolean(busy)}
              />
            </div>
          )}

          {step === 'review' && (
            <>
              <AIReport
                report={project.report}
                summary={summary}
                reEditOptions={capabilities?.reEditOptions}
                onReEdit={reEdit}
                busy={Boolean(busy)}
              />
              {!project.report && <p className="hint">{stepBlocked.review}</p>}
              <SettingsPanel
                project={project}
                capabilities={capabilities}
                onChange={saveProject}
                onRegenerateCaptions={regenerateCaptions}
                busy={Boolean(busy)}
              />
            </>
          )}

          {step === 'export' && (
            <ExportPanel
              project={project}
              capabilities={capabilities}
              exports={exports}
              exporting={Boolean(busy)}
              exportProgress={busy?.progress || 0}
              exportLabel={busy?.label}
              onExport={runExport}
              onRenderPreview={renderPreview}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
