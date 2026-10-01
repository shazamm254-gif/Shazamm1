#!/usr/bin/env python3
"""
retention_score.py — Algorithm Killer, Component 1: score a Short's script beat
by beat for retention, 0-100, and say exactly where it will lose viewers.

Every point awarded or taken traces to a ranking signal named in
retention_rules.json (viewed-vs-swiped-away, average percentage viewed,
replays). The rules read wording, not meaning: they are a prediction until
tools/feedback_loop.py calibrates them against the channel's real numbers.

Usage (Claude runs these; the owner reads the Artifact):
    # Score Short #1 from the active niche's production doc:
    python tools/retention_score.py --doc-short 1 --html out.html

    # Score a draft pasted in chat (one file, plain text):
    python tools/retention_score.py --file draft.txt --json out.json

    # Rank every script in the doc:
    python tools/retention_score.py --doc-all
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_DOC = os.path.join(ROOT, "docs", "IMAGE_PROMPTS_FLUX_COSMIC.md")

# --- Lexical cues ----------------------------------------------------------
# Each cue list is a guess about wording that opens, closes or carries a
# curiosity loop. They are inference; feedback_loop.py tests them on real data.

STRONG_OPEN = [
    (r"\?", "asks a question"),
    (r"\bwhat (if|happens|'s really)\b", "poses a what-if"),
    (r"\b(shouldn't|can't explain|cannot explain|don't (fully )?know|no one knows|nobody (knows|can)|impossible|unexplained|mystery)\b",
     "states something unexplained"),
    (r"\b(largest|biggest|deadliest|loneliest|last|most (?!of\b)\w+|oldest|fastest|densest|only)\b",
     "makes a superlative claim to prove"),
    (r"\bsomething\b", "withholds what 'something' is"),
    (r"\bhere's (how|why|what)\b", "promises an explanation"),
    (ESCALATION := r"\b(it gets worse|far worse|even worse|isn't even the (end|worst)|"
                   r"that's not (all|the worst)|but that's not|it doesn't stop there)\b",
     "promises escalation"),
]
WEAK_OPEN = [
    (r"\b(die|dies|death|end all|end nearly|destroy|freeze|freezes|vanish|strip|swallow|fling|stretch|stretches|tear|crash|collide|explode|kill|no warning|too late|forever|alone)\b",
     "raises the stakes"),
    (r"^(but|yet|until)\b", "turns against the last beat"),
    (r"\b(then|until|after that|within)\b", "promises a next step"),
    (r"\b(you|your|we|us|our|imagine)\b", "puts the viewer in it"),
    (r"\b(never|nothing|no one)\b", "denies an expectation"),
]
# A consequence stated plainly after a promise is a payoff in this niche,
# even without a number ("you freeze at the edge").
OUTCOME = (r"\b(freeze|freezes|stretch|stretches|slow down|vanish|flies off|strip|end|"
           r"burn|burns|goes out|fades|collapse|swallow|pull|pulls|circling|orbiting|"
           r"shakes|stretched|frozen|wandering|dragging|become|ice|ices|snow|colder|"
           r"torn apart|dies|die|burns out|goes dark|stops)\b")
NEGATION = r"\b(never|not|no|nothing|can't|don't)\b"
CLOSE_NUMBER = (r"\b(\d[\d,\.]*|one|two|three|four|five|six|seven|eight|nine|ten|"
                r"twelve|hundreds?|thousands?|millions?|billions?|trillions?|half)\b")
CLOSE_NAME = r"\b(they call it|we call it|it's called|called|known as)\b"
CLOSE_EXPLAIN = r"\b(because|which means|that's why|so that|the light reaching)\b"
CONNECTIVE_START = (r"^(then|but|and|within|after that|until|so|including|now|yet|"
                    r"even|still|next|by the time|to you|to anyone)\b")
FORWARD_IN_BEAT = r"\b(then|until|after that|soon|within|next|by the time)\b"
SETUP_OPENERS = (r"^(so,?|today|hey|hi|welcome|did you know|have you ever|"
                 r"in \d{3,4}|back in|long ago|for (centuries|years|decades)|"
                 r"scientists have (long|always)|let's|in this video|"
                 r"before we (start|begin)|first,? (some|a little) (context|background))\b")
OUTRO = r"\b(subscribe|follow for|like and|thanks for watching|comment below|see you)\b"
PIVOTS = (r"\b(also,|another (fact|thing|one)|fun fact|bonus|on top of that|"
          r"speaking of|by the way|second(ly)?,)")
# A body beat that opens like a fresh hook signals a second idea starting.
SECOND_HOOK = r"^(this is the|there's another|here's another|what if)\b"
CALLBACK = r"\b(still|already|whole (time|life)|right now|always|again)\b"

STOP = set("""a an the and or but if of in on at to for from by with as is are was
were be been it its it's this that these those you your you're we our us they
them their there there's here what when how why who which all any just so than
then too very can could would will into out up down over under no not nothing
one more most only own same such some""".split())


def stem(w):
    w = w.lower().strip("'’")
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def content_words(text):
    return {stem(w) for w in re.findall(r"[A-Za-z][A-Za-z'’]+", text)
            if w.lower() not in STOP and len(w) > 2}


def find(cues, text):
    low = text.lower()
    return [label for pat, label in cues if re.search(pat, low)]


# --- Parsing ---------------------------------------------------------------

def split_beats(text):
    """One beat per sentence. Fragments ('Then darkness.') are beats too —
    each is a separate moment the viewer can leave on."""
    text = re.sub(r"\s+", " ", text.replace("…", "... ")).strip()
    parts = re.split(r"(?<=[.?!])[\"”’]?\s+(?=[\"“‘]?[A-Z0-9…\.])", text)
    beats = []
    for p in parts:
        p = p.strip().strip('"“”').strip()
        p = re.sub(r"^\.{3}\s*", "…", p)
        if re.sub(r"[\W_]", "", p):
            beats.append(p)
    return beats


def load_doc_shorts(path=DEFAULT_DOC):
    """Pull every Short's voiceover and spoken end line from the production doc."""
    md = open(path, encoding="utf-8").read()
    shorts = []
    for m in re.finditer(r"^## (\d+) — (.+?) · \*(.+?)\*\n(.*?)(?=^## |\Z)", md, re.S | re.M):
        num, title, pillar, body = m.groups()
        vo = re.search(r"^> (.+)$", body, re.M)
        end = re.search(r"\*\*End line:\*\*\s*(.+)$", body, re.M)
        if not vo:
            continue
        end_line = ""
        if end:
            end_line = re.sub(r"\*\(.*?\)\*?|\*", "", end.group(1))
            end_line = end_line.strip().strip('"“”').strip()
        shorts.append({"num": int(num), "title": title.strip(), "pillar": pillar,
                       "voiceover": vo.group(1).strip(), "end_line": end_line})
    return shorts


