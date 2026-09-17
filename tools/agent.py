#!/usr/bin/env python3
"""Your personal AI agent for the channel.

A conversational agent that can actually *use* this repo: it reads your niche
configs, brainstorms hooks, scores packaging, pulls your real channel stats,
drafts scripts, reads and writes the docs, searches the web to fact-check, and
remembers what you tell it between runs.

    python tools/agent.py                          # chat
    python tools/agent.py -p "score this title: ..."   # one-shot
    python tools/agent.py --niche-file niche-scams.json
    python tools/agent.py --continue               # resume the last conversation
    python tools/agent.py --list-tools             # show tools, no API call

Needs ANTHROPIC_API_KEY (and YOUTUBE_API_KEY for the channel-stats tool).
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

AGENT_DIR = os.path.join(ROOT, ".agent")
MEMORY_PATH = os.path.join(AGENT_DIR, "memory.json")
SESSION_PATH = os.path.join(AGENT_DIR, "session.json")

MODEL = "claude-opus-5"
MAX_TOKENS = 16000
MAX_ITERATIONS = 24
MAX_RESTARTS = 5          # cap on pause_turn resumes
WRITABLE_EXT = (".md", ".json", ".txt", ".csv")

# ANSI, disabled when not a TTY or when NO_COLOR is set.
_TTY = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
DIM = "\033[2m" if _TTY else ""
BOLD = "\033[1m" if _TTY else ""
CYAN = "\033[36m" if _TTY else ""
OFF = "\033[0m" if _TTY else ""


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def _safe_path(rel, must_exist=False):
    """Resolve `rel` inside the repo. Raises ValueError on escape attempts."""
    path = os.path.abspath(os.path.join(ROOT, rel))
    if os.path.commonpath([path, ROOT]) != ROOT:
        raise ValueError(f"Path escapes the repo: {rel!r}")
    if must_exist and not os.path.isfile(path):
        raise ValueError(f"No such file: {rel!r}")
    return path


def _load_niche(niche_file="niche.json"):
    import generate_ideas
    return generate_ideas.load_niche(niche_file)


def _bullets(items, prefix="  - "):
    return "\n".join(prefix + str(i) for i in items) if items else "  (none)"


def _read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# --------------------------------------------------------------------------
# Tools — each returns a plain string that goes back to the model
# --------------------------------------------------------------------------

from anthropic import beta_tool  # noqa: E402  (after path setup)


@beta_tool
def list_niches() -> str:
    """List every niche config in this repo with its channel name and premise.

    Call this when the user mentions a niche, channel, or topic and you are not
    sure which config file covers it.
    """
    out = []
    for fn in sorted(os.listdir(HERE)):
        if not (fn.startswith("niche") and fn.endswith(".json")):
            continue
        try:
            n = _load_niche(fn)
        except (OSError, json.JSONDecodeError) as e:
            out.append(f"{fn}: (unreadable — {e})")
            continue
        out.append(f"{fn}\n  channel: {n.get('channel_name', '?')}"
                   f"\n  premise: {n.get('one_line', '?')}")
    return "\n".join(out) if out else "No niche*.json files found."


@beta_tool
def read_niche(niche_file: str = "niche.json") -> str:
    """Read a niche config in full — pillars, audience, tone, hooks, hashtags.

    Args:
        niche_file: Filename such as "niche.json" or "niche-scams.json".
    """
    try:
        n = _load_niche(niche_file)
    except (OSError, json.JSONDecodeError) as e:
        return f"Could not read {niche_file!r}: {e}. Try list_niches."
    return json.dumps(n, indent=2, ensure_ascii=False)


@beta_tool
def brainstorm_hooks(count: int = 10, niche_file: str = "niche.json") -> str:
    """Generate opening hooks by filling this niche's proven hook templates.

    These are raw first lines, not finished scripts — fast fuel for ideation.
    Fully offline and deterministic-ish; costs nothing.

    Args:
        count: How many hooks to generate (1-50).
        niche_file: Which niche config to draw templates and vocabulary from.
    """
    import generate_ideas
    count = max(1, min(50, count))
    try:
        niche = _load_niche(niche_file)
    except (OSError, json.JSONDecodeError) as e:
        return f"Could not read {niche_file!r}: {e}"
    hooks = generate_ideas.offline_ideas(count, niche)
    return f"{len(hooks)} hooks for {niche.get('channel_name', niche_file)}:\n" + \
        "\n".join(f"{i}. {h}" for i, h in enumerate(hooks, 1))


@beta_tool
def score_packaging(title: str, description: str = "", tags: str = "",
                    niche_file: str = "niche.json") -> str:
    """Score a Short's title, description and tags against Shorts best practice.

    Returns concrete wins and problems from the repo's offline linter — length,
    power words, curiosity gap, hashtag coverage, spam signals. Run this before
    the user publishes anything.

    Args:
        title: The video title to score.
        description: The description text. Optional.
        tags: Comma-separated tags or hashtags, e.g. "#space, #blackhole".
        niche_file: Which niche's keywords and hashtags to score against.
    """
    import optimize_metadata as om
    try:
        niche = _load_niche(niche_file)
    except (OSError, json.JSONDecodeError) as e:
        return f"Could not read {niche_file!r}: {e}"

    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    chunks = []
    for label, (issues, wins) in (
        ("TITLE", om.lint_title(title, niche)),
        ("DESCRIPTION", om.lint_description(description, niche)),
        ("TAGS", om.lint_tags(tag_list, niche)),
    ):
        chunks.append(f"{label}\n  wins:\n{_bullets(wins, '    + ')}"
                      f"\n  problems:\n{_bullets(issues, '    ! ')}")
    return "\n\n".join(chunks)


@beta_tool
def discover_niches(count: int = 8, parent: str = "") -> str:
    """Generate and score candidate niches or sub-niches, ranked best first.

    Each result carries demand / competition / repeatability / feasibility
    scores out of 10, a 0-100 total, a tier, and the reasoning behind it.

    Args:
        count: How many candidates to generate (1-30).
        parent: Optional category filter, e.g. "death", "money", "ocean".
                Leave empty to search every category.
    """
    import niche_generator as ng
    count = max(1, min(30, count))
    try:
        results = ng.generate_offline(count, parent, random.Random())
    except SystemExit as e:
        return (f"{e}\nAvailable categories: "
                + ", ".join(p["key"] for p in ng.PARENTS))
    results.sort(key=lambda r: r["score"], reverse=True)
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(
            f"{i}. {r['name']} — {r['score']}/100 ({r['tier']})\n"
            f"   {r['one_liner']}\n"
            f"   demand {r['demand']} | competition {r['competition']} | "
            f"repeatable {r['repeatability']} | feasible {r['feasibility']}\n"
            f"   example hook: {r['hook_example']}\n"
            f"   why: {' '.join(r['why']) if isinstance(r['why'], list) else r['why']}")
    return "\n".join(lines)


@beta_tool
def draft_scripts(count: int = 5, niche_file: str = "niche.json") -> str:
    """Draft structured Short scripts for a niche — hook, timed beats, on-screen
    text, visuals, loop ending, and a paste-ready title and description.

    These are skeletons built from the niche's templates. Treat them as a frame
    to rewrite in the channel's voice, not as a finished voiceover.

    Args:
        count: How many scripts to draft (1-10).
        niche_file: Which niche config to script for.
    """
    import viral_generator as vg
    count = max(1, min(10, count))
    try:
        niche = _load_niche(niche_file)
    except (OSError, json.JSONDecodeError) as e:
        return f"Could not read {niche_file!r}: {e}"
    scripts = vg.scripts_for_niche_file(random.Random(), niche, count)
    return json.dumps(scripts, indent=2, ensure_ascii=False)


@beta_tool
def analyze_channel(channel: str = "", top: int = 5) -> str:
    """Pull a real YouTube channel's public stats: subscriber and view totals,
    per-video performance, best and worst performers, and best posting time.

    Needs YOUTUBE_API_KEY. This is read-only public data.

    Args:
        channel: @handle, channel ID, or name. Defaults to $YOUTUBE_CHANNEL.
        top: How many top and bottom performers to list (1-15).
    """
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        return ("YOUTUBE_API_KEY is not set, so I can't read channel stats. "
                "Tell the user to set it (see .env.example) — everything else "
                "in the toolkit still works without it.")
    channel = channel or os.environ.get("YOUTUBE_CHANNEL", "")
    if not channel:
        return "No channel given and $YOUTUBE_CHANNEL is unset. Ask the user which channel."
    top = max(1, min(15, top))

    try:
        import analyze_channel as ac
        cid = ac.resolve_channel_id(channel, key)
        ch = ac.fetch_channel(cid, key)
        uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
        videos = ac.fetch_videos(ac.fetch_all_video_ids(uploads, key), key)
    except SystemExit as e:
        return f"YouTube API problem: {e}"
    except Exception as e:                      # network, quota, bad key, ...
        return f"Could not fetch channel data ({type(e).__name__}): {e}"

    if not videos:
        return f"{channel} resolved, but it has no videos yet."

    st = ch["statistics"]
    shorts = [v for v in videos if v["is_short"]]
    avg_views = sum(v["views"] for v in videos) / len(videos)
    avg_eng = sum(v["engagement"] for v in videos) / len(videos)
    ranked = sorted(videos, key=lambda v: v["views"], reverse=True)

    def row(v):
        return (f"    [{'S' if v['is_short'] else ' '}] {v['views']:,}v  "
                f"{v['engagement']:.1f}%eng  {v['title'][:60]}")

    out = [f"{ch['snippet']['title']} ({channel})",
           f"  subscribers: {'hidden' if st.get('hiddenSubscriberCount') else st.get('subscriberCount', '?')}",
           f"  total views: {int(st.get('viewCount', 0)):,}",
           f"  videos: {len(videos)} ({len(shorts)} Shorts)",
           f"  avg views/video: {avg_views:,.0f}",
           f"  avg engagement: {avg_eng:.2f}%",
           f"  TOP {top}:"] + [row(v) for v in ranked[:top]] + \
          [f"  BOTTOM {top}:"] + [row(v) for v in ranked[-top:]]

    day_avg, hour_avg, days = ac.best_times(videos)
    if day_avg:
        out.append(f"  best day by avg views: {max(day_avg, key=day_avg.get)}")
    if hour_avg:
        out.append(f"  best hour (UTC): {max(hour_avg, key=hour_avg.get):02d}:00")
    out.append("  NOTE: public stats only. Swipe-away rate and average view "
               "duration live in YouTube Studio.")
    return "\n".join(out)


@beta_tool
def list_docs() -> str:
    """List the strategy, script and visual-pack docs in this repo, with sizes."""
    out = []
    for sub in ("docs", "product"):
        base = os.path.join(ROOT, sub)
        for dirpath, _, files in os.walk(base):
            for fn in sorted(files):
                if fn.endswith(".md"):
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, ROOT)
                    out.append(f"  {rel}  ({os.path.getsize(full) // 1024}KB)")
    return "Docs in this repo:\n" + "\n".join(sorted(out))


@beta_tool
def read_doc(path: str, max_chars: int = 20000) -> str:
    """Read a markdown doc from the repo, e.g. "docs/GROWTH_STRATEGY.md".

    Args:
        path: Repo-relative path. Use list_docs if you don't know it.
        max_chars: Truncate beyond this many characters.
    """
    try:
        full = _safe_path(path, must_exist=True)
    except ValueError as e:
        return str(e)
    with open(full, encoding="utf-8") as f:
        text = f.read()
    if len(text) > max_chars:
        return text[:max_chars] + f"\n\n[...truncated, {len(text)} chars total]"
    return text


@beta_tool
def save_doc(path: str, content: str) -> str:
    """Write a file into the repo — a new script pack, strategy note, or doc.

    Only use this when the user asks for something saved. Confirm the path with
    them first if it would overwrite existing work.

    Args:
        path: Repo-relative path ending in .md, .json, .txt or .csv.
        content: The full file contents.
    """
    if not path.endswith(WRITABLE_EXT):
        return f"Refusing to write {path!r} — allowed extensions: {', '.join(WRITABLE_EXT)}"
    try:
        full = _safe_path(path)
    except ValueError as e:
        return str(e)
    existed = os.path.isfile(full)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    verb = "Overwrote" if existed else "Wrote"
    return f"{verb} {path} ({len(content)} chars)."


@beta_tool
def remember(note: str) -> str:
    """Save a durable fact about the user or their channel for future sessions.

    Use this for things worth keeping: their handle, which niche they are
    actually running, their upload cadence, what has worked, their voice
    preferences, decisions they've made. Not for one-off chatter.

    Args:
        note: A single self-contained fact, written so it makes sense cold.
    """
    mem = _read_json(MEMORY_PATH, [])
    entry = {"note": note, "at": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    mem.append(entry)
    _write_json(MEMORY_PATH, mem)
    return f"Remembered ({len(mem)} notes stored): {note}"


@beta_tool
def forget(index: int) -> str:
    """Delete one stored memory note by its 1-based index.

    Args:
        index: Which note to drop, as numbered in your memory list.
    """
    mem = _read_json(MEMORY_PATH, [])
    if not 1 <= index <= len(mem):
        return f"No note {index}. There are {len(mem)}."
    dropped = mem.pop(index - 1)
    _write_json(MEMORY_PATH, mem)
    return f"Forgot: {dropped['note']}"


TOOLS = [list_niches, read_niche, brainstorm_hooks, score_packaging,
         discover_niches, draft_scripts, analyze_channel, list_docs,
         read_doc, save_doc, remember, forget]

WEB_SEARCH = {"type": "web_search_20260209", "name": "web_search", "max_uses": 8}


# --------------------------------------------------------------------------
# System prompt
# --------------------------------------------------------------------------

def build_system(niche_file):
    mem = _read_json(MEMORY_PATH, [])
    mem_block = ("\n".join(f"{i}. {m['note']}  ({m['at']})"
                           for i, m in enumerate(mem, 1))
                 if mem else "(nothing yet — use the remember tool when you "
                             "learn something durable)")
    try:
        niche = _load_niche(niche_file)
        niche_block = (f"Active niche file: {niche_file}\n"
                       f"Channel: {niche.get('channel_name')}"
                       f" ({niche.get('handle', 'no handle set')})\n"
                       f"Premise: {niche.get('one_line')}\n"
                       f"Tone: {niche.get('tone')}\n"
                       f"Pillars:\n{_bullets(niche.get('pillars', []))}")
    except (OSError, json.JSONDecodeError):
        niche_block = f"Active niche file: {niche_file} (could not be read)"

    return f"""You are the personal AI agent for a faceless YouTube Shorts operation, \
