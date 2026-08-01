"""Script Generator — turns a topic into a full 45-60s Short package.

Produces: a viral title, 10 hooks, a fully timestamped script, an ending
question, a retention analysis, and a viral score with an explanation.

Two code paths:
  * LLM path (Ollama / OpenRouter): asks the model for structured JSON
    using the channel's established wildlife-documentary voice.
  * Offline path (default, always available): builds the script from
    curiosity-gap sentence templates and evenly timestamps them at the
    channel's target narration pace. Deterministic and free.
"""

from __future__ import annotations

import json
import re

from core.config import CHANNEL_NAME, NICHE_TONE, TARGET_DURATION_SECONDS, WORDS_PER_SECOND
from core.models import ScriptResult, ScriptSegment
from generators.llm_client import LLMClient, try_parse_json

_SYSTEM_PROMPT = f"""You are the lead scriptwriter for "{CHANNEL_NAME}", a faceless
AI-generated YouTube Shorts channel about wildlife. {NICHE_TONE}

Write scripts that maximize retention: the first 2 seconds must create an
irresistible curiosity gap, and every 3-5 seconds must introduce a new
reveal, twist, or escalation. Never invent facts — if uncertain, say so
honestly. Output ONLY valid JSON, no prose before or after."""

_USER_PROMPT_TEMPLATE = """Topic: "{topic}"

Return a JSON object with exactly these keys:
{{
  "title": "a clickable, honest title under 60 characters",
  "hooks": ["10 distinct scroll-stopping opening lines, no duplicates"],
  "segments": ["6 to 12 short narration lines, in order, that together tell
                a complete 45-60 second story about the topic: hook, then a
                new reveal every sentence, ending on a surprising payoff"],
  "ending_question": "a natural, specific question inviting comments",
  "retention_analysis": "2-3 sentences on which beats will hold viewers",
  "viral_score": <integer 1-100>,
  "viral_score_explanation": "1-2 sentences justifying the score"
}}"""

# ---------------------------------------------------------------------------
# Offline fallback vocabulary
# ---------------------------------------------------------------------------

_HOOK_TEMPLATES = [
    "This animal has outsmarted scientists for decades.",
    "Scientists still can't fully explain what {topic_lower} means.",
    "{topic} should not be biologically possible. Here's how it happens.",
    "This is the secret nobody expected about {topic_lower}.",
    "{topic}, and researchers only recently proved it.",
    "Nature built something stranger than fiction: {topic_lower}.",
    "Here's what happens right before it's confirmed: {topic_lower}.",
    "The discovery that {topic_lower} changed how scientists see this animal.",
    "{topic}. Most people have never heard this.",
    "This is the animal fact that sounds fake, but isn't: {topic_lower}.",
]

_OFFLINE_SEGMENT_TEMPLATES = [
    "{topic}.",
    "It sounds like an exaggeration. It isn't.",
    "Researchers spent years confirming this before they were willing to publish it.",
    "The behavior shows up again and again, in the wild and under controlled study.",
    "It challenges what scientists assumed this animal was even capable of.",
    "Nobody expected the evidence to be this consistent.",
    "The mechanism behind it is still being studied in detail.",
    "It's rare for a single behavior to change how an entire species is understood.",
    "The more researchers look, the stranger the pattern gets.",
    "This is one of the clearest examples of animal intelligence caught on record.",
]

_ENDING_TEMPLATES = [
    "Would you have believed this before seeing the evidence?",
    "What's the animal fact you still don't believe is real?",
    "Which part of this surprised you the most?",
]


def generate_script(topic: str, llm: LLMClient | None = None) -> ScriptResult:
    topic = topic.strip()
    if not topic:
        raise ValueError("Topic must not be empty.")

    if llm is not None and llm.is_available() and llm.backend != "offline":
        result = _generate_with_llm(topic, llm)
        if result is not None:
            return result

    return _generate_offline(topic)


