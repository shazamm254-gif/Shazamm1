"""Exporter — writes a complete Project to a production-ready folder tree:

Project/
  Script.md
  Images/            one .txt AI image prompt per scene
  Video Prompts/     one .txt image-to-video prompt per scene
  Voiceover/         the generated audio file (if any) + the plain VO script
  Captions/          captions.srt, captions.txt, captions.ass
  Thumbnail/         thumbnail.txt (concept, prompt, text options, why-click)
  SEO/               seo.md (titles, description, hashtags, keywords)
  Assets/            empty — drop AI-generated images/video here as you make them

Also zips the whole folder so the Gradio UI can offer a single download.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from core.config import PROJECTS_DIR
from core.models import Project
from generators.caption_generator import to_ass, to_srt, to_txt


def slugify(text: str, max_length: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_length] or "untitled-short"


def export_project(project: Project, voiceover_source: Path | None = None) -> Path:
    """Write the project to `PROJECTS_DIR/<slug>/` and return that folder's path."""
    if project.script is None:
        raise ValueError("Project has no generated script yet — nothing to export.")

    folder_name = f"{project.id or 'draft'}-{slugify(project.script.title)}"
    root = PROJECTS_DIR / folder_name
    if root.exists():
        shutil.rmtree(root)

    images_dir = root / "Images"
    video_prompts_dir = root / "Video Prompts"
    voiceover_dir = root / "Voiceover"
    captions_dir = root / "Captions"
    thumbnail_dir = root / "Thumbnail"
    seo_dir = root / "SEO"
    assets_dir = root / "Assets"
    for d in (images_dir, video_prompts_dir, voiceover_dir, captions_dir, thumbnail_dir, seo_dir, assets_dir):
        d.mkdir(parents=True, exist_ok=True)

    _write_script_md(root, project)
    _write_scene_prompts(images_dir, video_prompts_dir, project)
    _write_voiceover(voiceover_dir, project, voiceover_source)
    _write_captions(captions_dir, project)
    _write_thumbnail(thumbnail_dir, project)
    _write_seo(seo_dir, project)
    (assets_dir / "README.txt").write_text(
        "Drop your AI-generated images and animated video clips here as you "
        "produce them, in scene order (e.g. scene_01.png, scene_01.mp4, ...).\n",
        encoding="utf-8",
    )

    return root


def zip_project(project_folder: Path) -> Path:
    archive_base = str(project_folder)
    archive_path = shutil.make_archive(archive_base, "zip", root_dir=project_folder)
    return Path(archive_path)


# ---------------------------------------------------------------------------
# Section writers
# ---------------------------------------------------------------------------

def _write_script_md(root: Path, project: Project) -> None:
    script = project.script
    assert script is not None
    lines = [
        f"# {script.title}",
        "",
        f"**Topic:** {project.topic}",
        f"**Total duration:** {script.total_duration_seconds:.0f}s",
        f"**Viral score:** {script.viral_score}/100 — {script.viral_score_explanation}",
        "",
        "## Hooks (10 options)",
        "",
    ]
    lines += [f"{i}. {hook}" for i, hook in enumerate(script.hooks, start=1)]
    lines += ["", "## Script", ""]
    for seg in script.segments:
        lines += [f"**{seg.timestamp_label}**", "", seg.text, ""]
    lines += [
        "## Ending / comment-bait question",
        "",
        script.ending_question,
        "",
        "## Retention analysis",
        "",
        script.retention_analysis,
        "",
    ]

    if project.scenes:
        lines += ["## Scene breakdown", ""]
        lines += [
            "| # | Timestamp | Narration | Visual | Camera Angle | Camera Movement | "
            "Lighting | Mood | Transition | Sound Effect |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for s in project.scenes:
            lines.append(
                f"| {s.number} | {s.timestamp_label} | {s.narration} | {s.visual} | "
                f"{s.camera_angle} | {s.camera_movement} | {s.lighting} | {s.mood} | "
                f"{s.transition} | {s.sound_effect} |"
            )
        lines.append("")

    (root / "Script.md").write_text("\n".join(lines), encoding="utf-8")


def _write_scene_prompts(images_dir: Path, video_dir: Path, project: Project) -> None:
    for p in project.prompts:
        num = f"{p.scene_number:02d}"
        (images_dir / f"scene_{num}.txt").write_text(p.image_prompt + "\n", encoding="utf-8")
        (video_dir / f"scene_{num}.txt").write_text(p.video_prompt + "\n", encoding="utf-8")


def _write_voiceover(voiceover_dir: Path, project: Project, voiceover_source: Path | None) -> None:
    if project.script is not None:
        (voiceover_dir / "voiceover_script.txt").write_text(
            project.script.full_narration + "\n", encoding="utf-8"
        )
    source = voiceover_source or (Path(project.voiceover_path) if project.voiceover_path else None)
    if source and source.exists():
        shutil.copy2(source, voiceover_dir / source.name)


def _write_captions(captions_dir: Path, project: Project) -> None:
    if not project.captions:
        return
    (captions_dir / "captions.srt").write_text(to_srt(project.captions), encoding="utf-8")
    (captions_dir / "captions.txt").write_text(to_txt(project.captions), encoding="utf-8")
    (captions_dir / "captions.ass").write_text(to_ass(project.captions), encoding="utf-8")


def _write_thumbnail(thumbnail_dir: Path, project: Project) -> None:
    if project.thumbnail is None:
        return
    t = project.thumbnail
    text = (
        f"CONCEPT\n{t.concept}\n\n"
        f"AI IMAGE PROMPT\n{t.prompt}\n\n"
        f"TEXT OPTIONS\n" + "\n".join(f"- {opt}" for opt in t.text_options) + "\n\n"
        f"WHY PEOPLE WOULD CLICK\n{t.click_reason}\n"
    )
    (thumbnail_dir / "thumbnail.txt").write_text(text, encoding="utf-8")


def _write_seo(seo_dir: Path, project: Project) -> None:
    if project.seo is None:
        return
    seo = project.seo
    lines = ["# SEO Package", "", "## Titles", ""]
    lines += [f"{i}. {t}" for i, t in enumerate(seo.titles, start=1)]
    lines += ["", "## Description", "", seo.description, ""]
    lines += ["## Hashtags", "", " ".join(seo.hashtags), ""]
    lines += ["## Keywords", ""]
    lines += [f"- {k}" for k in seo.keywords]
    (seo_dir / "seo.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
