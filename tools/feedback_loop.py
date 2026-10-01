#!/usr/bin/env python3
"""
feedback_loop.py — Algorithm Killer, Component 4: check the scorer against the
channel's real numbers, and recalibrate it.

Every score the other components give is a prediction. This file stores each
published Short's prediction next to what actually happened, reports which
rules the channel's own data supports or contradicts, and — once there are
enough videos — adjusts the weights in retention_rules.json.

The ledger lives in data/feedback_ledger.json and is committed to the repo:
the cloud container is temporary, so git is where the channel's history
survives. Commit and push after every change.

Where the numbers come from (Claude runs all of this; the owner never does):
  * Retention — vidIQ `vidiq_channel_analytics` (averageViewPercentage,
    engagedViews), saved to a file and loaded with `ingest-vidiq`.
  * Viewed vs swiped away — only in YouTube Studio. The owner reads it off
    the Studio app and pastes it in chat; Claude stores it with `record`.
  * Views, likes, comments — the YouTube Data API via `fetch-public`.

Usage:
    python tools/feedback_loop.py register --short 1 --video-id abc123 --published 2026-10-20
    python tools/feedback_loop.py record --video-id abc123 --apv 71.5 --viewed-pct 64 --source studio
    python tools/feedback_loop.py ingest-vidiq vidiq_output.json
    python tools/feedback_loop.py fetch-public
    python tools/feedback_loop.py report            # rule-by-rule drift
    python tools/feedback_loop.py calibrate [--apply]
"""

import argparse
import copy
import datetime as dt
import json
import math
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
LEDGER = os.path.join(ROOT, "data", "feedback_ledger.json")
RULES = os.path.join(HERE, "retention_rules.json")
HISTORY = os.path.join(ROOT, "data", "rules_history")


def _read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)

# Thresholds. All inference: small channels are noisy, so the loop reports
# early and changes weights late.
MATURE_DAYS = 7          # Shorts numbers settle over the first week
MIN_REPORT = 8           # videos before any rule gets a verdict
MIN_GROUP = 3            # videos needed on each side of a rule (pass / fail)
MIN_CALIBRATE = 20       # videos before weights change
T_CLEAR = 2.0            # |Welch t| for 'supported' / 'contradicted'
PRIOR_STRENGTH = 20      # shrinkage: a weight moves n/(n+20) of the way


# --- Ledger ------------------------------------------------------------------

def empty_ledger():
    return {"_about": "Predictions vs real performance for published Shorts. "
                      "Written by tools/feedback_loop.py. Commit after every change.",
            "videos": [], "calibrations": [], "sources": {}}


def load_ledger(path=LEDGER):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return empty_ledger()


def save_ledger(led, path=LEDGER):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(led, f, indent=2, ensure_ascii=False)
        f.write("\n")


def today():
    return dt.date.today().isoformat()


# --- Features: what the scorer predicted, as pass/fail per rule -------------

def features_from(result, packaging=None):
    """Turn a retention result (and optional packaging result) into named
    pass/fail features. 'Pass' is what the scorer says is good."""
    rules = result.get("_rules") or _read_json(RULES)
    f = {}
    hook = result["beats"][0]["components"]
    for k, meta in rules["hook_rubric"].items():
        f[f"hook_rubric.{k}"] = hook.get(k, 0) >= meta["points"]
    end = result["beats"][-1]["components"] if result["beats"][-1]["role"] == "ending" else {}
    for k, meta in rules["ending_rubric"].items():
        if k in end:
            f[f"ending_rubric.{k}"] = end[k] >= meta["points"]
    body = [b for b in result["beats"] if b["role"] == "body"]
    for k, meta in rules["beat_rubric"].items():
        if body:
            share = sum(b["components"].get(k, 0) >= meta["points"] / 2 for b in body) / len(body)
            f[f"beat_rubric.{k}"] = share >= 0.5
    fired = {k["id"] for k in result["killers"]}
    for k in rules["killers"]:
        f[f"killers.{k}"] = k not in fired          # pass = killer absent
    if packaging:
        for area, checks in packaging["checks"].items():
            for c in checks:
                f[f"packaging.{area}.{c['name']}"] = bool(c["ok"])
    return f


