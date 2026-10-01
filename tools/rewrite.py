#!/usr/bin/env python3
"""
rewrite.py — Algorithm Killer, Component 2: check proposed beat rewrites and
show them before/after.

Claude writes the rewrites (in a proposals JSON); this file is the referee.
A rewrite is accepted only if it passes every check:

  1. Score   — rescored in context of the whole new script; a score rewrite
               must lift its beat to the rewrite threshold or by 10+ points,
               and no rewrite may drop the script's overall score.
  2. Rules   — the active niche's hard_rules. New numbers or names must carry
               a source. Lexical guards catch invented threats, unsourced
               'scientists say', despair framing, tone breaks and engagement
               bait. Rules the code can't read are listed as checked by Claude.
  3. Pipeline — any new shot must be makeable on Flux stills + Wan 2.2 clips:
               no faces, no readable text, clips capped at 5 seconds.

Usage (Claude runs these; the owner reads the Artifact):
    python tools/rewrite.py tools/rewrites/cosmic-01.json --json out.json
    python tools/rewrite.py tools/rewrites/*.json --html page.html

Proposals JSON:
    {"short": 1,                       # or "text": "<draft script>"
     "rewrites": [{"beat": 4, "after": "...", "reason": "score" | "rule",
                   "rule": 2, "why": "...",
                   "sources": [{"claim": "...", "url": "https://..."}]}],
     "shots": [{"for_beats": [4], "replaces": "Shot 2", "kind": "clip" | "still",
                "prompt": "...", "motion": "..."}],
     "notes": ["..."]}
An "after" of "" deletes the beat. Beat numbers refer to the original script.
"""

import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from retention_score import (DEFAULT_DOC, ROOT, CLOSE_NUMBER, doc_beats,  # noqa: E402
                             load_doc_shorts, load_niche, load_rules, score_script,
                             split_beats)

CLIP_CAP_S = 5.0  # Wan 2.2 rejects duration_seconds above 5 (CLAUDE.md, 2026-09-21)
MIN_LIFT = 10

# Lexical guards. Each maps to a hard rule (1-based index in niche.json) or to
# the build's own no-manipulation constraint. They catch wording, not meaning.
GUARDS = [
    (3, r"\b(already (be )?(on (its|their) way|coming|here)|on (its|their) way (here|to us|to earth)|never see it coming|"
        r"any day now|could (hit|strike|end) (us|earth) at any|heading (for|toward) (us|earth))\b",
     "Implies a real threat is close"),
    (5, r"\b(nothing matters|you don't matter|none of (it|this) matters|pointless|meaningless|why bother)\b",
     "Despair framing aimed at the viewer"),
]
UNSOURCED_AUTHORITY = r"\b(scientists (say|believe|think|agree)|studies show|research shows|experts (say|warn))\b"
TONE = r"(!|\b(insane|crazy|mind-?blowing|you won't believe|literally|epic|omg)\b)"
BAIT = r"\b(comment below|like if|wait for it|watch (till|until) the end|part 2|follow for part|smash)\b"

SHOT_BANNED = [
    (r"\b(face|faces|facial|portrait|eyes|man|woman|person|people|child|crowd|astronaut)\b",
     "Shows a face or person: Flux can't hold faces and the channel is faceless"),
    (r"\b(text|label|labeled|labelled|sign|words|letters|caption|writing|numbers|logo|title|ui|screen)\b",
     "Asks for readable text: image models garble it"),
    (r"\b(nasa|esa|hubble image|jwst image|footage)\b",
     "Real agency branding or footage (hard rule 7)"),
]
REAL_OBJECTS = r"\b(earth|the sun|moon|milky way|sagittarius|andromeda|jupiter|mars|saturn)\b"


def new_facts(before, after):
    """Numbers and capitalised names in the rewrite that the original didn't have."""
    def facts(t):
        nums = {m.group(0).lower() for m in re.finditer(CLOSE_NUMBER, t.lower())} - {"one"}
        names = {m.group(0) for m in re.finditer(r"(?<![.?!]\s)(?<!^)\b[A-Z][a-z]+(?:[\s–-][A-Z][\w*]*)*", t)}
        return nums | names
    return sorted(facts(after) - facts(before))