def load_niche(path=None):
    with open(path or os.path.join(HERE, "niche.json"), encoding="utf-8") as f:
        return json.load(f)


def load_rules(path=None):
    with open(path or os.path.join(HERE, "retention_rules.json"), encoding="utf-8") as f:
        return json.load(f)


# --- Scoring ---------------------------------------------------------------

def subject_terms(niche):
    terms = list(niche.get("title_keywords", []))
    terms += niche.get("fillers", {}).get("object", [])
    terms = [re.sub(r"^(a|an|the) ", "", t.lower()) for t in terms]
    return sorted(set(terms), key=len, reverse=True)


def open_strength(text):
    strong, weak = find(STRONG_OPEN, text), find(WEAK_OPEN, text)
    val = 1.0 if strong else (0.5 if weak else 0.0)
    if strong and weak:
        val = 1.0
    elif len(weak) >= 2:
        val = 0.75
    return val, strong + weak


def close_strength(text, has_prior_open):
    low = text.lower()
    reasons = []
    if re.search(CLOSE_NUMBER, low):
        reasons.append("delivers a number")
    if re.search(CLOSE_NAME, low) or re.search(r"(?<!^)(?<![.?!] )\b[A-Z][a-z]+(?:[\s–-]+[A-Z][\w*]*)+", text[1:]):
        reasons.append("names the thing")
    if re.search(CLOSE_EXPLAIN, low):
        reasons.append("explains a cause")
    outcome = "?" not in text and re.search(OUTCOME, low)
    if outcome:
        reasons.append("delivers the outcome")
    if any(r in reasons for r in ("delivers a number", "names the thing")):
        val = 1.0
    elif outcome:
        val = 0.7
    else:
        val = 0.6 if reasons else 0.0
    if not has_prior_open:
        val *= 0.5
    return val, reasons


