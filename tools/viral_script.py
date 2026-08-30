#!/usr/bin/env python3
"""
viral_script.py — the any-topic viral script generator.

Give it ANY topic — any niche, any video length — and it writes a script
engineered to go viral AND to sound like a human talking to a friend, not a
robot reading a Wikipedia page.

Every script is built from the retention devices that actually keep people
watching, and each beat is labeled with the device it uses so you learn the
craft while you use the tool:

  HOOK            first 1-3 seconds; earns the next 10
  OPEN LOOP       a promise made early, paid off late — the reason they stay
  RE-HOOK         a mid-script pattern reset every ~25s ("wait, it gets worse")
  CURIOSITY GAP   tell them something exists before you tell them what it is
  PAYOFF          the promise, kept — never before the final third
  LOOP / BAIT     the last line loops to the first, or provokes a comment

The voice is conversational by construction: contractions, direct address,
short punchy sentences, asides ("look", "honestly?", "stay with me"). Offline
scripts leave [FILL: ...] slots for the topic-specific facts — every script
ships with its own research checklist. Add --use-claude and the model writes
every word, under strict sound-like-a-human rules (needs ANTHROPIC_API_KEY).

Usage:
    python tools/viral_script.py "why you can't remember being a baby"
    python tools/viral_script.py "the housing market" --length 60s
    python tools/viral_script.py "octopus intelligence" --length 3min -n 3
    python tools/viral_script.py "how to negotiate salary" --style howto
    python tools/viral_script.py "AI taking jobs" --style hottake --ending comment
    python tools/viral_script.py "black holes" --use-claude
    python tools/viral_script.py "topic" --export-md docs/MY_SCRIPT.md
"""

import argparse
import json
import os
import random
import re
import sys

WORDS_PER_SEC = 2.4        # energetic VO pace; ~145 wpm

LENGTHS = {                # name -> seconds
    "15s": 15, "30s": 30, "45s": 45, "60s": 60, "90s": 90,
    "3min": 180, "5min": 300, "8min": 480, "10min": 600,
}

STYLES = ("explain", "storytime", "listicle", "hottake", "howto")

# ---------------------------------------------------------------------------
# Hook bank — the first 1-3 seconds. Each entry: (device, template).
# {topic} slots a noun-ish topic phrase. All written to be said out loud.
# ---------------------------------------------------------------------------
HOOKS = [
    ("curiosity gap", "There's something about {topic} that almost nobody knows — and once you see it, you can't unsee it."),
    ("curiosity gap", "Okay, so {topic} is way weirder than anyone tells you. Like, genuinely weird."),
    ("contrarian", "Everything you've been told about {topic} is basically wrong. Let me explain."),
    ("contrarian", "Hot take: {topic} doesn't work the way you think it does. At all."),
    ("secret", "There's a reason nobody explains {topic} properly. And honestly? Once you know it, everything clicks."),
    ("confession", "I got {topic} completely wrong for years. Here's the thing that finally made it click."),
    ("callout", "You've been thinking about {topic} the wrong way. Don't worry — so was I, until embarrassingly recently."),
    ("stakes", "If {topic} matters to you at all, do not skip this one. I mean it."),
    ("bold claim", "One tiny detail changes the entire story of {topic}. Most people never even notice it."),
    ("question", "Quick question: why does nobody ever explain {topic} like a normal human being? Fine. I'll do it."),
    ("negativity", "The worst part about {topic} isn't what you think it is. It's actually so much stranger."),
    ("in medias res", "So there I was, three hours deep into {topic}, when I found the thing that broke my brain."),
]

# Planted right after the hook on longer videos — the open loop.
OPEN_LOOPS = [
    "And stick around, because at the end I'll tell you the one part that genuinely changed my mind — it is not what you'd expect.",
    "Oh — and there's a twist at the end of this. I'm not going to spoil it, but it recontextualizes everything.",
    "By the end of this, you're going to see {topic} completely differently. I'll prove it.",
    "And the last thing I'm going to show you? That's the one people always clip and share. Wait for it.",
]