def outcome_for(feature):
    """Which real number tests a rule. Hook and packaging decide the swipe, so
    they're tested against viewed-vs-swiped-away when the owner has supplied
    it; everything else against average percentage viewed."""
    if feature.startswith(("hook_rubric.", "packaging.", "killers.context_before_hook")):
        return ("viewed_pct", "avg_view_pct")
    return ("avg_view_pct",)


SIGNAL_OF = {"viewed_pct": "Viewed vs swiped away", "avg_view_pct": "Average percentage viewed"}


# --- Register / record -------------------------------------------------------

def predict_for_short(num, version="rewrite"):
    import retention_score as rs
    import optimize_metadata as om
    niche, rules = rs.load_niche(), rs.load_rules()
    s = next((x for x in rs.load_doc_shorts() if x["num"] == num), None)
    if not s:
        raise SystemExit(f"No Short #{num} in the doc.")
    prop_path = os.path.join(HERE, "rewrites", f"cosmic-{num:02d}.json")
    used = "original"
    if version == "rewrite" and os.path.exists(prop_path):
        import rewrite
        result = rewrite.run(_read_json(prop_path), niche, rules)
        pack = om.packaging_for_short(num)
        used = "rewrite"
    else:
        result = rs.score_script("", niche, rules, label=f"#{num} {s['title']}", beats=rs.doc_beats(s))
        pack = om.packaging_for_short(num, use_proposal=False)
    return result, pack, used


def snapshot(result, pack, rules):
    return {
        "rules_version": rules["version"],
        "overall": result["overall"],
        "sections": result["sections"],
        "killers": [k["id"] for k in result["killers"]],
        "duration_s": result["duration_s"],
        "words": result["words"],
        "packaging_overall": pack["overall"] if pack else None,
        "features": features_from(result, pack),
    }


def register(led, video_id, short=None, text=None, published=None, version="rewrite", label=None):
    import retention_score as rs
    if any(v["video_id"] == video_id for v in led["videos"]):
        raise SystemExit(f"{video_id} is already registered.")
    rules = rs.load_rules()
    if short:
        result, pack, used = predict_for_short(short, version)
        beats = [b["text"] for b in result["beats"]]
    else:
        result = rs.score_script(text, rs.load_niche(), rules, label=label or "Draft")
        pack, used, beats = None, "draft", [b["text"] for b in result["beats"]]
    led["videos"].append({
        "video_id": video_id, "short": short, "label": label or result["label"],
        "version": used, "published": published, "registered": today(),
        "script_beats": beats, "prediction": snapshot(result, pack, rules), "actuals": []})
    return led["videos"][-1]


def record(led, video_id, source, as_of=None, **metrics):
    v = next((x for x in led["videos"] if x["video_id"] == video_id), None)
    if not v:
        raise SystemExit(f"{video_id} isn't registered. Register it with its Short first.")
    row = {"as_of": as_of or today(), "source": source}
    row.update({k: m for k, m in metrics.items() if m is not None})
    v["actuals"].append(row)
    return row


def ingest_vidiq(led, payload, as_of=None):
    """Load a vidiq_channel_analytics response with dimensions=['video'].
    Accepts the YouTube Analytics shape (columnHeaders + rows) or a list of
    dicts. Untested against a live vidIQ response until credits allow a call."""
    names = {"averageViewPercentage": "avg_view_pct", "averageViewDuration": "avg_view_duration_s",
             "engagedViews": "engaged_views", "views": "views", "likes": "likes", "comments": "comments"}
    rows = []
    data = payload.get("data", payload) if isinstance(payload, dict) else payload
    if isinstance(data, dict) and "columnHeaders" in data:
        cols = [c["name"] for c in data["columnHeaders"]]
        rows = [dict(zip(cols, r)) for r in data.get("rows", [])]
    elif isinstance(data, dict) and isinstance(data.get("rows"), list):
        rows = data["rows"]
    elif isinstance(data, list):
        rows = data
    done = []
    for r in rows:
        vid = r.get("video") or r.get("videoId")
        if vid and any(v["video_id"] == vid for v in led["videos"]):
            record(led, vid, "vidiq", as_of, **{names[k]: r[k] for k in names if k in r})
            done.append(vid)
    return done