def carry_strength(text, nxt):
    reasons = []
    val = 0.0
    if re.search(r"(—|-{2}|\.\.\.|…)\s*$", text):
        val, reasons = 1.0, ["ends mid-thought"]
    if nxt is not None and text.rstrip().endswith("?"):
        val = 1.0; reasons.append("asks what the next beat answers")
    if nxt is not None:
        if re.search(CONNECTIVE_START, re.sub(r"^[\W_]+", "", nxt.lower())):
            val = max(val, 0.7); reasons.append("next beat opens with a connective")
        if find(STRONG_OPEN, nxt):
            val = min(1.0, val + 0.4); reasons.append("next beat raises a new question")
    if nxt is not None and re.search(NEGATION, text.lower()):
        val = max(val, 0.5); reasons.append("leaves 'then what?' open")
    if re.search(ESCALATION, text.lower()):
        val = 1.0; reasons.append("promises more is coming")
    if re.search(FORWARD_IN_BEAT, text.lower()):
        val = min(1.0, val + 0.3); reasons.append("promises what comes next")
    return val, reasons


def quote(text, n=8):
    words = text.split()
    return " ".join(words[:n]) + ("…" if len(words) > n else "")


def doc_beats(short):
    """Voiceover split into sentences; the doc's end line stays one delivered beat."""
    return split_beats(short["voiceover"]) + ([short["end_line"]] if short["end_line"] else [])


