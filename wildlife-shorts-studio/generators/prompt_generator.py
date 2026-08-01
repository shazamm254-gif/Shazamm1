"""Prompt Generator — AI image prompts, image-to-video prompts, and a
thumbnail package for every scene.

Every image prompt ends with the channel's shared VISUAL_STYLE_TAGS block so
a whole Short's stills stay visually consistent when pasted into Midjourney,
Flux, Leonardo, etc. Every video prompt is written for Runway/Kling/Luma
style image-to-video tools.
"""

from __future__ import annotations

from core.config import CHANNEL_NAME, NICHE_TONE, VISUAL_STYLE_TAGS
from core.models import Scene, ScenePrompts, ThumbnailPackage
from generators.llm_client import LLMClient, try_parse_json

_SYSTEM_PROMPT = f"""You are an AI image/video prompt engineer for "{CHANNEL_NAME}",
a faceless wildlife Shorts channel. {NICHE_TONE}

Write ultra-detailed, non-generic AI image prompts (subject, animal
description, behavior, environment, foreground, background, time of day,
weather, lighting, lens, composition, depth of field) and matching
image-to-video animation prompts (camera movement, wind/water/dust/fog as
relevant, animal movement, natural physics, cinematic realism). Output ONLY
valid JSON, no prose before or after."""

_USER_PROMPT_TEMPLATE = """Topic: "{topic}"
Scenes (number, narration, visual):
{scene_list}

Return a JSON array with one object per scene, in the same order, each with
exactly these keys: "image_prompt" (a single dense paragraph, 60-100 words,
ending with the exact tag list: "{style_tags}"), "video_prompt" (a single
dense paragraph, 30-60 words, describing camera movement and natural motion,
ending with "vertical 9:16")."""

_THUMBNAIL_SYSTEM_PROMPT = f"""You are a thumbnail strategist for "{CHANNEL_NAME}".
Design the single most curiosity-inducing frame for this Short — specific,
never generic, never explaining the whole payoff. Output ONLY valid JSON."""

_THUMBNAIL_USER_TEMPLATE = """Topic: "{topic}"
Most striking scene: "{best_scene_visual}"

Return a JSON object with exactly these keys: "concept" (1-2 sentences),
"prompt" (a single dense AI image prompt paragraph ending with "{style_tags}"),
"text_options" (a list of 3 thumbnail text ideas, each 3-5 words, ALL CAPS),
"click_reason" (1-2 sentences on why this makes someone click)."""


def generate_scene_prompts(
    topic: str, scenes: list[Scene], llm: LLMClient | None = None
) -> list[ScenePrompts]:
    if llm is not None and llm.is_available() and llm.backend != "offline":
        prompts = _generate_with_llm(topic, scenes, llm)
        if prompts is not None:
            return prompts
    return _generate_offline(scenes)


def _generate_with_llm(
    topic: str, scenes: list[Scene], llm: LLMClient
) -> list[ScenePrompts] | None:
    scene_list = "\n".join(
        f"{s.number}. narration: {s.narration} | visual: {s.visual}" for s in scenes
    )
    prompt = _USER_PROMPT_TEMPLATE.format(
        topic=topic, scene_list=scene_list, style_tags=VISUAL_STYLE_TAGS
    )
    raw = llm.generate(_SYSTEM_PROMPT, prompt)
    data = try_parse_json(raw)
    if not isinstance(data, list) or len(data) != len(scenes):
        return None

    try:
        return [
            ScenePrompts(
                scene_number=s.number,
                image_prompt=str(entry["image_prompt"]).strip(),
                video_prompt=str(entry["video_prompt"]).strip(),
            )
            for s, entry in zip(scenes, data)
        ]
    except (KeyError, TypeError):
        return None