def fetch_public(led):
    """Views, likes, comments and real duration from the YouTube Data API."""
    import analyze_channel as ac
    ids = [v["video_id"] for v in led["videos"]]
    status = {"tested": today()}
    if not ids:
        status["result"] = "Nothing registered yet."
        led["sources"]["data_api"] = status
        return []
    try:
        vids = ac.fetch_videos(ids, os.environ.get("YOUTUBE_API_KEY"))
    except ac.YouTubeAPIError as e:
        status["result"] = str(e)
        led["sources"]["data_api"] = status
        raise
    for x in vids:
        record(led, x["id"], "data_api", views=x["views"], likes=x["likes"],
               comments=x["comments"], duration_s=x["duration_s"])
    status["result"] = f"OK: {len(vids)} videos"
    led["sources"]["data_api"] = status
    return vids


# --- Analysis ----------------------------------------------------------------

def latest(v, key):
    for a in reversed(v["actuals"]):
        if a.get(key) is not None:
            return a[key]
    return None


def mature(v, on=None):
    if not v.get("published"):
        return False
    age = (dt.date.fromisoformat(on or today()) - dt.date.fromisoformat(v["published"])).days
    return age >= MATURE_DAYS


def welch_t(a, b):
    if len(a) < 2 or len(b) < 2:
        return 0.0
    va, vb = statistics.variance(a), statistics.variance(b)
    se = math.sqrt(va / len(a) + vb / len(b))
    return (statistics.mean(a) - statistics.mean(b)) / se if se else 0.0


def spearman(x, y):
    if len(x) < 3:
        return None
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    rx, ry = ranks(x), ranks(y)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return round(num / den, 2) if den else None


def report(led, on=None):
    vids = [v for v in led["videos"] if mature(v, on)]
    usable = [v for v in vids if latest(v, "avg_view_pct") is not None]
    out = {"registered": len(led["videos"]), "mature": len(vids), "with_retention": len(usable),
           "min_report": MIN_REPORT, "min_calibrate": MIN_CALIBRATE, "mature_days": MATURE_DAYS,
           "sources": led.get("sources", {}), "rules": [], "overall": None, "pace": None,
           "calibrations": led.get("calibrations", [])}
    if usable:
        pred = [v["prediction"]["overall"] for v in usable]
        act = [latest(v, "avg_view_pct") for v in usable]
        out["overall"] = {"n": len(usable), "spearman": spearman(pred, act),
                          "pairs": [{"label": v["label"], "predicted": p, "apv": a}
                                    for v, p, a in zip(usable, pred, act)]}
    paces = [v["prediction"]["words"] / latest(v, "duration_s") for v in vids
             if latest(v, "duration_s")]
    if paces:
        out["pace"] = {"n": len(paces), "measured_wps": round(statistics.median(paces), 2)}

    names = sorted({k for v in led["videos"] for k in v["prediction"]["features"]})
    for name in names:
        metric = None
        for m in outcome_for(name):
            if sum(latest(v, m) is not None for v in vids) >= 1:
                metric = m
                break
        metric = metric or "avg_view_pct"
        rows = [(v["prediction"]["features"].get(name), latest(v, metric)) for v in vids]
        rows = [(p, a) for p, a in rows if p is not None and a is not None]
        passed = [a for p, a in rows if p]
        failed = [a for p, a in rows if not p]
        item = {"rule": name, "metric": metric, "signal": SIGNAL_OF[metric], "n": len(rows),
                "n_pass": len(passed), "n_fail": len(failed)}
        if len(rows) < MIN_REPORT or min(len(passed), len(failed)) < MIN_GROUP:
            need = []
            if len(rows) < MIN_REPORT:
                need.append(f"{MIN_REPORT - len(rows)} more videos")
            if min(len(passed), len(failed)) < MIN_GROUP:
                side = "breaking" if len(failed) < len(passed) else "following"
                need.append(f"at least {MIN_GROUP} videos {side} the rule")
            item.update(verdict="not enough data", detail="Needs " + " and ".join(need) + ".")
        else:
            diff = statistics.mean(passed) - statistics.mean(failed)
            t = welch_t(passed, failed)
            item.update(mean_pass=round(statistics.mean(passed), 1), mean_fail=round(statistics.mean(failed), 1),
                        diff=round(diff, 1), t=round(t, 2))
            if t >= T_CLEAR:
                item["verdict"] = "supported"
            elif t <= -T_CLEAR:
                item["verdict"] = "contradicted"
            else:
                item["verdict"] = "no clear effect"
            item["detail"] = (f"Videos that pass: {item['mean_pass']}% vs {item['mean_fail']}% "
                              f"({'+' if diff >= 0 else ''}{item['diff']} points, t={item['t']}).")
        out["rules"].append(item)
    return out