def score_script(text, niche, rules, label="", beats=None):
    beats_text = beats or split_beats(text)
    if not beats_text:
        raise ValueError("No sentences found in the script.")
    wps = rules["pace_words_per_second"]
    window_words = max(1, round(rules["hook_window_seconds"] * wps))
    terms = subject_terms(niche)

    # Timestamps from measured narration pace.
    t, timed = 0.0, []
    for b in beats_text:
        dur = len(b.split()) / wps
        timed.append((b, round(t, 1), round(t + dur, 1)))
        t += dur
    total_s = round(t, 1)

    beats, killers = [], []
    hr, br, er = rules["hook_rubric"], rules["beat_rubric"], rules["ending_rubric"]
    hook_text = beats_text[0]
    hook_low = hook_text.lower()
    first_words = " ".join(hook_text.split()[:window_words])

    # ---- Beat 1: the hook (swipe-away) ----
    comp, issues = {}, []
    win_strength, win_cues = open_strength(first_words)
    if not win_cues and re.match(r"^(this is|there's|there are|when)\b", first_words.lower()):
        win_strength, win_cues = 0.6, ["opens on a reveal ('this is…')"]
    comp["promise_in_window"] = round(hr["promise_in_window"]["points"] * win_strength)
    if win_strength < 1:
        issues.append({
            "mode": "No promise in the first 2 seconds",
            "detail": f"The first {window_words} words (~{rules['hook_window_seconds']:.0f}s) are "
                      f"“{first_words}”. " + ("They only partly promise a payoff."
                                                       if win_strength else "They promise nothing yet."),
            "fix": "Lead with the outcome. Put the question, the threat or the superlative in the first "
                   f"{window_words} words. Niche pattern that does this: "
                   f"“{niche['hook_templates'][0]}”",
            "signal": "swipe_away"})

    subj = next((s for s in terms if s in hook_low), None)
    if not subj:
        subj_m = re.search(r"\b([A-Z][a-z]+(?:\s[A-Z][\w*]*)+)", hook_text[1:])
        subj = subj_m.group(1) if subj_m else None
    comp["subject_in_hook"] = hr["subject_in_hook"]["points"] if subj else 0
    if not subj:
        issues.append({
            "mode": "Subject missing from hook",
            "detail": "The hook never says what the video is about.",
            "fix": "Name the object in the hook sentence, e.g. one of: "
                   + ", ".join(niche["title_keywords"][:5]) + ".",
            "signal": "swipe_away"})

    setup = re.match(SETUP_OPENERS, hook_low)
    comp["no_setup_opener"] = 0 if setup else hr["no_setup_opener"]["points"]
    if setup:
        issues.append({
            "mode": "Context before the hook",
            "detail": f"Opens on “{setup.group(0)}” — setup, not outcome.",
            "fix": f"Delete “{setup.group(0)}” and start on the result. "
                   "Background can follow in beat 2 if it earns its place.",
            "signal": "swipe_away"})

    n_hook = len(hook_text.split())
    maxw = hr["hook_brevity"]["max_words"]
    brev = 1.0 if n_hook <= maxw else max(0.0, 1 - (n_hook - maxw) / 10)
    comp["hook_brevity"] = round(hr["hook_brevity"]["points"] * brev)
    if brev < 1:
        issues.append({
            "mode": "Hook too long",
            "detail": f"Hook is {n_hook} words (~{n_hook / wps:.1f}s).",
            "fix": f"Cut it to {maxw} words or fewer; move the explanation into beat 2.",
            "signal": "swipe_away"})

    hook_failed = bool(setup or win_strength == 0)
    if hook_failed:
        killers.append({"id": "context_before_hook",
                        "detail": f"First 2s: “{first_words}”",
                        "beats": [1]})

    beats.append({"n": 1, "role": "hook", "text": hook_text,
                  "start": timed[0][1], "end": timed[0][2],
                  "score": min(100, sum(comp.values())), "components": comp,
                  "issues": issues,
                  "notes": [f"First 2s: “{first_words}”"] + ([f"Subject: {subj}"] if subj else [])})

    # ---- Body beats (average % viewed) ----
    any_open = win_strength > 0 or bool(find(STRONG_OPEN, hook_text))
    last = len(beats_text) - 1
    for i in range(1, last if last > 0 else 1):
        if i >= len(beats_text) or i == last:
            break
        text = beats_text[i]
        nxt = beats_text[i + 1] if i + 1 < len(beats_text) else None
        o, o_why = open_strength(text)
        c, c_why = close_strength(text, any_open)
        k, k_why = carry_strength(text, nxt)
        any_open = any_open or o > 0
        comp = {"opens_loop": round(br["opens_loop"]["points"] * o),
                "closes_loop": round(br["closes_loop"]["points"] * c),
                "carry": round(br["carry"]["points"] * k)}
        issues = []
        if o < 0.5:
            issues.append({
                "mode": "Opens nothing",
                "detail": "This beat only delivers; it gives no new question or stake.",
                "fix": "Add the consequence that isn't explained yet — what this means for the viewer, "
                       "or what happens next — so the beat leaves something open.",
                "signal": "avg_pct_viewed"})
        if c < 0.5:
            issues.append({
                "mode": "Pays nothing off",
                "detail": "No number, name or cause lands here, so the earlier promise isn't being kept.",
                "fix": "Give one concrete payoff in this beat: a number, a named object, or the cause.",
                "signal": "avg_pct_viewed"})
        if k < 0.5 and nxt is not None:
            issues.append({
                "mode": "No reason to keep watching",
                "detail": f"Nothing pulls into the next beat (“{quote(nxt, 6)}”).",
                "fix": "End this beat on the unanswered part, or open the next one with an escalation "
                       "('Then…', 'But…', 'Within a year…').",
                "signal": "avg_pct_viewed"})
        buried = re.match(SECOND_HOOK, text.lower()) or \
            (find(STRONG_OPEN, text) and re.search(r"\b(most|deadliest|largest|biggest)\b", text.lower()))
        if hook_failed and buried and not any(k.get("buried_at") for k in killers):
            for k in killers:
                if k["id"] == "context_before_hook":
                    k["buried_at"] = i + 1
                    k["beats"].append(i + 1)
                    k["detail"] += (f". The real hook is beat {i + 1} at {timed[i][1]}s: "
                                    f"\u201c{quote(text)}\u201d — move it to the front.")
        elif re.search(PIVOTS, text.lower()) or (i >= 2 and re.match(SECOND_HOOK, text.lower())):
            killers.append({"id": "two_ideas", "beats": [i + 1],
                            "detail": f"Beat {i + 1} starts a new thread: “{quote(text)}”"})
        beats.append({"n": i + 1, "role": "body", "text": text,
                      "start": timed[i][1], "end": timed[i][2],
                      "score": min(100, sum(comp.values())), "components": comp,
                      "issues": issues,
                      "notes": [r for r in o_why + c_why + k_why]})

    # ---- Last beat: the ending (replays) ----
    if last > 0:
        text = beats_text[last]
        low = text.lower()
        overlap = (content_words(text) & content_words(hook_text))
        loop = 1.0 if overlap else (0.5 if re.search(CALLBACK, low) else 0.0)
        o, o_why = open_strength(text)
        turn = 1.0 if (o >= 1 or re.search(CALLBACK, low)) else (0.6 if o > 0 else 0.3)
        outro = re.search(OUTRO, low)
        comp = {"loops_to_hook": round(er["loops_to_hook"]["points"] * loop),
                "lands_new_turn": round(er["lands_new_turn"]["points"] * turn),
                "no_outro": 0 if outro else er["no_outro"]["points"]}
        issues = []
        hook_key = ", ".join(sorted(content_words(hook_text))[:4])
        if loop < 1:
            issues.append({
                "mode": "Doesn't loop to the hook",
                "detail": "The last line shares no key word with the hook"
                          + (" (only a callback word)." if loop else "."),
                "fix": f"Echo the hook's subject (hook words: {hook_key}) so the cut back to frame 1 "
                       "reads as one continuous sentence and invites a rewatch.",
                "signal": "replays"})
        if turn < 0.6:
            issues.append({
                "mode": "Ends on a restated fact",
                "detail": "The final beat adds no last turn.",
                "fix": "Finish on an implication the viewer hadn't considered — 'it's already happening', "
                       "'you're inside it right now'.",
                "signal": "avg_pct_viewed"})
        if outro:
            issues.append({
                "mode": "Outro breaks the loop",
                "detail": f"“{outro.group(0)}” tells the viewer the video is over.",
                "fix": "Delete it. The subscribe ask belongs in the description.",
                "signal": "replays"})
        if loop == 0 and turn < 1:
            killers.append({"id": "flat_ending", "beats": [last + 1],
                            "detail": f"Ends on “{quote(text)}” with no loop back."})
        beats.append({"n": last + 1, "role": "ending", "text": text,
                      "start": timed[last][1], "end": timed[last][2],
                      "score": min(100, sum(comp.values())), "components": comp,
                      "issues": issues,
                      "notes": ([f"Echoes hook: {', '.join(sorted(overlap))}"] if overlap else []) + o_why})

    # ---- Mid-script lulls ----
    body = [b for b in beats if b["role"] == "body"]
    run = []
    for b in body:
        weak = b["components"]["opens_loop"] < br["opens_loop"]["points"] * 0.5 and \
            b["components"]["carry"] < br["carry"]["points"] * 0.5
        run = run + [b["n"]] if weak else []
        if len(run) == 2:
            killers.append({"id": "mid_lull", "beats": list(run),
                            "detail": f"Beats {run[0]}–{run[1]} "
                                      f"({beats[run[0] - 1]['start']}s–{beats[run[1] - 1]['end']}s) "
                                      "promise nothing new."})
            run = []

    lk = rules["killers"]["length"]
    if total_s < lk["min_s"] or total_s > lk["max_s"]:
        killers.append({"id": "length", "beats": [],
                        "detail": f"Runs ~{total_s}s at the measured pace; target {lk['min_s']}–{lk['max_s']}s."})

    merged = {}
    for k in killers:
        if k["id"] in merged:
            m = merged[k["id"]]
            m["beats"] += k["beats"]
            m["detail"] += " " + k["detail"]
        else:
            merged[k["id"]] = k
    killers = list(merged.values())

    # Killers also show up on the beats they hit.
    for k in killers:
        meta = rules["killers"][k["id"]]
        k.update(name=meta["name"], penalty=meta["penalty"], signal=meta["signal"])
        for n in k["beats"]:
            b = beats[n - 1]
            if k["id"] == "context_before_hook" and n == k.get("buried_at"):
                b["issues"].append({"mode": "Buried hook",
                                    "detail": f"This is the strongest opener in the script, but it lands at {b['start']}s.",
                                    "fix": "Make this the first sentence and cut what came before it.",
                                    "signal": "swipe_away"})
            elif not any(i["mode"] == meta["name"] for i in b["issues"]) and k["id"] != "context_before_hook":
                b["issues"].append({"mode": meta["name"], "detail": k["detail"],
                                    "fix": KILLER_FIX[k["id"]], "signal": meta["signal"]})

    sw = rules["section_weights"]
    hook_s = beats[0]["score"]
    body_s = round(sum(b["score"] for b in body) / len(body)) if body else hook_s
    end_s = beats[-1]["score"] if last > 0 else hook_s
    raw = sw["hook"] * hook_s + sw["body"] * body_s + sw["ending"] * end_s
    penalty = sum(k["penalty"] for k in killers)
    overall = max(0, min(100, round(raw - penalty)))

    thr = rules["rewrite_threshold"]
    for b in beats:
        b["needs_rewrite"] = b["score"] < thr
        if not b["issues"]:
            b["verdict"] = "Holds. Nothing to fix."

    return {
        "label": label,
        "overall": overall,
        "sections": {"hook": hook_s, "body": body_s, "ending": end_s},
        "penalty": penalty,
        "duration_s": total_s,
        "words": sum(len(b.split()) for b in beats_text),
        "pace_wps": wps,
        "threshold": thr,
        "killers": killers,
        "beats": beats,
        "weakest": min(beats, key=lambda b: b["score"])["n"],
        "rules_version": rules["version"],
        "calibrated_on_videos": rules["calibrated_on_videos"],
    }


