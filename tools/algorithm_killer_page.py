"""
algorithm_killer_page.py — renders Algorithm Killer results as one
self-contained, phone-first Artifact page. Imported by retention_score.py
and rewrite.py (--html); later components add their sections here.

Rebuild the whole deck page (rewrites where tools/rewrites/ has a proposal):
    python tools/algorithm_killer_page.py --deck page.html
"""

import argparse
import glob
import json
import os

PAGE = r"""<title>Algorithm Killer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500&display=swap">
<style>
/* Layout: one 40rem column, summary first; a time-axis strip of beats is the spine. */
:root {
  --bg: #F3F2EE; --surface: #FFFFFF; --fg: #16171C; --muted: #5E6170; --line: #DCDBD4;
  --accent: #B5540F; --good: #2F7D4F; --warn: #A76B00; --bad: #B3261E;
  --good-bg: #E3F1E8; --warn-bg: #F6EBD3; --bad-bg: #F8E1DF;
  --f-body: "IBM Plex Sans", system-ui, sans-serif;
  --f-voice: "Newsreader", Georgia, serif;
  --f-data: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #07080C; --surface: #11131A; --fg: #E9E7E1; --muted: #9A9CA8; --line: #262935;
  --accent: #F0973F; --good: #5CC489; --warn: #E7B44C; --bad: #F2766C;
  --good-bg: #13291D; --warn-bg: #2B2410; --bad-bg: #321715; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #07080C; --surface: #11131A; --fg: #E9E7E1; --muted: #9A9CA8; --line: #262935;
  --accent: #F0973F; --good: #5CC489; --warn: #E7B44C; --bad: #F2766C;
  --good-bg: #13291D; --warn-bg: #2B2410; --bad-bg: #321715; color-scheme: dark }

* { box-sizing: border-box }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--f-body); margin: 0 }
.wrap { max-width: 40rem; margin: 0 auto; padding-inline: 16px; padding-block: 20px 48px;
  display: flex; flex-direction: column; gap: 28px }
h1, h2 { text-wrap: balance; margin: 0 }
h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600 }
.eyebrow { font: 600 12px/1 var(--f-data); letter-spacing: .1em; text-transform: uppercase; color: var(--accent) }
.num { font-family: var(--f-data); font-variant-numeric: tabular-nums }
section { display: flex; flex-direction: column; gap: 12px; min-width: 0 }

/* picker */
.picker { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin }
.picker button { flex: 0 0 auto; font: 500 13px var(--f-body); color: var(--fg); background: var(--surface);
  border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; min-height: 40px; cursor: pointer;
  display: flex; gap: 6px; align-items: center }
.picker button[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent) }
.picker .num { font-size: 12px }

/* summary */
.head { display: flex; flex-direction: column; gap: 10px }
.head h1 { font-size: 24px; line-height: 1.2; font-weight: 600 }
.scoreline { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap }
.big { font: 600 64px/0.9 var(--f-data); font-variant-numeric: tabular-nums }
.big small { font-size: 18px; color: var(--muted); font-weight: 400 }
.parts { display: flex; gap: 14px; flex-wrap: wrap; padding-bottom: 6px }
.parts div { display: flex; flex-direction: column; font-size: 12px; color: var(--muted) }
.parts b { font: 600 18px var(--f-data); color: var(--fg) }
.verdict { margin: 0; font-size: 16px }
.calib { font-size: 12.5px; color: var(--muted); border-left: 2px solid var(--line); padding-left: 10px; margin: 0 }

/* timeline */
.track { position: relative; display: flex; height: 44px; border-radius: 6px; overflow: hidden; gap: 2px }
.seg { min-width: 6px; border: 0; padding: 0; cursor: pointer; color: var(--fg);
  font: 600 11px var(--f-data); display: flex; align-items: center; justify-content: center }
.seg:focus-visible, .picker button:focus-visible, .copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.b-good { background: var(--good-bg) } .b-warn { background: var(--warn-bg) } .b-bad { background: var(--bad-bg) }
.t-good { color: var(--good) } .t-warn { color: var(--warn) } .t-bad { color: var(--bad) }
.swipe { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--accent); pointer-events: none }
.axis { position: relative; height: 16px; font: 11px var(--f-data); color: var(--muted) }
.axis span { position: absolute; transform: translateX(-50%) }
.axis span:first-child { transform: none } .axis span:last-child { transform: translateX(-100%) }
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted) }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px }

/* killers */
.killers { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none }
.killers li { background: var(--bad-bg); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px }
.killers b { color: var(--bad) }
.killers .meta { font-size: 12px; color: var(--muted) }
.clean { background: var(--good-bg); color: var(--fg); border-radius: 8px; padding: 10px 12px; margin: 0 }

/* beats */
.beats { display: flex; flex-direction: column; gap: 12px }
.beat { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px;
  display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; scroll-margin-top: 16px }
.beat.flag { border-color: var(--bad) }
.beat .bh { font: 12px var(--f-data); color: var(--muted); letter-spacing: .03em }
.beat .sc { font: 600 26px/1 var(--f-data); grid-row: span 2; text-align: right; align-self: start }
.beat blockquote { margin: 0; font: italic 17px/1.45 var(--f-voice); grid-column: 1 / -1; min-width: 0 }
.chips { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap }
.chip { font: 12px var(--f-data); border: 1px solid var(--line); border-radius: 4px; padding: 2px 7px; color: var(--muted) }
.chip b { color: var(--fg); font-weight: 600 }
.issues { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none }
.issue { display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed var(--line); padding-top: 10px }
.issue .mode { font-weight: 600 }
.issue .why { color: var(--muted); font-size: 14px }
.fix { display: flex; gap: 10px; align-items: flex-start; background: var(--bg); border-radius: 6px; padding: 8px 10px; margin-top: 2px }
.fix p { margin: 0; flex: 1; min-width: 0 }
.fix p::before { content: "Fix  "; font: 600 11px var(--f-data); letter-spacing: .08em; color: var(--accent) }
.sig { font: 11px var(--f-data); color: var(--muted) }
.ok { grid-column: 1 / -1; color: var(--good); margin: 0; font-size: 14px }
.notes { grid-column: 1 / -1; font-size: 12.5px; color: var(--muted); margin: 0 }

.copy { flex: 0 0 auto; font: 600 12px var(--f-body); color: var(--accent); background: transparent;
  border: 1px solid var(--accent); border-radius: 6px; padding: 6px 10px; min-height: 34px; cursor: pointer }
.copy.done { color: var(--good); border-color: var(--good) }
.script { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px;
  display: flex; flex-direction: column; gap: 10px }
.script p { margin: 0; font: italic 17px/1.5 var(--f-voice) }
.script .copy { align-self: flex-start }

/* rewrite */
.status { border-radius: 8px; padding: 10px 12px; margin: 0; display: flex; flex-direction: column; gap: 2px }
.status.pass { background: var(--good-bg) } .status.fail { background: var(--bad-bg) }
.status b { font-size: 15px }
.draftnote { font-size: 12.5px; color: var(--warn); margin: 0 }
.breaks { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 14px }
.rw { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px;
  display: flex; flex-direction: column; gap: 10px; min-width: 0 }
.rw.rejected { border-color: var(--bad) }
.rwh { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap }
.rwh .bh { font: 12px var(--f-data); color: var(--muted); letter-spacing: .03em }
.delta { font: 600 15px var(--f-data); white-space: nowrap }
.ba { display: grid; grid-template-columns: 1fr 1fr; gap: 10px }
.ba > div { min-width: 0; display: flex; flex-direction: column; gap: 4px }
.ba .lbl { font: 600 10.5px var(--f-data); letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.ba .old { font: italic 14.5px/1.45 var(--f-voice); color: var(--muted); text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--bad) 55%, transparent) }
.ba .new { font: italic 14.5px/1.45 var(--f-voice) }
.ba .new.cut { color: var(--muted); font-style: normal; font-family: var(--f-body) }
.why { margin: 0; font-size: 14px }
.checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px }
.checks li { display: grid; grid-template-columns: 18px 1fr; gap: 6px }
.checks .mk { font: 600 13px var(--f-data) }
.checks .d { color: var(--muted) }
.srcs { margin: 0; padding-left: 18px; font-size: 13px; display: flex; flex-direction: column; gap: 3px }
.srcs a { color: var(--accent); word-break: break-word }
.row { display: flex; gap: 8px; flex-wrap: wrap }
.prompt { font: 13px/1.5 var(--f-data); background: var(--bg); border-radius: 6px; padding: 8px 10px; margin: 0;
  white-space: pre-wrap; word-break: break-word }
.tagrw { color: var(--accent) }

details { border-top: 1px solid var(--line); padding-top: 12px }
summary { cursor: pointer; font-weight: 600; min-height: 32px }
.how { display: flex; flex-direction: column; gap: 12px; font-size: 14px; padding-top: 8px }
.how p { margin: 0 }
.tag { font: 600 10.5px var(--f-data); letter-spacing: .06em; text-transform: uppercase; padding: 1px 6px;
  border-radius: 3px; border: 1px solid currentColor; margin-left: 6px; vertical-align: 1px }
.tag.ev { color: var(--good) } .tag.inf { color: var(--warn) }
.how a { color: var(--accent); word-break: break-word }
.foot { font-size: 12.5px; color: var(--muted); margin: 0 }
@media (prefers-reduced-motion: no-preference) { .beat { transition: border-color .2s } }
</style>

<div class="wrap">
  <header class="head">
    <span class="eyebrow">Algorithm Killer · Score &amp; rewrite</span>
    <nav class="picker" id="picker" aria-label="Choose a script"></nav>
    <h1 id="title"></h1>
    <div class="scoreline">
      <div class="big" id="overall"></div>
      <div class="parts" id="parts"></div>
    </div>
    <p class="verdict" id="verdict"></p>
    <p class="calib" id="calib"></p>
  </header>

  <section aria-labelledby="h-rw" id="rwsec" hidden>
    <h2 id="h-rw">Rewrites</h2>
    <div id="rw"></div>
  </section>

  <section aria-labelledby="h-time">
    <h2 id="h-time">Where viewers leave</h2>
    <div class="track" id="track"></div>
    <div class="axis" id="axis"></div>
    <div class="legend"><span><i class="b-good"></i>Holds</span><span><i class="b-warn"></i>Borderline</span>
      <span><i class="b-bad"></i>Rewrite</span><span><i style="background:var(--accent)"></i>2-second swipe line</span></div>
  </section>

  <section aria-labelledby="h-kill">
    <h2 id="h-kill">Killers</h2>
    <div id="killers"></div>
  </section>

  <section aria-labelledby="h-beats">
    <h2 id="h-beats">Beat by beat</h2>
    <div class="beats" id="beats"></div>
  </section>

  <section aria-labelledby="h-script">
    <h2 id="h-script">Script as scored</h2>
    <p class="foot" id="scriptnote" hidden>This is the rewritten script. The scores above are for this version.</p>
    <div class="script"><p id="scripttext"></p><button class="copy" id="copyscript" type="button">Copy script</button></div>
  </section>

  <details>
    <summary>How the score works</summary>
    <div class="how" id="how"></div>
  </details>
  <p class="foot">To score and rewrite a new draft, paste it into the chat with Claude. You'll get this page back with your script in it. Scripts marked ✎ have checked rewrites.</p>
</div>

<script>
const DATA = __DATA__;
const RULES = __RULES__;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const band = s => s >= 75 ? "good" : s >= RULES.rewrite_threshold ? "warn" : "bad";
const SIG = Object.fromEntries(Object.entries(RULES.signals).map(([k, v]) => [k, v.name]));
const LABEL = {promise_in_window:"Promise in 2s", subject_in_hook:"Subject named", no_setup_opener:"No setup",
  hook_brevity:"Short hook", opens_loop:"Opens", closes_loop:"Pays off", carry:"Carry",
  loops_to_hook:"Loops", lands_new_turn:"Last turn", no_outro:"No outro"};
const MAX = Object.assign({}, ...["hook_rubric","beat_rubric","ending_rubric"].map(k =>
  Object.fromEntries(Object.entries(RULES[k]).map(([n, v]) => [n, v.points]))));

function copyText(btn, text) {
  const ok = () => { const t = btn.textContent; btn.textContent = "Copied"; btn.classList.add("done");
    setTimeout(() => { btn.textContent = t; btn.classList.remove("done"); }, 1400); };
  const fallback = () => { const r = document.createRange(); const n = btn.previousElementSibling || btn.parentNode;
    r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected, copy it"; };
  try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
}

function verdict(r) {
  const worst = r.beats.filter(b => b.needs_rewrite);
  if (r.killers.length) return `${r.killers.length} killer${r.killers.length > 1 ? "s" : ""} found. Fix ${r.killers.map(k => k.name.toLowerCase()).join(", ")} first.`;
  if (!worst.length) return "No beat falls below the rewrite line.";
  const span = `${worst[0].start}s–${worst[worst.length - 1].end}s`;
  const strong = [r.sections.hook >= 75 ? "hook" : "", r.sections.ending >= 75 ? "ending" : ""].filter(Boolean);
  return `${strong.length ? "The " + strong.join(" and ") + (strong.length > 1 ? " hold" : " holds") + ". " : ""}`
    + `${worst.length} beat${worst.length > 1 ? "s" : ""} fall below ${RULES.rewrite_threshold}, between ${span}.`;
}

function checksHtml(list) {
  return `<ul class="checks">${list.map(c => `<li><span class="mk ${c.ok ? (c.warn ? "t-warn" : "t-good") : "t-bad"}">${c.ok ? (c.warn ? "!" : "✓") : "✗"}</span>
    <span><b>${esc(c.name)}</b> <span class="d">${esc(c.detail)}</span></span></li>`).join("")}</ul>`;
}

function renderRewrite(r) {
  const w = r.rewrite;
  $("rwsec").hidden = !w; $("scriptnote").hidden = !w;
  $("h-script").textContent = w ? "Rewritten script" : "Script as scored";
  if (!w) return;
  const failed = w.rewrites.filter(x => !x.accepted).length + w.shots.filter(x => !x.accepted).length;
  const cost = r.overall - w.before_overall;
  let html = `<div class="status ${w.all_accepted ? "pass" : "fail"}">
      <b>${w.all_accepted ? "Every rewrite passed its checks" : `${failed} rewrite${failed === 1 ? "" : "s"} rejected`}</b>
      <span>Script score ${w.before_overall} → <span class="t-${band(r.overall)}">${r.overall}</span>.
      ${w.rule_fix && cost < 0 ? `Fixing the hard-rule breaks cost ${-cost} point${cost === -1 ? "" : "s"}: the scorer liked the old wording. The rules win.` : ""}
      ${!w.overall_ok ? "The overall score dropped, so a score-only rewrite can't be accepted." : ""}</span></div>`;
  if (w.hard_rules_status !== "approved")
    html += `<p class="draftnote">Checked against the draft Cosmic hard rules. They aren't approved yet.</p>`;
  if (w.original_breaks.length)
    html += `<div><h2 style="margin-bottom:6px">Hard-rule breaks in the original</h2><ul class="breaks">${w.original_breaks.map(o =>
      `<li>Beat ${o.beat} breaks rule ${o.rule}: ${esc((w.hard_rules[o.rule - 1] || "").split(".")[0])}. <span class="d" style="color:var(--muted)">${esc(o.detail)}</span></li>`).join("")}</ul></div>`;
  html += w.rewrites.map(x => {
    const reason = x.reason === "rule" ? `Hard rule ${x.rule}` : "Retention";
    const d = x.after_score == null ? "cut" : `${x.before_score} → ${x.after_score}`;
    const dcls = x.after_score == null ? "" : `t-${band(x.after_score)}`;
    return `<article class="rw${x.accepted ? "" : " rejected"}">
      <div class="rwh"><span class="bh">Beat ${x.beat} · ${reason}${x.accepted ? "" : " · REJECTED"}</span><span class="delta ${dcls}">${d}</span></div>
      <div class="ba"><div><span class="lbl">Before</span><span class="old">${esc(x.before)}</span>
        <span class="d" style="font-size:12px;color:var(--muted)">${esc(x.old_issues.join(" · ") || (x.reason === "rule" ? "Breaks a hard rule" : ""))}</span></div>
        <div><span class="lbl">After</span>${x.after ? `<span class="new">${esc(x.after)}</span>` : `<span class="new cut">Line removed.</span>`}</div></div>
      <p class="why">${esc(x.why)}</p>
      ${checksHtml(x.checks)}
      ${(x.sources || []).length ? `<ul class="srcs">${x.sources.map(s => `<li>${esc(s.claim)}: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, ""))}</a></li>`).join("")}</ul>` : ""}
      ${x.after ? `<div class="row"><span hidden>${esc(x.after)}</span><button class="copy" type="button" data-copy="${esc(x.after)}">Copy new line</button></div>` : ""}
    </article>`;
  }).join("");
  html += w.shots.map(sh => `<article class="rw${sh.accepted ? "" : " rejected"}">
      <div class="rwh"><span class="bh">${sh.replaces ? `Replaces ${esc(sh.replaces)}` : "New shot"} · ${sh.kind === "still" ? "Flux still, slow push" : "Wan 2.2 clip"} · ${sh.span_s}s</span></div>
      <p class="prompt">${esc(sh.prompt)}</p>
      <div class="row"><button class="copy" type="button" data-copy="${esc(sh.prompt)}">Copy image prompt</button>
        <button class="copy" type="button" data-copy="${esc(sh.motion)}">Copy motion</button></div>
      <p class="why"><b>Motion:</b> ${esc(sh.motion)}</p>
      ${checksHtml(sh.checks)}</article>`).join("");
  if (w.existing_shot_problems.length)
    html += `<div class="status fail"><b>Existing shots to fix</b>${w.existing_shot_problems.map(s =>
      `<span>${esc(s.name)}: ${esc(s.problems.join("; "))}</span>`).join("")}</div>`;
  if (w.notes.length)
    html += `<div><h2 style="margin-bottom:6px">Production notes</h2><ul class="breaks">${w.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
  $("rw").innerHTML = html;
  $("rw").querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copyText(b, b.dataset.copy));
}

function show(idx) {
  const r = DATA[idx];
  document.querySelectorAll("#picker button").forEach((b, i) => b.setAttribute("aria-pressed", i === idx));
  try { localStorage.setItem("ak-pick", idx); } catch (e) {}
  $("title").textContent = r.label + (r.rewrite ? " · rewritten" : "");
  $("overall").innerHTML = `<span class="t-${band(r.overall)}">${r.overall}</span><small>/100</small>`;
  $("parts").innerHTML = [["Hook", r.sections.hook, RULES.section_weights.hook], ["Body", r.sections.body, RULES.section_weights.body],
    ["Ending", r.sections.ending, RULES.section_weights.ending]].map(([n, v, w]) =>
    `<div>${n} ×${w}<b class="t-${band(v)}">${v}</b></div>`).join("")
    + (r.penalty ? `<div>Killers<b class="t-bad">−${r.penalty}</b></div>` : "")
    + (r.rewrite ? `<div>Before<b class="t-${band(r.rewrite.before_overall)}">${r.rewrite.before_overall}</b></div>` : "");
  $("verdict").textContent = verdict(r);
  $("calib").textContent = r.calibrated_on_videos
    ? `Weights calibrated on ${r.calibrated_on_videos} of your published Shorts.`
    : `Prediction only. These weights haven't been checked against any of your videos yet, so treat the number as a ranking between drafts, not a forecast. ~${r.duration_s}s at ${r.pace_wps} words/s (your Short #1 voice).`;

  const tot = r.duration_s;
  $("track").innerHTML = r.beats.map(b =>
    `<button class="seg b-${band(b.score)}" style="flex:${Math.max(b.end - b.start, .3)}" data-n="${b.n}"
      aria-label="Beat ${b.n}, ${b.start} to ${b.end} seconds, score ${b.score}"><span class="t-${band(b.score)}">${b.n}</span></button>`).join("")
    + `<span class="swipe" style="left:${(RULES.hook_window_seconds / tot) * 100}%"></span>`;
  const ticks = [0, 2, ...[10, 20, 30].filter(t => t < tot - 2), Math.round(tot)];
  $("axis").innerHTML = ticks.map(t => `<span style="left:${t / tot * 100}%">${t}s</span>`).join("");
  $("track").querySelectorAll(".seg").forEach(s => s.onclick = () =>
    document.getElementById("beat-" + s.dataset.n).scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}));

  $("killers").innerHTML = r.killers.length
    ? `<ul class="killers">${r.killers.map(k => `<li><b>${esc(k.name)}</b><span>${esc(k.detail)}</span>
        <span class="meta">−${k.penalty} · hurts ${esc(SIG[k.signal])}</span></li>`).join("")}</ul>`
    : `<p class="clean">None of the five named killers fired: the hook comes first, there's one idea, the ending loops, no two-beat lull, and the runtime is in range.</p>`;

  $("beats").innerHTML = r.beats.map(b => {
    const chips = Object.entries(b.components).map(([k, v]) =>
      `<span class="chip">${LABEL[k] || k} <b>${v}</b>/${MAX[k]}</span>`).join("");
    const issues = b.issues.length ? `<ul class="issues">${b.issues.map(i => `<li class="issue">
        <span class="mode">${esc(i.mode)}</span><span class="why">${esc(i.detail)}</span>
        <div class="fix"><p>${esc(i.fix)}</p><button class="copy" type="button">Copy</button></div>
        <span class="sig">Signal: ${esc(SIG[i.signal] || i.signal)}</span></li>`).join("")}</ul>`
      : `<p class="ok">Holds. Nothing to fix.</p>`;
    const role = {hook: "Hook", body: "Beat", ending: "Ending"}[b.role];
    return `<article class="beat${b.needs_rewrite ? " flag" : ""}" id="beat-${b.n}">
      <span class="bh">${b.n} · ${role} · ${b.start}–${b.end}s${b.rewritten ? ' · <span class="tagrw">REWRITTEN</span>' : ""}${b.needs_rewrite ? " · BELOW " + RULES.rewrite_threshold : ""}</span>
      <span class="sc t-${band(b.score)}">${b.score}</span>
      <span></span>
      <blockquote>${esc(b.text)}</blockquote>
      <div class="chips">${chips}</div>
      ${b.notes.length ? `<p class="notes">Credited for: ${esc([...new Set(b.notes)].join("; "))}</p>` : ""}
      ${issues}</article>`;
  }).join("");
  $("beats").querySelectorAll(".fix .copy").forEach(btn =>
    btn.onclick = () => copyText(btn, btn.previousElementSibling.textContent));

  renderRewrite(r);

  const script = r.beats.map(b => b.text).join(" ");
  $("scripttext").textContent = script;
  $("copyscript").onclick = () => copyText($("copyscript"), script);
}

$("how").innerHTML = `<p>Each beat is one spoken sentence, timed at your measured narration pace. The score adds up
  the points listed on each beat; nothing else goes in. Beats under ${RULES.rewrite_threshold} are marked for rewrite.</p>`
  + Object.values(RULES.signals).map(s => `<p><b>${esc(s.name)}</b>
     <span class="tag ${s.basis === "evidence" ? "ev" : "inf"}">${s.basis === "evidence" ? "evidence" : "evidence + inference"}</span><br>
     ${esc(s.what)}<br><a href="${esc((s.source.match(/https?:\/\/\S+/) || [""])[0])}">${esc(s.source)}</a></p>`).join("")
  + `<p><b>The rubric itself</b> <span class="tag inf">inference</span><br>Which words count as opening, paying off
     or carrying a loop is my reasoning, not research. The scorer reads wording, not meaning. Once your Shorts are live,
     the feedback loop checks every rule against your own retention numbers and keeps the ones your channel supports.</p>`;

$("picker").innerHTML = DATA.map((r, i) =>
  `<button type="button" aria-pressed="false"><span class="num t-${band(r.overall)}">${r.overall}</span>${esc(r.label)}${r.rewrite ? ' <span class="tagrw">✎</span>' : ""}</button>`).join("");
$("picker").querySelectorAll("button").forEach((b, i) => b.onclick = () => show(i));
if (DATA.length < 2) $("picker").hidden = true;
let start = 0;
try { const s = +localStorage.getItem("ak-pick"); if (s >= 0 && s < DATA.length) start = s; } catch (e) {}
show(start);
</script>
"""