# ---------------------------------------------------------------------------
# LLM path
# ---------------------------------------------------------------------------

def _generate_with_llm(topic: str, llm: LLMClient) -> ScriptResult | None:
    raw = llm.generate(_SYSTEM_PROMPT, _USER_PROMPT_TEMPLATE.format(topic=topic))
    data = try_parse_json(raw)
    if not isinstance(data, dict):
        return None

    try:
        title = str(data["title"]).strip()
        hooks = [str(h).strip() for h in data["hooks"]][:10]
        lines = [str(s).strip() for s in data["segments"] if str(s).strip()]
        ending_question = str(data["ending_question"]).strip()
        retention_analysis = str(data["retention_analysis"]).strip()
        viral_score = int(data["viral_score"])
        viral_score_explanation = str(data["viral_score_explanation"]).strip()
    except (KeyError, ValueError, TypeError):
        return None

    if not lines or not title or not hooks:
        return None

    segments = _timestamp_lines(lines)
    viral_score = max(1, min(100, viral_score))
    return ScriptResult(
        topic=topic,
        title=title,
        hooks=hooks or _offline_hooks(topic),
        segments=segments,
        ending_question=ending_question or _ENDING_TEMPLATES[0],
        retention_analysis=retention_analysis,
        viral_score=viral_score,
        viral_score_explanation=viral_score_explanation,
    )


# ---------------------------------------------------------------------------
# Offline path
# ---------------------------------------------------------------------------

def _generate_offline(topic: str) -> ScriptResult:
    topic_clean = topic.rstrip(".")
    topic_lower = topic_clean[0].lower() + topic_clean[1:] if topic_clean else topic_clean

    lines = [t.format(topic=topic_clean) for t in _OFFLINE_SEGMENT_TEMPLATES]
    segments = _timestamp_lines(lines)

    title = _offline_title(topic_clean)
    hooks = _offline_hooks(topic_clean)

    return ScriptResult(
        topic=topic,
        title=title,
        hooks=hooks,
        segments=segments,
        ending_question=_ENDING_TEMPLATES[0],
        retention_analysis=(
            "The opening line states the topic as an unqualified fact, creating an "
            "immediate curiosity gap. Each following line adds a new layer of "
            "credibility (research, consistency, mechanism) rather than repeating "
            "the same claim, which keeps viewers watching for the next detail."
        ),
        viral_score=68,
        viral_score_explanation=(
            "Solid curiosity-gap structure with steady reveals; connect a specific, "
            "vivid visual to each line and add a concrete number or named study for "
            "a stronger score. Enable an LLM backend for a fully custom, higher-scoring script."
        ),
    )


def _offline_title(topic_clean: str) -> str:
    title = f"{topic_clean} — and scientists proved it"
    return title if len(title) <= 60 else topic_clean[:60]


def _offline_hooks(topic_clean: str) -> list[str]:
    topic_lower = topic_clean[0].lower() + topic_clean[1:] if topic_clean else topic_clean
    return [t.format(topic=topic_clean, topic_lower=topic_lower) for t in _HOOK_TEMPLATES]


def _timestamp_lines(lines: list[str]) -> list[ScriptSegment]:
    """Distribute narration lines across the target duration, weighted by
    each line's word count so longer lines get proportionally more time."""
    word_counts = [max(1, len(re.findall(r"\S+", line))) for line in lines]
    total_words = sum(word_counts)
    total_seconds = max(
        TARGET_DURATION_SECONDS, total_words / WORDS_PER_SECOND
    )

    segments: list[ScriptSegment] = []
    cursor = 0.0
    for i, (line, words) in enumerate(zip(lines, word_counts), start=1):
        duration = (words / total_words) * total_seconds
        start = cursor
        end = cursor + duration
        segments.append(
            ScriptSegment(index=i, start_seconds=round(start, 1), end_seconds=round(end, 1), text=line)
        )
        cursor = end

    return segments