# Mid-script pattern resets — dropped between body beats every ~25 seconds.
REHOOKS = [
    "But wait — it actually gets better.",
    "And this is where it gets weird.",
    "Now here's the part nobody talks about.",
    "Stay with me, because this next bit is the whole reason I made this video.",
    "Okay, this next part? This is the good stuff.",
    "And just when you think that's the whole story — nope.",
]

# How the payoff opens — closing the loop that was planted up top.
PAYOFF_OPENERS = [
    "Okay. Here's the part I promised you.",
    "So here's the twist I mentioned at the start.",
    "And now — the thing that changed my mind.",
    "Alright, payoff time. You earned it.",
]

# Endings. Each entry: (device, template).
ENDINGS = {
    "loop": [
        ("loop", "…which brings us right back to where we started. Wild, right? Watch it again — you'll catch what you missed."),
        ("loop", "And THAT is why I said {topic} is not what you think. Told you it'd click."),
    ],
    "comment": [
        ("comment bait", "So — am I crazy, or does that change everything? Tell me in the comments. I actually read them."),
        ("comment bait", "Now I have to know: did you already know this, or did I just ruin {topic} for you too? Comments. Go."),
    ],
    "follow": [
        ("soft CTA", "If {topic} finally makes sense now, you know what to do. I've got more where this came from."),
        ("soft CTA", "And that's the short version. Follow if you want the stuff that didn't fit — because oh, there's more."),
    ],
}

# ---------------------------------------------------------------------------
# Body beat templates per style. [FILL: ...] slots are research checkboxes —
# the topic-specific facts only you (or --use-claude) can supply. The
# connective tissue around them is already written to sound like a person.
# ---------------------------------------------------------------------------
BODY = {
    "explain": [
        ("misconception", "So here's what most people get wrong: [FILL: the common belief about {topic}, in one sentence]. Sounds right, doesn't it? Yeah — it's not."),
        ("mechanism", "What's actually going on is this: [FILL: the real mechanism, in plain words — like you'd explain it to a friend at dinner, zero jargon]."),
        ("proof", "And once you know that, [FILL: a surprising example or real number that only makes sense in light of the mechanism] suddenly makes perfect sense."),
        ("favorite detail", "But honestly? My favorite part is this: [FILL: the weirdest, most counterintuitive detail you found researching {topic}]."),
        ("zoom out", "Now zoom out for a second, because this isn't just about {topic}. [FILL: the bigger pattern or second place this same idea shows up]."),
        ("objection", "And look — if you're thinking [FILL: the obvious objection], fair. I thought that too. Except [FILL: the evidence that answers it]."),
    ],
    "storytime": [
        ("setup", "So it starts like this: [FILL: who, where, when — one line]. Totally normal. Nothing suspicious. Remember that."),
        ("first twist", "Except then [FILL: the first twist — the moment things stop being normal]. And nobody saw it coming."),
        ("escalation", "Now here's where it gets genuinely strange. [FILL: the escalation — the detail that makes this story worth telling]."),
        ("darkest point", "At this point, [FILL: the lowest moment or biggest unknown — make them feel it]. And honestly? It could've ended right there."),
        ("turn", "But then — and I love this part — [FILL: the turn: the discovery, decision, or coincidence that flips everything]."),
        ("aftermath", "The aftermath is its own story: [FILL: what happened after — the consequence people don't hear about]."),
    ],
    "listicle": [],  # generated dynamically — items count DOWN to keep them watching
    "hottake": [
        ("the claim", "Look, I know this is controversial, but I'll just say it: [FILL: your actual claim about {topic}, stated plainly, no hedging]."),
        ("steelman", "'But what about—' I hear you. The strongest case against me is [FILL: the best counterargument, stated fairly — steelman it]."),
        ("rebuttal", "Here's why that doesn't hold up: [FILL: your rebuttal, with the one piece of evidence that does the heavy lifting]."),
        ("receipts", "And it's not just me saying this. [FILL: the stat, study, or example that backs the claim — a real one]."),
        ("concession", "Now, to be fair — [FILL: the one thing the other side gets right]. I'm not pretending that's nothing. But it doesn't change the math."),
        ("so what", "And here's why it actually matters: [FILL: the real-world consequence if people keep getting this wrong]."),
    ],
    "howto": [
        ("step + mistake", "Step one — and everyone skips this: [FILL: the first step, plus the mistake people make when they skip it]."),
        ("step + why", "Next: [FILL: the second step]. And here's WHY it works, because knowing why is what makes it stick: [FILL: the reason, one sentence]."),
        ("shortcut", "Now the shortcut nobody tells you: [FILL: the trick, tool, or reframe that cuts the effort in half]."),
        ("trap", "Quick warning though — [FILL: the trap that catches beginners right at this point]. If that happens, [FILL: the fix, one line]."),
        ("level up", "And once the basics feel easy: [FILL: the advanced move that separates pros from everyone else]."),
        ("proof it works", "Does it actually work? [FILL: the result — a number, a before/after, something concrete]. That's not luck, that's the method."),
    ],
}