running inside its own repo. You are a working partner on this channel, not a \
generic assistant.

{niche_block}

What you can do: you have tools that read the niche configs, brainstorm hooks \
from proven templates, score packaging against Shorts best practice, discover \
and rank new niches, draft script skeletons, pull real channel stats from the \
YouTube API, read and write the repo's docs, and search the web. Prefer calling \
a tool over guessing — the offline tools are free and instant.

How to work:
- Be concrete and specific. A hook, a title, a number — not a lecture on strategy.
- When you draft a script or title, make it publishable as written.
- The offline generators produce skeletons. Rewrite their output in the \
channel's actual voice rather than passing it through raw.
- Fact-check claims with web_search before they go in a script. A wrong fact in \
a viral Short is a correction in every comment.
- Say when something is a guess, and say when a number comes from a tool.
- Volunteer the obvious next step, but do the thing that was asked first.

Content lines that keep this channel monetized — these are not optional:
- Scams: explain how victims get manipulated, never how to run the play. No \
operational detail, no targeting, no tooling. End on the tell that saves people.
- Death and mortality: documentary and science framing only. Never method, \
never instruction, never glorification.
- Herbal and health: no health claims, no dosages, no "cures". Mechanism and \
history only.
- Never fabricate a source, statistic, or citation.

What you remember about this user:
{mem_block}

