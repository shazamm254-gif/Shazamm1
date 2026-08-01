"""Typed data models shared across every generator and the UI layer.

Using dataclasses (rather than passing raw dicts around) keeps every module's
inputs/outputs self-documenting and lets `export.exporter` and `core.database`
serialize/deserialize a whole project without guessing field names.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field


@dataclass
class ScriptSegment:
    """One timestamped narration beat of the script."""

    index: int
    start_seconds: float
    end_seconds: float
    text: str

    @property
    def timestamp_label(self) -> str:
        return f"{_fmt_time(self.start_seconds)}–{_fmt_time(self.end_seconds)}"


@dataclass
class ScriptResult:
    topic: str
    title: str
    hooks: list[str]
    segments: list[ScriptSegment]
    ending_question: str
    retention_analysis: str
    viral_score: int
    viral_score_explanation: str

    @property
    def full_narration(self) -> str:
        return " ".join(seg.text for seg in self.segments)

    @property
    def total_duration_seconds(self) -> float:
        if not self.segments:
            return 0.0
        return self.segments[-1].end_seconds


@dataclass
class Scene:
    """One visual beat: a scene number mapped 1:1 to a ScriptSegment."""

    number: int
    timestamp_label: str
    narration: str
    visual: str
    camera_angle: str
    camera_movement: str
    lighting: str
    mood: str
    transition: str
    sound_effect: str


@dataclass
class ScenePrompts:
    scene_number: int
    image_prompt: str
    video_prompt: str


@dataclass
class ThumbnailPackage:
    concept: str
    prompt: str
    text_options: list[str]
    click_reason: str


@dataclass
class SeoPackage:
    titles: list[str]
    description: str
    hashtags: list[str]
    keywords: list[str]


@dataclass
class CaptionCue:
    index: int
    start_seconds: float
    end_seconds: float
    text: str


@dataclass
class Project:
    """The full production package for one Short, as stored in SQLite."""

    id: int | None
    topic: str
    created_at: str
    script: ScriptResult | None = None
    scenes: list[Scene] = field(default_factory=list)
    prompts: list[ScenePrompts] = field(default_factory=list)
    thumbnail: ThumbnailPackage | None = None
    seo: SeoPackage | None = None
    captions: list[CaptionCue] = field(default_factory=list)
    voiceover_path: str | None = None

    # ---- serialization -----------------------------------------------
    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)

    @staticmethod
    def from_json(raw: str, project_id: int, created_at: str) -> "Project":
        data = json.loads(raw)
        script_data = data.get("script")
        script = None
        if script_data:
            script = ScriptResult(
                topic=script_data["topic"],
                title=script_data["title"],
                hooks=script_data["hooks"],
                segments=[ScriptSegment(**s) for s in script_data["segments"]],
                ending_question=script_data["ending_question"],
                retention_analysis=script_data["retention_analysis"],
                viral_score=script_data["viral_score"],
                viral_score_explanation=script_data["viral_score_explanation"],
            )
        scenes = [Scene(**s) for s in data.get("scenes", [])]
        prompts = [ScenePrompts(**p) for p in data.get("prompts", [])]
        thumbnail = ThumbnailPackage(**data["thumbnail"]) if data.get("thumbnail") else None
        seo = SeoPackage(**data["seo"]) if data.get("seo") else None
        captions = [CaptionCue(**c) for c in data.get("captions", [])]
        return Project(
            id=project_id,
            topic=data["topic"],
            created_at=created_at,
            script=script,
            scenes=scenes,
            prompts=prompts,
            thumbnail=thumbnail,
            seo=seo,
            captions=captions,
            voiceover_path=data.get("voiceover_path"),
        )


def _fmt_time(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(round(seconds - minutes * 60))
    return f"{minutes}:{secs:02d}"