LISTICLE_ITEM = ("list item", "Number {k}: [FILL: the item — name it, then ONE vivid detail that earns its spot on this list].")
LISTICLE_TOP = ("list item", "And number one. [FILL: the top item — plus the detail that beats everything above it]. I told you it'd be worth the wait.")

EXTRA_BEATS = [
    ("bonus", "Oh — and one more thing, because I can't not tell you: [FILL: a bonus fact or angle you haven't used yet]."),
    ("bonus", "Side note — while researching this I also found [FILL: an unrelated-but-delightful tangent, one line]. You're welcome."),
]

DELIVERY = {
    "HOOK": "punch the first word; no intro, no logo, no 'hey guys'",
    "OPEN LOOP": "lean in, drop your volume a notch — like it's a secret",
    "RE-HOOK": "change something here: cut, zoom, prop, or location",
    "PAYOFF": "slow down ~10%; this is the only beat that gets room to breathe",
    "LOOP / BAIT": "smile, hard cut on the last word — no outro, ever",
    "BODY": "keep pace up; one idea per breath; cut every 1.5-3s",
}

STYLE_LABELS = {
    "explain": "Explainer", "storytime": "Storytime", "listicle": "Countdown list",
    "hottake": "Hot take", "howto": "How-to",
}

FILL_RE = re.compile(r"\[FILL: ([^\]]+)\]")


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------
def fmt_time(sec):
    sec = int(round(sec))
    return f"{sec}s" if sec < 100 else f"{sec // 60}:{sec % 60:02d}"


def window(start, dur):
    return f"{fmt_time(start)}-{fmt_time(start + dur)}"


def fill_topic(template, topic):
    text = template.replace("{topic}", topic)
    return text[0].upper() + text[1:]


TITLE_TEMPLATES = [
    "The truth about {t} nobody tells you",
    "{T} isn't what you think",
    "What nobody tells you about {t}",
    "{T} — explained in a way that actually sticks",
    "I was wrong about {t} (you probably are too)",
]


def make_title(topic, rng):
    fits = []
    for tpl in TITLE_TEMPLATES:
        title = tpl.replace("{t}", topic).replace("{T}", topic[0].upper() + topic[1:])
        if len(title) <= 60:
            fits.append(title)
    if fits:
        return rng.choice(fits)
    # very long topic — cut it at a word boundary instead of mid-word
    short = topic[:52].rsplit(" ", 1)[0]
    return (short[0].upper() + short[1:] + ", explained")[:60]


def pick_style(style, topic, rng):
    if style != "auto":
        return style
    pool = list(STYLES)
    # a how-to script only makes sense for a how-to topic
    if not re.match(r"how(\s+(to|do|does|can))?\b", topic, re.IGNORECASE):
        pool.remove("howto")
    elif rng.random() < 0.7:
        return "howto"
    return rng.choice(pool)


def body_beats(style, n, rng):
    """Return n (device, template) body beats for the style, in a sane order."""
    if style == "listicle":
        n = max(n, 3)  # a 2-item countdown isn't a countdown
        beats = [(LISTICLE_ITEM[0], LISTICLE_ITEM[1].replace("{k}", str(k)))
                 for k in range(n, 1, -1)]
        return beats + [LISTICLE_TOP]
    pool = BODY[style][:]
    beats = pool[:n]
    extra = EXTRA_BEATS[:]
    rng.shuffle(extra)
    while len(beats) < n:
        beats.append(extra[len(beats) % len(extra)])
    return beats