Today is {datetime.now().strftime('%Y-%m-%d')}."""


# --------------------------------------------------------------------------
# Conversation
# --------------------------------------------------------------------------

def _fmt_tool_input(d):
    if not isinstance(d, dict) or not d:
        return ""
    parts = []
    for k, v in d.items():
        s = str(v).replace("\n", " ")
        parts.append(f"{k}={s[:40] + '…' if len(s) > 40 else s}")
    return ", ".join(parts)[:120]


def render(message, quiet=False):
    """Print a message's text; echo tool calls so the user sees the work."""
    text = []
    for block in message.content:
        if block.type == "text":
            text.append(block.text)
            print(block.text)
        elif block.type == "tool_use" and not quiet:
            print(f"{DIM}  → {block.name}({_fmt_tool_input(block.input)}){OFF}")
        elif block.type == "server_tool_use" and not quiet:
            print(f"{DIM}  → web_search({_fmt_tool_input(block.input)}){OFF}")
    return "\n".join(text)


def run_turn(client, messages, system, effort, no_web):
    """One user turn: run the tool loop, resuming across pause_turn."""
    tools = list(TOOLS) if no_web else list(TOOLS) + [WEB_SEARCH]
    restarts = 0
    while True:
        runner = client.beta.messages.tool_runner(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            max_iterations=MAX_ITERATIONS,
            system=system,
            tools=tools,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            cache_control={"type": "ephemeral"},
        )
        last = None
        for message in runner:
            last = message
            render(message)
            # Mirror history — the runner keeps its own copy and doesn't expose it.
            messages.append({"role": "assistant", "content": message.content})
            tool_response = runner.generate_tool_call_response()
            if tool_response is not None:
                messages.append(tool_response)

        if last is None or last.stop_reason != "pause_turn":
            return last
        restarts += 1
        if restarts > MAX_RESTARTS:
            print(f"{DIM}  (search kept pausing; stopping here){OFF}")
            return last