def check_text(r, before, niche):
    after = r.get("after", "")
    checks = []
    low = after.lower()
    for rule_no, pat, label in GUARDS:
        m = re.search(pat, low)
        checks.append({"name": f"Hard rule {rule_no}", "ok": not m,
                       "detail": f"{label}: “{m.group(0)}”" if m else "No match"})
    facts = new_facts(before, after)
    sourced = bool(r.get("sources"))
    checks.append({"name": "Hard rule 1: new facts sourced", "ok": not facts or sourced,
                   "detail": ("Adds " + ", ".join(facts) + (" (sourced)" if sourced else " with no source"))
                   if facts else "Adds no new number or name"})
    m = re.search(UNSOURCED_AUTHORITY, low)
    checks.append({"name": "Hard rule 4: no unsourced authority", "ok": not m or sourced,
                   "detail": f"“{m.group(0)}”" + (" (sourced)" if sourced else " with no source")
                   if m else "No appeal to authority"})
    m = re.search(TONE, after, re.I)
    checks.append({"name": "Tone: " + niche["tone"].split(".")[0], "ok": not m,
                   "detail": f"Breaks tone: “{m.group(0)}”" if m else "Calm, no hype words"})
    m = re.search(BAIT, low)
    checks.append({"name": "No engagement bait", "ok": not m,
                   "detail": f"“{m.group(0)}”" if m else "None"})
    return checks


def check_shot(shot, beats_by_n):
    prompt = shot.get("prompt", "")
    low = prompt.lower()
    checks = []
    for pat, label in SHOT_BANNED:
        m = re.search(pat, low)
        checks.append({"name": label.split(":")[0], "ok": not m,
                       "detail": f"“{m.group(0)}” — {label}" if m else "Clear"})
    covered = [beats_by_n[n] for n in shot.get("for_beats", []) if n in beats_by_n]
    span = round(sum(b["end"] - b["start"] for b in covered), 1)
    if shot.get("kind", "clip") == "clip":
        clips = max(1, math.ceil(span / CLIP_CAP_S))
        checks.append({"name": "Clip length", "ok": span <= CLIP_CAP_S,
                       "detail": f"Covers {span}s of narration. "
                       + ("Fits one clip." if span <= CLIP_CAP_S else
                          f"Over the {CLIP_CAP_S:.0f}s cap: needs {clips} clips, or run it as a still with a slow push.")})
    else:
        checks.append({"name": "Still length", "ok": True,
                       "detail": f"Covers {span}s as a still with a slow push. No length cap."})
    if "photorealistic" in low and re.search(REAL_OBJECTS, low):
        checks.append({"name": "Hard rule 6: disclosure", "ok": True, "warn": True,
                       "detail": "Photorealistic shot of a real object: tick YouTube's altered-or-synthetic box."})
    return checks, span


def doc_shots(num, path=DEFAULT_DOC):
    md = open(path, encoding="utf-8").read()
    m = re.search(rf"^## {num} — .*?(?=^## |\Z)", md, re.S | re.M)
    if not m:
        return []
    return [{"name": f"Shot {a}", "prompt": b.strip()} for a, b in
            re.findall(r"\*\*Shot (\d+)\*\*\n```\n(.*?)\n```", m.group(0), re.S)]