def build_script(topic, seconds, style, ending, rng, number=1):
    style = pick_style(style, topic, rng)
    hook_device, hook_tpl = rng.choice(HOOKS)
    ending_key = ending if ending != "auto" else rng.choice(list(ENDINGS))
    end_device, end_tpl = rng.choice(ENDINGS[ending_key])

    long_form = seconds >= 45
    # Fixed-cost beats first; the body splits whatever time is left.
    hook_dur = 3
    loop_dur = 5 if long_form else 4
    payoff_dur = max(6, round(seconds * 0.14))
    promise_dur = 5 if long_form else 0
    body_total = seconds - hook_dur - loop_dur - payoff_dur - promise_dur
    n_body = max(2, round(body_total / 24))
    body = body_beats(style, n_body, rng)
    n_body = len(body)  # listicle may bump the count to a real countdown
    rehook_every = 2 if seconds >= 90 else 3
    n_rehooks = (n_body - 1) // rehook_every if long_form and n_body >= 3 else 0
    rehook_dur = 3
    beat_dur = (body_total - n_rehooks * rehook_dur) / n_body

    beats, t = [], 0

    def add(label, dur, device, text, note):
        nonlocal t
        beats.append({"beat": label, "time": window(t, dur), "device": device,
                      "text": text, "delivery": note,
                      "target_words": int(round(dur * WORDS_PER_SEC))})
        t += dur

    add("HOOK", hook_dur, hook_device, fill_topic(hook_tpl, topic), DELIVERY["HOOK"])
    if long_form:
        add("OPEN LOOP", promise_dur, "open loop",
            fill_topic(rng.choice(OPEN_LOOPS), topic), DELIVERY["OPEN LOOP"])

    rehook_pool = REHOOKS[:]
    rng.shuffle(rehook_pool)
    for i, (device, tpl) in enumerate(body):
        if n_rehooks and i and i % rehook_every == 0:
            add("RE-HOOK", rehook_dur, "pattern interrupt",
                rehook_pool[(i // rehook_every - 1) % len(rehook_pool)],
                DELIVERY["RE-HOOK"])
        add(f"BODY {i + 1}", beat_dur, device, fill_topic(tpl, topic), DELIVERY["BODY"])

    payoff_open = rng.choice(PAYOFF_OPENERS) + " " if long_form else ""
    add("PAYOFF", payoff_dur, "payoff — close the loop",
        payoff_open + "[FILL: the payoff — the single best fact, twist, or "
        "takeaway. It must beat everything above it. This is what they came for.]",
        DELIVERY["PAYOFF"])
    add("LOOP / BAIT", loop_dur, end_device, fill_topic(end_tpl, topic),
        DELIVERY["LOOP / BAIT"])

    vo = " ".join(b["text"] for b in beats)
    title = make_title(topic, rng)
    hashtags = ["#" + w.lower() for w in re.findall(r"[A-Za-z]{4,}", topic)[:3]]
    hashtags += ["#didyouknow", "#shorts" if seconds <= 60 else "#viral"]
    return {
        "number": number,
        "topic": topic,
        "style": STYLE_LABELS[style],
        "length": fmt_time(seconds),
        "target_words": int(round(seconds * WORDS_PER_SEC)),
        "hook": beats[0]["text"],
        "on_screen": topic.upper()[:28],
        "beats": beats,
        "title": title,
        "description": (f"{topic[0].upper() + topic[1:]} — explained like a normal "
                        f"human being. " + " ".join(hashtags)),
        "hashtags": hashtags,
        "research": [m for m in FILL_RE.findall(vo)],
    }


# ---------------------------------------------------------------------------
# Claude mode — the model writes every word, under sound-like-a-human rules
# ---------------------------------------------------------------------------
HUMAN_VOICE_RULES = """VOICE RULES (non-negotiable — this must sound like a person, not a press release):
- Write like you're telling a friend across a table. Contractions ALWAYS.
- Talk TO them: "you", "look", "okay so", "honestly?", "stay with me".
- Vary rhythm: short punchy lines, then one longer one. Fragments are fine. Good, even.
- Rhetorical questions and asides are your friends. Perfection isn't — a little mess is human.
- BANNED (instant robot voice): "delve", "dive into", "in today's fast-paced world",
  "game-changer", "unleash", "tapestry", "it's important to note", "whether you're
  X or Y", "let's explore", "in conclusion", "furthermore", starting with "Welcome".
- Read-aloud test every line. If it sounds like a LinkedIn post, rewrite it.
- Every fact must be real. Dramatize, never fabricate. No invented numbers."""

RETENTION_RULES = """RETENTION STRUCTURE (each beat labeled with its device):
- HOOK: first 1-3 seconds, no greeting, no intro. It must create an itch.
- OPEN LOOP: within the first 15%, promise something specific for the end. Pay it off in the PAYOFF beat — never earlier.
- Re-hook / pattern interrupt every 20-30 seconds ("but here's where it gets weird").
- Curiosity gaps throughout: say THAT something is surprising before saying WHAT.
- PAYOFF in the final third: the best material in the script, full stop.
- Last line: loop back to the hook, or ask a question people will fight about in comments. Hard cut. No outro."""

CLAUDE_SCHEMA = """Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "style": "the format used (explainer / storytime / countdown / hot take / how-to)",
  "hook": "the first line, word for word",
  "on_screen": "big on-screen text for the first frame, <=28 chars, uppercase",
  "beats": [{"beat": "HOOK", "time": "0-3s", "device": "curiosity gap",
             "text": "the exact words to say", "delivery": "one performance note"}],
  "title": "<60-char title with a curiosity gap, no hashtags, no clickbait lies",
  "description": "1-2 conversational sentences ending with 4-6 hashtags"
}"""


def claude_scripts(topic, seconds, style, ending, count):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    style_line = ("Pick the best-fitting format per script (explainer, storytime, "
                  "countdown, hot take, how-to) and vary them across the batch."
                  if style == "auto" else f"Format: {STYLE_LABELS[style]}.")
    ending_line = ("End on a loop back to the hook or a comment-bait question — "
                   "your call per script." if ending == "auto" else
                   f"Ending type: {ending}.")
    prompt = (
        f"You write scripts that go viral because they sound like a smart friend "
        f"talking, not a robot narrating.\n\n"
        f"Topic: {topic}\n"
        f"Video length: ~{seconds} seconds (target ~{int(seconds * WORDS_PER_SEC)} "
        f"words of voiceover total — hit it within 10%).\n"
        f"{style_line}\n{ending_line}\n\n"
        f"Write {count} complete, ready-to-record script{'s' if count > 1 else ''} "
        f"on this topic, each taking a genuinely different angle.\n\n"
        f"{HUMAN_VOICE_RULES}\n\n{RETENTION_RULES}\n\n{CLAUDE_SCHEMA}"
    )
    client = anthropic.Anthropic()
    msg = client.messages.create(
        model="claude-opus-5",
        max_tokens=8000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        print("Claude didn't return parseable JSON. Raw output:\n" + text)
        return None
    try:
        raw = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"Couldn't parse Claude's JSON ({e}). Raw output:\n" + text)
        return None

    out = []
    for i, r in enumerate(raw, 1):
        beats = [{"beat": b.get("beat", f"BEAT {j + 1}"), "time": b.get("time", ""),
                  "device": b.get("device", ""), "text": b.get("text", ""),
                  "delivery": b.get("delivery", ""), "target_words": None}
                 for j, b in enumerate(r.get("beats", []))]
        out.append({
            "number": i, "topic": topic, "style": r.get("style", ""),
            "length": fmt_time(seconds),
            "target_words": int(round(seconds * WORDS_PER_SEC)),
            "hook": r.get("hook", beats[0]["text"] if beats else ""),
            "on_screen": r.get("on_screen", "")[:28], "beats": beats,
            "title": r.get("title", "")[:60],
            "description": r.get("description", ""),
            "hashtags": re.findall(r"#\w+", r.get("description", "")),
            "research": [],
        })
    return out


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def print_scripts(scripts, label):
    print(f"\n  {len(scripts)} viral script{'s' if len(scripts) != 1 else ''} — {label}")
    print("  " + "=" * 68)
    for s in scripts:
        print(f"\n  {s['number']}. \"{s['title']}\"")
        print(f"     {s['style']} · {s['length']} · ~{s['target_words']} words")
        print("  " + "-" * 68)
        print(f"   ON-SCREEN: {s['on_screen']}")
        for b in s["beats"]:
            words = f", ~{b['target_words']}w" if b.get("target_words") else ""
            print(f"\n   {b['beat']} ({b['time']}{words})  [{b['device']}]")
            print(f"     \"{b['text']}\"")
            if b.get("delivery"):
                print(f"     delivery: {b['delivery']}")
        print(f"\n   TITLE: {s['title']}")
        print(f"   DESC:  {s['description']}")
        if s["research"]:
            print("   RESEARCH TO FILL (every slot = one real, sourced fact):")
            for item in s["research"]:
                print(f"     [ ] {item}")
    print()


def export_markdown(path, topic, scripts):
    lines = [f"# “{topic[0].upper() + topic[1:]}” — Viral Script Pack", "",
             "Generated by `tools/viral_script.py`. Say it out loud before you "
             "record it — if a line sounds like a press release, rewrite it until "
             "it sounds like you. Fill every research slot with a real, sourced "
             "fact.", "", "---", ""]
    for s in scripts:
        lines.append(f"## {s['number']} — \"{s['title']}\"")
        lines.append(f"*{s['style']} · {s['length']} · ~{s['target_words']} words*")
        lines.append("")
        lines.append(f"**ON-SCREEN:** {s['on_screen']}")
        lines.append("")
        lines.append("| Beat | Time | Device | Script |")
        lines.append("|---|---|---|---|")
        for b in s["beats"]:
            text = b["text"].replace("|", "\\|")
            lines.append(f"| **{b['beat']}** | {b['time']} | {b['device']} | {text} |")
        lines.append("")
        lines.append(f"**TITLE:** {s['title']}")
        lines.append(f"**DESC:** {s['description']}")
        if s["research"]:
            lines.append("")
            lines.append("**RESEARCH TO FILL:**")
            for item in s["research"]:
                lines.append(f"- [ ] {item}")
        lines += ["", "---", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Saved script pack -> {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("topic", help="What the video is about — any topic, any niche "
                    "(phrase it like a noun: 'why cats knead', 'the housing market')")
    ap.add_argument("--length", default="30s", choices=sorted(LENGTHS, key=LENGTHS.get),
                    help="Video length (default 30s)")
    ap.add_argument("--style", default="auto", choices=("auto",) + STYLES,
                    help="Script format (default: auto — varies across the batch)")
    ap.add_argument("--ending", default="auto", choices=("auto", "loop", "comment", "follow"),
                    help="How the script ends (default: auto)")
    ap.add_argument("-n", "--count", type=int, default=1,
                    help="How many script variations to write (default 1)")
    ap.add_argument("--use-claude", action="store_true",
                    help="AI-written, fully worded scripts (needs ANTHROPIC_API_KEY)")
    ap.add_argument("--seed", type=int, default=None, help="Random seed for reproducible runs")
    ap.add_argument("--json", action="store_true", help="Print raw JSON instead of the report")
    ap.add_argument("--export-md", metavar="PATH", default="",
                    help="Also save the scripts as a markdown pack")
    args = ap.parse_args()

    topic = args.topic.strip().rstrip(".!?")
    if not topic:
        sys.exit("Give me a topic.")
    seconds = LENGTHS[args.length]
    rng = random.Random(args.seed)

    scripts = None
    label = "offline (fill the research slots before recording)"
    if args.use_claude:
        scripts = claude_scripts(topic, seconds, args.style, args.ending, args.count)
        if scripts is None:
            print("  (falling back to offline scripts)")
        else:
            label = "Claude-written, ready to record"
    if scripts is None:
        scripts = [build_script(topic, seconds, args.style, args.ending, rng, i + 1)
                   for i in range(args.count)]

    if args.json:
        print(json.dumps({"topic": topic, "length": args.length,
                          "scripts": scripts}, indent=2))
    else:
        print_scripts(scripts, label)

    if args.export_md:
        export_markdown(args.export_md, topic, scripts)


if __name__ == "__main__":
    main()