# --- Simulation (tests and the page's labelled preview only) ---------------

PROMISE, LOOP, CARRY = "hook_rubric.promise_in_window", "ending_rubric.loops_to_hook", "beat_rubric.carry"


def simulate(n, seed=7):
    """A made-up channel of n mature videos with planted effects: passing the
    hook promise adds 12 points of retention, looping to the hook costs 9,
    carry does nothing. Never written to the real ledger."""
    import random
    import retention_score as rs
    rnd = random.Random(seed)
    shorts = rs.load_doc_shorts()
    niche, rules = rs.load_niche(), rs.load_rules()
    led = empty_ledger()
    for i in range(n):
        s = shorts[i % len(shorts)]
        result = rs.score_script("", niche, rules, beats=rs.doc_beats(s))
        feats = features_from(result)
        feats[PROMISE] = i % 2 == 0
        feats[LOOP] = i % 3 != 0
        feats[CARRY] = rnd.random() < 0.5
        apv = 55 + (12 if feats[PROMISE] else 0) - (9 if feats[LOOP] else 0) + rnd.gauss(0, 4)
        led["videos"].append({
            "video_id": f"sim{i}", "short": s["num"], "label": f"sim {i}", "version": "original",
            "published": "2026-01-01", "registered": "2026-01-01", "script_beats": rs.doc_beats(s),
            "prediction": {"overall": result["overall"], "features": feats, "words": result["words"],
                           "duration_s": result["duration_s"], "rules_version": 1},
            "actuals": [{"as_of": "2026-02-01", "source": "simulated", "avg_view_pct": round(apv, 1),
                         "duration_s": round(result["words"] / 2.3, 1)}]})
    return led


# --- Calibration -------------------------------------------------------------

def propose(led, rules, on=None):
    """New weights from the report. Only retention rules (packaging checks are
    reported, not reweighted). Moves are shrunk toward the prior and capped."""
    rep = report(led, on)
    n = rep["with_retention"]
    new = copy.deepcopy(rules)
    changes = []
    if n < MIN_CALIBRATE:
        return new, changes, rep, f"Needs {MIN_CALIBRATE} videos with retention; has {n}."
    shrink = n / (n + PRIOR_STRENGTH)
    for item in rep["rules"]:
        if item["verdict"] not in ("supported", "contradicted"):
            continue
        group, _, key = item["rule"].partition(".")
        if group not in ("hook_rubric", "beat_rubric", "ending_rubric", "killers") or key not in new[group]:
            continue
        factor = 1 + 0.5 * shrink * max(-1.0, min(1.0, item["t"] / 4))
        field = "penalty" if group == "killers" else "points"
        old = new[group][key][field]
        new[group][key][field] = round(old * factor, 1)
        changes.append({"rule": item["rule"], "from": old, "to": new[group][key][field],
                        "why": item["detail"]})
    for group in ("hook_rubric", "beat_rubric", "ending_rubric"):   # keep each rubric out of 100
        total = sum(v["points"] for v in new[group].values() if isinstance(v, dict))
        for v in new[group].values():
            if isinstance(v, dict):
                v["points"] = round(v["points"] * 100 / total, 1)
    for c in changes:   # report the final, renormalised value
        group, _, key = c["rule"].partition(".")
        c["to"] = new[group][key]["penalty" if group == "killers" else "points"]
    if rep["pace"] and rep["pace"]["n"] >= 3:
        old = new["pace_words_per_second"]
        new["pace_words_per_second"] = rep["pace"]["measured_wps"]
        if old != new["pace_words_per_second"]:
            changes.append({"rule": "pace_words_per_second", "from": old,
                            "to": new["pace_words_per_second"],
                            "why": f"Median of {rep['pace']['n']} real Shorts' word counts over their durations."})
    new["version"] = rules["version"] + 1
    new["calibrated_on_videos"] = n
    return new, changes, rep, None


def rescored_spearman(led, rules, on=None):
    """In-sample check: how well each rule set ranks the videos it was fitted on.
    In-sample, so an optimistic number — say so wherever it's shown."""
    import retention_score as rs
    niche = rs.load_niche()
    vids = [v for v in led["videos"] if mature(v, on) and latest(v, "avg_view_pct") is not None]
    pred = [rs.score_script("", niche, rules, beats=v["script_beats"])["overall"] for v in vids]
    return spearman(pred, [latest(v, "avg_view_pct") for v in vids])


