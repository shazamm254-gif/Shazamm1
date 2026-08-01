"""Scene Generator — divides a generated script into shootable scenes.

Each ScriptSegment becomes exactly one Scene, enriched with cinematic
direction (camera angle/movement, lighting, mood, transition, sound effect).
Offline mode rotates through a curated pool of documentary-grade cinematic
choices so scenes never repeat back-to-back; the LLM path (when available)
tailors direction to the actual narration content.
"""

from __future__ import annotations

from core.config import CHANNEL_NAME, NICHE_TONE
from core.models import Scene, ScriptResult
from generators.llm_client import LLMClient, try_parse_json

_SYSTEM_PROMPT = f"""You are the cinematographer for "{CHANNEL_NAME}", a faceless
AI-generated wildlife Shorts channel. {NICHE_TONE}

For each narration line you receive, choose specific, varied cinematic
direction (never repeat the exact same camera angle or lighting twice in a
row). Output ONLY valid JSON, no prose before or after."""

_USER_PROMPT_TEMPLATE = """Narration lines, in order:
{numbered_lines}

Return a JSON array with one object per line, in the same order, each with
exactly these keys: "visual" (one sentence describing what's on screen),
"camera_angle", "camera_movement", "lighting", "mood", "transition",
"sound_effect". Keep every value under 12 words."""

# ---------------------------------------------------------------------------
# Offline cinematic vocabulary pools (rotated, never repeated back-to-back)
# ---------------------------------------------------------------------------

_CAMERA_ANGLES = [
    "Extreme macro, eye-level",
    "Low angle, looking upward",
    "Wide establishing shot",
    "Three-quarter rear angle",
    "Overhead top-down",
    "Side profile, low to the ground",
    "Elevated wide angle",
    "Extreme close-up, frontal",
    "Underside angle, looking up",
    "Ground-level, subject-height",
    "Diagonal Dutch angle",
]

_CAMERA_MOVEMENTS = [
    "Slow push-in",
    "Static hold with micro push-in",
    "Slow dolly-in tracking the subject",
    "Gentle orbit around the subject",
    "Slow vertical tilt-up",
    "Rack focus pull to the subject",
    "Slow cinematic pull-back",
    "Handheld micro-shake tracking shot",
    "Slow horizontal pan",
    "Creeping zoom, static base",
    "Whip-pan into the subject",
]

_LIGHTING = [
    "Single hard rim light, deep shadow",
    "Dappled natural sunlight through canopy",
    "Harsh top-down light, high contrast",
    "Soft overcast diffused light",
    "Backlit rim light with volumetric haze",
    "Golden-hour side light",
    "Moody volumetric god-rays through fog",
    "Cool blue ambient underwater light",
    "Hard single-source spotlight, deep contrast",
    "Bioluminescent glow, near-total darkness",
    "Bright midday sun, minimal shadow",
]

_MOODS = [
    "Ominous and intimate",
    "Curious tension building",
    "Awe-struck wonder",
    "Quiet, creeping dread",
    "Triumphant revelation",
    "Haunting stillness",
    "Suspenseful anticipation",
    "Visceral, high-stakes urgency",
    "Reverent and epic in scale",
    "Unsettling, uncanny calm",
    "Explosive, climactic release",
]

_TRANSITIONS = [
    "Hard cut",
    "Match cut on motion",
    "Smooth whip-pan",
    "Slow fade-hold",
    "Light-flare wipe",
    "Rhythmic straight cut",
    "Visual echo match-cut",
    "Hard impact cut with flash frame",
    "Cross-dissolve",
    "Speed-ramp cut",
    "Smash cut on silence",
]

_SOUND_EFFECTS = [
    "Low sub-bass drone",
    "Soft organic foley swell",
    "Rising synth pulse",
    "Ambient forest drone thickening",
    "Sharp impact hit with bass",
    "Eerie choir/drone swell",
    "Near-silence into a single heartbeat",
    "Sudden riser into silence",
    "Deep resonant boom",
    "Wet organic crackle texture",
    "Sharp whoosh transition sting",
]


def generate_scenes(script: ScriptResult, llm: LLMClient | None = None) -> list[Scene]:
    if llm is not None and llm.is_available() and llm.backend != "offline":
        scenes = _generate_with_llm(script, llm)
        if scenes is not None:
            return scenes
    return _generate_offline(script)


def _generate_with_llm(script: ScriptResult, llm: LLMClient) -> list[Scene] | None:
    numbered = "\n".join(f"{i}. {seg.text}" for i, seg in enumerate(script.segments, start=1))
    raw = llm.generate(_SYSTEM_PROMPT, _USER_PROMPT_TEMPLATE.format(numbered_lines=numbered))
    data = try_parse_json(raw)
    if not isinstance(data, list) or len(data) != len(script.segments):
        return None

    try:
        scenes = []
        for seg, entry in zip(script.segments, data):
            scenes.append(
                Scene(
                    number=seg.index,
                    timestamp_label=seg.timestamp_label,
                    narration=seg.text,
                    visual=str(entry["visual"]).strip(),
                    camera_angle=str(entry["camera_angle"]).strip(),
                    camera_movement=str(entry["camera_movement"]).strip(),
                    lighting=str(entry["lighting"]).strip(),
                    mood=str(entry["mood"]).strip(),
                    transition=str(entry["transition"]).strip(),
                    sound_effect=str(entry["sound_effect"]).strip(),
                )
            )
        return scenes
    except (KeyError, TypeError):
        return None


def _generate_offline(script: ScriptResult) -> list[Scene]:
    scenes = []
    for i, seg in enumerate(script.segments):
        scenes.append(
            Scene(
                number=seg.index,
                timestamp_label=seg.timestamp_label,
                narration=seg.text,
                visual=f"A wildlife documentary shot capturing: {seg.text.rstrip('.')}",
                camera_angle=_CAMERA_ANGLES[i % len(_CAMERA_ANGLES)],
                camera_movement=_CAMERA_MOVEMENTS[i % len(_CAMERA_MOVEMENTS)],
                lighting=_LIGHTING[i % len(_LIGHTING)],
                mood=_MOODS[i % len(_MOODS)],
                transition=_TRANSITIONS[i % len(_TRANSITIONS)],
                sound_effect=_SOUND_EFFECTS[i % len(_SOUND_EFFECTS)],
            )
        )
    return scenes
