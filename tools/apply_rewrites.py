#!/usr/bin/env python3
"""
apply_rewrites.py — write accepted Algorithm Killer fixes into the production
doc (docs/IMAGE_PROMPTS_FLUX_COSMIC.md) and, optionally, the phone deck HTML.

Only proposals that pass tools/rewrite.py are applied; a rejected one stops
the run. Applying twice is safe: fields are set, not appended.

    python tools/apply_rewrites.py                       # doc only
    python tools/apply_rewrites.py --deck in.html out.html
"""

import argparse
import glob
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import retention_score as rs  # noqa: E402
import rewrite  # noqa: E402

DOC = rs.DEFAULT_DOC


def load_props():
    props = {}
    for path in sorted(glob.glob(os.path.join(HERE, "rewrites", "*.json"))):
        with open(path, encoding="utf-8") as f:
            p = json.load(f)
        if "short" in p:
            props[p["short"]] = p
    return props


def revised(short, prop):
    """The Short's fields after its accepted fixes."""
    beats = prop["original"]["beats"]
    by = {r["beat"]: r for r in prop.get("rewrites", [])}
    new = []
    for i, b in enumerate(beats, 1):
        t = by[i]["after"] if i in by else b
        if t:
            new.append(t)
    pk = prop.get("packaging", {})
    shots = {s["replaces"]: s["prompt"] for s in prop.get("shots", []) if s.get("replaces")}
    return {"hook": new[0], "voiceover": " ".join(new[:-1]), "end_line": new[-1],
            "end_changed": len(beats) in by, "body_changed": any(n < len(beats) for n in by),
            "hook_changed": 1 in by,
            "title": pk.get("title"), "description": pk.get("description"), "onscreen": pk.get("onscreen"),
            "shots": shots}


def apply_doc(props, niche, rules, path=DOC):
    with open(path, encoding="utf-8") as f:
        md = f.read()
    shorts = {s["num"]: s for s in rs.load_doc_shorts(path)}
    out = {}
    for num, prop in props.items():
        if "original" not in prop:   # freeze the pre-fix script once, before the doc changes
            short = shorts[num]
            sec0 = re.search(rf"^## {num} — .*?(?=^## |\Z)", md, re.S | re.M).group(0)
            grab = lambda k: (re.search(rf"^\*\*{k}:\*\*\s*`?(.+?)`?\s*$", sec0, re.M) or [None, ""])[1].strip()
            prop["original"] = {
                "beats": rs.doc_beats(short), "title": grab("Title"), "description": grab("Description"),
                "onscreen": grab("On-screen"),
                "shot1": (re.search(r"\*\*Shot 1\*\*\n```\n(.*?)\n```", sec0, re.S) or [None, ""])[1]}
            fn = os.path.join(HERE, "rewrites", f"cosmic-{num:02d}.json")
            with open(fn, "w", encoding="utf-8") as f:
                json.dump(prop, f, indent=2, ensure_ascii=False)
                f.write("\n")
        res = rewrite.run(prop, niche, rules)
        if not res["rewrite"]["all_accepted"]:
            raise SystemExit(f"#{num} has a rejected fix; not applying anything.")
        r = revised(shorts[num], prop)
        out[num] = r
        m = re.search(rf"^## {num} — .*?(?=^## |\Z)", md, re.S | re.M)
        sec = m.group(0)
        new = sec
        if r["hook_changed"]:
            new = re.sub(r"^\*\*Hook:\*\* .*$", lambda _: f"**Hook:** {r['hook']}", new, flags=re.M)
        if r["onscreen"]:
            new = re.sub(r"^\*\*On-screen:\*\* .*$", lambda _: f"**On-screen:** `{r['onscreen']}`", new, flags=re.M)
        if r["body_changed"] or r["hook_changed"]:
            new = re.sub(r"^> .*$", lambda _: f"> {r['voiceover']}", new, count=1, flags=re.M)
        if r["end_changed"]:
            new = re.sub(r"^\*\*End line:\*\* .*$", lambda _: f"**End line:** {r['end_line']}", new, flags=re.M)
        if r["title"]:
            new = re.sub(r"^\*\*Title:\*\* .*$", lambda _: f"**Title:** {r['title']}", new, flags=re.M)
        if r["description"]:
            new = re.sub(r"^\*\*Description:\*\* .*$", lambda _: f"**Description:** {r['description']}", new, flags=re.M)
        for name, prompt in r["shots"].items():
            n = name.split()[-1]
            new = re.sub(rf"(\*\*Shot {n}\*\*\n```\n).*?(\n```)", lambda mm: mm.group(1) + prompt + mm.group(2),
                         new, count=1, flags=re.S)
        note = (f"*Revised 2026-10-01: checked against the channel's hard rules and the retention "
                f"scorer. Reasons and sources: `tools/rewrites/cosmic-{num:02d}.json`.*\n\n")
        if "*Revised 2026-10-01" not in new:
            new = re.sub(r"(^## .*?\n\n)", lambda mm: mm.group(1) + note, new, count=1, flags=re.S)
        md = md.replace(sec, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(md)
    return out


def apply_deck(src, dst, path=DOC):
    """Rewrite each deck card's fields from the (already updated) doc."""
    with open(src, encoding="utf-8") as f:
        page = f.read()
    with open(path, encoding="utf-8") as f:
        md = f.read()
    e = lambda t: html.escape(t, quote=True)

    def field(label, text, mono=False):
        return (f'  <div class="field"><div class="flabel">{label}<button class="copy" type="button" '
                f'data-copy="{e(text)}">Copy</button></div><div class="fval{" mono" if mono else ""}">{e(text)}</div></div>\n')

    for s in rs.load_doc_shorts(path):
        num = s["num"]
        sec = re.search(rf"^## {num} — .*?(?=^## |\Z)", md, re.S | re.M).group(0)
        get = lambda k: re.search(rf"^\*\*{k}:\*\*\s*`?(.+?)`?\s*$", sec, re.M).group(1).strip()
        shots = re.findall(r"\*\*Shot (\d+)\*\*\n```\n(.*?)\n```", sec, re.S)
        body = (field("Hook · 0–2s", get("Hook")) + field("On-screen text", get("On-screen"), True)
                + field("Voiceover", s["voiceover"]) + field("End line · loops to the hook", s["end_line"])
                + f'  <div class="flabel section">{len(shots)} shots · paste into any image generator</div>\n  '
                + "".join(f'<div class="shot"><div class="shead"><span class="snum">SHOT {n}</span><span class="sacc"></span>'
                          f'<button class="copy" type="button" data-copy="{e(p)}">Copy</button></div>'
                          f'<div class="prompt">{e(p)}</div></div>' for n, p in shots)
                + "\n" + field("Title", get("Title")) + field("Description", get("Description")))
        page, n = re.subn(rf'(<div class="body" id="b{num}" hidden>\n).*?(</div></article>)',
                          lambda mm: mm.group(1) + body + mm.group(2), page, count=1, flags=re.S)
        if n != 1:
            raise SystemExit(f"Card {num} not found in the deck.")
    with open(dst, "w", encoding="utf-8") as f:
        f.write(page)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", nargs=2, metavar=("IN", "OUT"))
    a = ap.parse_args()
    out = apply_doc(load_props(), rs.load_niche(), rs.load_rules())
    print("Doc updated:", ", ".join(f"#{n}" for n in sorted(out)))
    if a.deck:
        apply_deck(*a.deck)
        print("Deck written:", a.deck[1])


if __name__ == "__main__":
    main()