def render(results, niche, rules):
    if isinstance(results, dict):
        results = [results]
    data = json.dumps(results, ensure_ascii=False).replace("</", "<\\/")
    rl = json.dumps(rules, ensure_ascii=False).replace("</", "<\\/")
    return PAGE.replace("__DATA__", data).replace("__RULES__", rl)


def build_deck(extra=()):
    """Every Short in the doc: its checked rewrite if one exists, else its score."""
    import rewrite
    import retention_score as rs
    niche, rules = rs.load_niche(), rs.load_rules()
    here = os.path.dirname(os.path.abspath(__file__))
    props = {}
    for path in glob.glob(os.path.join(here, "rewrites", "*.json")):
        with open(path, encoding="utf-8") as f:
            p = json.load(f)
        if "short" in p:
            props[p["short"]] = p
    out = []
    for s in rs.load_doc_shorts():
        if s["num"] in props:
            out.append(rewrite.run(props[s["num"]], niche, rules))
        else:
            out.append(rs.score_script("", niche, rules, label=f"#{s['num']} {s['title']}",
                                       beats=rs.doc_beats(s)))
    out.extend(extra)
    return render(out, niche, rules)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument("--deck", required=True, help="Write the deck page here")
    a = ap.parse_args()
    with open(a.deck, "w", encoding="utf-8") as f:
        f.write(build_deck())
