"""SEO Generator — titles, description, hashtags, and keywords.

Hashtags always include the channel's core + extra sets from config so every
Short's packaging stays on-brand, topped up with topic-derived tags.
"""

from __future__ import annotations

import re
import textwrap

from core.config import CHANNEL_NAME, CORE_HASHTAGS, EXTRA_HASHTAGS, NICHE_TONE
from core.models import SeoPackage
from generators.llm_client import LLMClient, try_parse_json

_SYSTEM_PROMPT = f"""You are an SEO strategist for "{CHANNEL_NAME}", a faceless
wildlife Shorts channel. {NICHE_TONE}

Titles must use genuine curiosity, never misleading clickbait. Output ONLY
valid JSON, no prose before or after."""

_USER_PROMPT_TEMPLATE = """Topic: "{topic}"
Title already chosen for the video: "{primary_title}"

Return a JSON object with exactly these keys: "titles" (9 MORE distinct
alternative titles, each under 60 characters, not duplicating the title
above), "description" (a 2-3 sentence SEO description ending with a
subscribe call-to-action and 5 hashtags), "keywords" (10 search-style
keyword phrases)."""


def generate_seo(
    topic: str, primary_title: str, llm: LLMClient | None = None
) -> SeoPackage:
    if llm is not None and llm.is_available() and llm.backend != "offline":
        seo = _generate_with_llm(topic, primary_title, llm)
        if seo is not None:
            return seo
    return _generate_offline(topic, primary_title)


def _generate_with_llm(
    topic: str, primary_title: str, llm: LLMClient
) -> SeoPackage | None:
    prompt = _USER_PROMPT_TEMPLATE.format(topic=topic, primary_title=primary_title)
    raw = llm.generate(_SYSTEM_PROMPT, prompt)
    data = try_parse_json(raw)
    if not isinstance(data, dict):
        return None
    try:
        titles = [primary_title] + [str(t).strip() for t in data["titles"]][:9]
        description = str(data["description"]).strip()
        keywords = [str(k).strip() for k in data["keywords"]][:10]
    except (KeyError, TypeError):
        return None
    hashtags = _build_hashtags(topic)
    return SeoPackage(titles=titles[:10], description=description, hashtags=hashtags, keywords=keywords)


def _generate_offline(topic: str, primary_title: str) -> SeoPackage:
    topic_clean = topic.rstrip(".")
    topic_lower = topic_clean[0].lower() + topic_clean[1:] if topic_clean else topic_clean

    alt_titles = [
        f"The truth about {topic_lower}",
        f"{topic_clean} — scientists explain why",
        f"Nobody told you {topic_lower}",
        f"This is why {topic_lower}",
        f"{topic_clean}. Here's the proof.",
        f"The animal fact everyone gets wrong: {topic_lower}",
        f"{topic_clean} (and it's stranger than you think)",
        f"What scientists found when they studied this",
        f"{topic_clean} — the full story",
    ]
    titles = [primary_title] + [
        textwrap.shorten(t, width=60, placeholder="...") for t in alt_titles
    ]

    description = (
        f"{topic_clean}. Real, verified wildlife science, visualized in cinematic "
        f"detail. Subscribe to {CHANNEL_NAME} for more wildlife facts stranger than "
        f"fiction. {' '.join(CORE_HASHTAGS)} #shorts"
    )

    keywords = _build_keywords(topic_clean)
    hashtags = _build_hashtags(topic)
    return SeoPackage(titles=titles[:10], description=description, hashtags=hashtags, keywords=keywords)


_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "are", "its", "has", "have",
    "was", "were", "from", "into", "your", "you", "can", "not", "but", "just",
    "how", "why", "what", "when", "who", "than", "then", "over", "even",
    "still", "only", "more", "most", "some", "any", "all", "own", "out",
}


def _build_hashtags(topic: str) -> list[str]:
    topic_tags = []
    for word in re.findall(r"[A-Za-z]+", topic):
        tag = f"#{word.lower()}"
        if (
            len(word) > 2
            and word.lower() not in _STOPWORDS
            and tag not in CORE_HASHTAGS
            and tag not in EXTRA_HASHTAGS
        ):
            topic_tags.append(tag)

    combined: list[str] = []
    for tag in CORE_HASHTAGS + topic_tags + EXTRA_HASHTAGS:
        if tag not in combined:
            combined.append(tag)
        if len(combined) >= 20:
            break

    while len(combined) < 20:
        combined.append("#shorts" if "#shorts" not in combined else f"#wildlifefacts{len(combined)}")

    return combined[:20]


def _build_keywords(topic_clean: str) -> list[str]:
    words = topic_clean.split()
    keywords = [
        topic_clean.lower(),
        f"{topic_clean.lower()} explained",
        f"is it true {topic_clean.lower()}",
        "wildlife documentary shorts",
        "nature is metal",
        "animal facts",
        "real animal science",
        "wildlife facts you didn't know",
    ]
    if len(words) >= 2:
        keywords.append(f"{words[0].lower()} {words[1].lower()} facts")
    keywords.append("BBC Earth style wildlife shorts")
    return keywords[:10]