def run(prop, niche, rules):
    label = prop.get("label")
    source = None
    if "short" in prop:
        s = next((x for x in load_doc_shorts() if x["num"] == prop["short"]), None)
        if not s:
            raise SystemExit(f"No Short #{prop['short']} in the doc.")
        # Proposals freeze the script they were written against, so they stay
        # valid after apply_rewrites.py writes the fixes into the doc.
        orig_beats = prop.get("original", {}).get("beats") or doc_beats(s)
        label = label or f"#{s['num']} {s['title']}"
        source = s
    else:
        orig_beats = split_beats(prop["text"])
        label = label or "Draft"

    before = score_script("", niche, rules, label=label, beats=orig_beats)
    orig = [b["text"] for b in before["beats"]]
    by_beat = {r["beat"]: r for r in prop.get("rewrites", [])}

    # Build the new script and remember which original beat each new sentence came from.
    # The last beat is a delivered end line: keep it whole, as the scorer does.
    pieces, origin = [], []
    for i, t in enumerate(orig, 1):
        new = by_beat[i]["after"] if i in by_beat else t
        sents = ([new] if i == len(orig) else split_beats(new)) if new else []
        for sent in sents:
            pieces.append(sent)
            origin.append(i)
    after = score_script("", niche, rules, label=label, beats=pieces)
    if len(after["beats"]) != len(origin):  # sentence split disagreed; fall back to text matching
        origin = [next((i for i, t in enumerate(orig, 1) if b["text"] in (by_beat.get(i, {}).get("after") or t)), 0)
                  for b in after["beats"]]
    for b, o in zip(after["beats"], origin):
        b["from_beat"] = o
        b["rewritten"] = o in by_beat

    original_breaks = []
    for b in before["beats"]:
        for rule_no, pat, lab in GUARDS:
            m = re.search(pat, b["text"].lower())
            if m:
                original_breaks.append({"beat": b["n"], "rule": rule_no, "detail": f"{lab}: \u201c{m.group(0)}\u201d"})
    for r in prop.get("rewrites", []):
        if r.get("reason") == "rule" and r.get("rule") and not any(
                o["beat"] == r["beat"] for o in original_breaks):
            original_breaks.append({"beat": r["beat"], "rule": r["rule"],
                                    "detail": "Found on review by Claude (not a lexical match)"})
    original_breaks.sort(key=lambda o: o["beat"])

    results = []
    for n, r in sorted(by_beat.items()):
        old = before["beats"][n - 1]
        new_beats = [b for b in after["beats"] if b["from_beat"] == n]
        new_score = round(sum(b["score"] for b in new_beats) / len(new_beats)) if new_beats else None
        checks = check_text(r, old["text"], niche)
        if r.get("reason", "score") == "score" and new_score is not None:
            lifted = new_score >= rules["rewrite_threshold"] or new_score - old["score"] >= MIN_LIFT
            checks.insert(0, {"name": "Score lift", "ok": lifted,
                              "detail": f"{old['score']} → {new_score}"})
        else:
            checks.insert(0, {"name": "Score lift", "ok": True,
                              "detail": f"{old['score']} → {new_score if new_score is not None else 'deleted'} "
                                        "(rule fix: score not required to rise)"})
        results.append({**r, "before": old["text"], "before_score": old["score"],
                        "after_score": new_score, "old_issues": [i["mode"] for i in old["issues"]],
                        "checks": checks, "accepted": all(c["ok"] for c in checks)})

    # A hard-rule fix is mandatory, so it may cost points; a pure score rewrite may not.
    rule_fix = any(r.get("reason") == "rule" for r in by_beat.values())
    overall_ok = rule_fix or after["overall"] >= before["overall"]
    beats_by_n = {i + 1: b for i, b in enumerate(after["beats"])}
    # Shots name beats in the original numbering; translate to new-beat timings.
    new_by_orig = {}
    for b in after["beats"]:
        new_by_orig.setdefault(b["from_beat"], []).append(b)
    shots = []
    for sh in prop.get("shots", []):
        covered = {}
        for n in sh.get("for_beats", []):
            for b in new_by_orig.get(n, []):
                covered[b["n"]] = b
        checks, span = check_shot({**sh, "for_beats": list(covered)}, beats_by_n)
        shots.append({**sh, "checks": checks, "span_s": span,
                      "accepted": all(c["ok"] for c in checks)})
    existing = []
    if source and "original" not in prop:
        for sh in doc_shots(source["num"]):
            if any(x.get("replaces") == sh["name"] for x in shots):
                continue
            bad = [label for pat, label in SHOT_BANNED if re.search(pat, sh["prompt"].lower())]
            if bad:
                existing.append({**sh, "problems": bad})

    rule_status = niche.get("hard_rules_status", "approved")
    return {**after,
            "label": label,
            "rewrite": {
                "before_overall": before["overall"],
                "before_sections": before["sections"],
                "before_killers": [k["name"] for k in before["killers"]],
                "before_script": " ".join(orig),
                "after_script": " ".join(pieces),
                "overall_ok": overall_ok,
                "rule_fix": rule_fix,
                "original_breaks": original_breaks,
                "rewrites": results,
                "shots": shots,
                "existing_shot_problems": existing,
                "notes": prop.get("notes", []),
                "hard_rules": niche.get("hard_rules", []),
                "hard_rules_status": rule_status,
                "checked_by_claude": [
                    "Hard rule 1 (accuracy): the sources linked on each rewrite",
                    "Hard rule 2 (hypotheticals labelled)",
                    "Hard rule 8 (written for this topic, not a template swap)",
                ],
                "all_accepted": overall_ok and all(r["accepted"] for r in results)
                and all(s["accepted"] for s in shots),
            }}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("proposals", nargs="+")
    ap.add_argument("--niche")
    ap.add_argument("--json")
    ap.add_argument("--html")
    args = ap.parse_args()
    niche, rules = load_niche(args.niche), load_rules()
    out = []
    for p in args.proposals:
        with open(p, encoding="utf-8") as f:
            out.append(run(json.load(f), niche, rules))
    for r in out:
        rw = r["rewrite"]
        print(f"{rw['before_overall']:>3} → {r['overall']:>3}  {r['label'][:40]:<40} "
              f"{'ACCEPTED' if rw['all_accepted'] else 'REJECTED'}")
        for x in rw["rewrites"]:
            fails = [c["name"] + ": " + c["detail"] for c in x["checks"] if not c["ok"]]
            print(f"      beat {x['beat']}: {x['before_score']} → {x['after_score']}"
                  + (f"  FAIL {fails}" if fails else ""))
        for s in rw["shots"]:
            fails = [c["detail"] for c in s["checks"] if not c["ok"]]
            print(f"      shot for {s['for_beats']}: " + ("ok" if not fails else f"FAIL {fails}"))
        for s in rw["existing_shot_problems"]:
            print(f"      existing {s['name']}: {s['problems']}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
    if args.html:
        from algorithm_killer_page import render
        with open(args.html, "w", encoding="utf-8") as f:
            f.write(render(out, niche, rules))


if __name__ == "__main__":
    main()