def _generate_offline(scenes: list[Scene]) -> list[ScenePrompts]:
    prompts = []
    for s in scenes:
        image_prompt = (
            f"Subject: the animal central to the moment \"{s.narration.rstrip('.')}\". "
            f"Behavior: caught mid-action, illustrating that exact moment. "
            f"Environment: the animal's natural wild habitat, "
            f"rendered in full ecological detail. Foreground: the subject in sharp focus. "
            f"Background: softly blurred natural surroundings. Time of day: consistent "
            f"with a {s.lighting.lower()} setup. Weather: still, natural ambient conditions. "
            f"Camera angle: {s.camera_angle.lower()}. Lighting: {s.lighting.lower()}. "
            f"Lens: macro/telephoto documentary lens matched to the shot distance. "
            f"Composition: {s.mood.lower()} framing built around the subject. "
            f"Depth of field: shallow, subject sharp against a soft background. "
            f"{VISUAL_STYLE_TAGS}."
        )
        video_prompt = (
            f"{s.camera_movement}, the animal's natural movement and breathing rendered "
            f"with realistic physics, ambient environmental motion (wind, dust, or water as "
            f"appropriate to the scene), subtle eye and muscle movement, smooth cinematic "
            f"motion, documentary realism, mood: {s.mood.lower()}, vertical 9:16."
        )
        prompts.append(
            ScenePrompts(scene_number=s.number, image_prompt=image_prompt, video_prompt=video_prompt)
        )
    return prompts


def generate_thumbnail(
    topic: str, scenes: list[Scene], llm: LLMClient | None = None
) -> ThumbnailPackage:
    best_scene = max(scenes, key=lambda s: len(s.narration)) if scenes else None
    best_visual = best_scene.visual if best_scene else topic

    if llm is not None and llm.is_available() and llm.backend != "offline":
        thumb = _generate_thumbnail_with_llm(topic, best_visual, llm)
        if thumb is not None:
            return thumb
    return _generate_thumbnail_offline(topic, best_visual)


def _generate_thumbnail_with_llm(
    topic: str, best_scene_visual: str, llm: LLMClient
) -> ThumbnailPackage | None:
    prompt = _THUMBNAIL_USER_TEMPLATE.format(
        topic=topic, best_scene_visual=best_scene_visual, style_tags=VISUAL_STYLE_TAGS
    )
    raw = llm.generate(_THUMBNAIL_SYSTEM_PROMPT, prompt)
    data = try_parse_json(raw)
    if not isinstance(data, dict):
        return None
    try:
        return ThumbnailPackage(
            concept=str(data["concept"]).strip(),
            prompt=str(data["prompt"]).strip(),
            text_options=[str(t).strip() for t in data["text_options"]][:3],
            click_reason=str(data["click_reason"]).strip(),
        )
    except (KeyError, TypeError):
        return None


def _generate_thumbnail_offline(topic: str, best_scene_visual: str) -> ThumbnailPackage:
    concept = (
        f"An extreme close-up on the single most striking moment of the story — "
        f"\"{best_scene_visual}\" — framed to raise a question, not answer it."
    )
    prompt = (
        f"Subject: an extreme close-up capturing the moment described as \"{best_scene_visual}\". "
        f"Animal description: sharply detailed, natural coloring and texture. "
        f"Behavior: caught mid-action, unresolved. Environment: the animal's natural habitat, "
        f"softly blurred. Foreground: the subject filling two-thirds of the frame. "
        f"Background: soft-focus, high contrast falloff. Time of day: natural daylight. "
        f"Weather: still. Lighting: single hard directional light, strong contrast. "
        f"Lens: macro/telephoto, shallow depth of field. Composition: centered, high impact. "
        f"{VISUAL_STYLE_TAGS}."
    )
    topic_words = [w for w in topic.split() if w.isalpha()]
    subject = " ".join(topic_words[:2]).upper() if topic_words else "THIS ANIMAL"
    text_options = [
        f"{subject}: IT'S REAL",
        "SCIENTISTS CONFIRMED IT",
        "WATCH WHAT HAPPENS",
    ]
    click_reason = (
        "The image shows something specific and unresolved rather than the full payoff, "
        "and the on-image text signals the claim is verified, not clickbait — that "
        "combination earns the swipe from both casual scrollers and skeptics."
    )
    return ThumbnailPackage(
        concept=concept, prompt=prompt, text_options=text_options, click_reason=click_reason
    )