def calibrate(led, apply=False, rules_path=RULES, on=None):
    rules = _read_json(rules_path)
    new, changes, rep, blocked = propose(led, rules, on)
    out = {"blocked": blocked, "changes": changes}
    if blocked:
        return out
    out["spearman_before"] = rescored_spearman(led, rules, on)
    out["spearman_after"] = rescored_spearman(led, new, on)
    if apply and changes:
        os.makedirs(HISTORY, exist_ok=True)
        with open(os.path.join(HISTORY, f"v{rules['version']}.json"), "w", encoding="utf-8") as f:
            json.dump(rules, f, indent=2, ensure_ascii=False)
        with open(rules_path, "w", encoding="utf-8") as f:
            json.dump(new, f, indent=2, ensure_ascii=False)
            f.write("\n")
        led["calibrations"].append({"at": today(), "version": new["version"], "n": new["calibrated_on_videos"],
                                    "changes": changes, "spearman_before": out["spearman_before"],
                                    "spearman_after": out["spearman_after"]})
        out["applied"] = True
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("register")
    r.add_argument("--video-id", required=True)
    g = r.add_mutually_exclusive_group(required=True)
    g.add_argument("--short", type=int)
    g.add_argument("--text-file")
    r.add_argument("--published")
    r.add_argument("--version", choices=["rewrite", "original"], default="rewrite")
    r.add_argument("--label")
    rc = sub.add_parser("record")
    rc.add_argument("--video-id", required=True)
    rc.add_argument("--source", required=True, choices=["studio", "vidiq", "data_api"])
    rc.add_argument("--as-of")
    for m in ("apv", "viewed-pct", "views", "engaged-views", "avg-view-duration", "duration"):
        rc.add_argument(f"--{m}", type=float)
    iv = sub.add_parser("ingest-vidiq")
    iv.add_argument("file")
    sub.add_parser("fetch-public")
    rp = sub.add_parser("report")
    rp.add_argument("--json")
    cb = sub.add_parser("calibrate")
    cb.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    led = load_ledger()
    if a.cmd == "register":
        text = open(a.text_file, encoding="utf-8").read() if a.text_file else None
        v = register(led, a.video_id, a.short, text, a.published, a.version, a.label)
        save_ledger(led)
        print(f"Registered {v['video_id']} ({v['label']}, {v['version']}): predicted {v['prediction']['overall']}")
    elif a.cmd == "record":
        row = record(led, a.video_id, a.source, a.as_of, avg_view_pct=a.apv, viewed_pct=a.viewed_pct,
                     views=a.views, engaged_views=a.engaged_views, avg_view_duration_s=a.avg_view_duration,
                     duration_s=a.duration)
        save_ledger(led)
        print("Recorded", row)
    elif a.cmd == "ingest-vidiq":
        done = ingest_vidiq(led, _read_json(a.file))
        save_ledger(led)
        print(f"Ingested {len(done)} videos: {done}")
    elif a.cmd == "fetch-public":
        try:
            vids = fetch_public(led)
            print(f"Fetched {len(vids)} videos.")
        except Exception as e:
            print(e)
        save_ledger(led)
    elif a.cmd == "report":
        rep = report(led)
        if a.json:
            json.dump(rep, open(a.json, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(f"{rep['registered']} registered, {rep['with_retention']} with retention "
              f"(verdicts from {MIN_REPORT}, weight changes from {MIN_CALIBRATE}).")
        for it in rep["rules"]:
            print(f"  {it['verdict']:<16} {it['rule']:<48} {it['detail']}")
    elif a.cmd == "calibrate":
        out = calibrate(led, apply=a.apply)
        if out["blocked"]:
            print(out["blocked"])
        else:
            for c in out["changes"]:
                print(f"  {c['rule']}: {c['from']} → {c['to']}  ({c['why']})")
            print(f"  In-sample rank correlation: {out['spearman_before']} → {out['spearman_after']}")
            if out.get("applied"):
                save_ledger(led)
                print("  Applied. Commit retention_rules.json, data/rules_history and the ledger.")


if __name__ == "__main__":
    main()