def chat(client, args):
    system = build_system(args.niche_file)
    messages = []

    if args.continue_session:
        messages = _read_json(SESSION_PATH, [])
        if messages:
            print(f"{DIM}Resumed last conversation ({len(messages)} messages).{OFF}")

    def save():
        if messages:
            _write_json(SESSION_PATH, messages)

    if args.prompt:
        messages.append({"role": "user", "content": args.prompt})
        run_turn(client, messages, system, args.effort, args.no_web)
        save()
        return

    print(f"{BOLD}Your channel agent.{OFF} {DIM}Ctrl-D or 'exit' to quit.{OFF}\n")
    while True:
        try:
            user = input(f"{CYAN}you ▸{OFF} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user.lower() in ("exit", "quit", ":q"):
            break
        messages.append({"role": "user", "content": user})
        print()
        try:
            run_turn(client, messages, system, args.effort, args.no_web)
        except KeyboardInterrupt:
            print(f"\n{DIM}(interrupted){OFF}")
        print()
        save()
        # Memory may have changed this turn; refresh the system prompt.
        system = build_system(args.niche_file)

    save()
    print(f"{DIM}Saved. Resume with --continue.{OFF}")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-p", "--prompt", default="",
                    help="Run a single prompt and exit instead of chatting")
    ap.add_argument("--niche-file", default="niche.json",
                    help="Which niche config the agent works in by default")
    ap.add_argument("--effort", default="high",
                    choices=["low", "medium", "high", "xhigh", "max"],
                    help="How hard the model thinks (default: high)")
    ap.add_argument("--continue", dest="continue_session", action="store_true",
                    help="Resume the previous conversation")
    ap.add_argument("--no-web", action="store_true",
                    help="Disable the web search tool")
    ap.add_argument("--list-tools", action="store_true",
                    help="Print the agent's tools and exit (no API call)")
    args = ap.parse_args()

    if args.list_tools:
        print(f"{BOLD}Agent tools{OFF}\n")
        for t in TOOLS:
            schema = t.to_dict()
            params = ", ".join(schema["input_schema"].get("properties", {}))
            summary = (schema.get("description") or "").strip().split("\n")[0]
            print(f"  {schema['name']}({params})\n      {summary}")
        print(f"  web_search(query)\n      Anthropic-hosted search, for "
              f"fact-checking claims.\n")
        return

    try:
        import anthropic
    except ImportError:
        sys.exit("The agent needs the Anthropic SDK:  pip install anthropic")

    if not (os.environ.get("ANTHROPIC_API_KEY")
            or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        sys.exit("Set ANTHROPIC_API_KEY (see .env.example) to run the agent.")

    client = anthropic.Anthropic()
    try:
        chat(client, args)
    except anthropic.AuthenticationError:
        sys.exit("ANTHROPIC_API_KEY was rejected. Check the key.")
    except anthropic.RateLimitError:
        sys.exit("Rate limited by the API. Wait a moment and retry.")
    except anthropic.APIConnectionError as e:
        sys.exit(f"Could not reach the API: {e}")


if __name__ == "__main__":
    main()