KILLER_FIX = {
    "two_ideas": "Cut the second thread or save it for its own Short. One video, one payoff.",
    "flat_ending": "Rewrite the last line so it hands back to the hook's first words.",
    "mid_lull": "Merge these beats, or make the second one escalate (a bigger number, a worse consequence).",
    "length": "Trim to one fact plus one reveal; cut the weakest beat first.",
    "context_before_hook": "Open on the outcome.",
}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--doc-short", type=int, help="Score Short N from the production doc")
    src.add_argument("--doc-all", action="store_true", help="Score every Short in the doc")
    src.add_argument("--file", help="Plain-text script file")
    src.add_argument("--text", help="Script text")
    ap.add_argument("--doc", default=DEFAULT_DOC)
    ap.add_argument("--niche", help="Niche config (default tools/niche.json)")
    ap.add_argument("--json", help="Write the full result as JSON here")
    ap.add_argument("--html", help="Render the Artifact page here")
    args = ap.parse_args()

    niche, rules = load_niche(args.niche), load_rules()
    results = []
    if args.doc_short or args.doc_all:
        shorts = load_doc_shorts(args.doc)
        if args.doc_short:
            shorts = [s for s in shorts if s["num"] == args.doc_short]
            if not shorts:
                sys.exit(f"No Short #{args.doc_short} in {args.doc}.")
        for s in shorts:
            r = score_script("", niche, rules, label=f"#{s['num']} {s['title']}", beats=doc_beats(s))
            r["source"] = {"doc": os.path.relpath(args.doc, ROOT), **s}
            results.append(r)
    else:
        text = open(args.file, encoding="utf-8").read() if args.file else args.text
        results.append(score_script(text, niche, rules, label="Draft"))

    for r in results:
        flags = ", ".join(k["name"] for k in r["killers"]) or "none"
        print(f"{r['overall']:>3}  {r['label'][:44]:<44} hook {r['sections']['hook']:>3} "
              f"body {r['sections']['body']:>3} end {r['sections']['ending']:>3}  "
              f"{r['duration_s']:>4}s  killers: {flags}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(results if len(results) > 1 else results[0], f, indent=2, ensure_ascii=False)
    if args.html:
        from algorithm_killer_page import render
        with open(args.html, "w", encoding="utf-8") as f:
            f.write(render(results, niche, rules))


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main()
