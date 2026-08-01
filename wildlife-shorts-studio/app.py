"""Wild Secrets Studio — a free, faceless AI wildlife Shorts production app.

Enter a wildlife topic. Get a complete 45-60s Short production package:
title, hooks, timestamped script, scene breakdown, AI image + image-to-video
prompts, thumbnail, SEO, captions, and an optional local/free voiceover —
all exportable as one folder.

Run with:  python app.py
"""

from __future__ import annotations

from pathlib import Path

import gradio as gr

from core.config import (
    CHANNEL_NAME,
    OLLAMA_HOST,
    OLLAMA_MODEL,
    OPENROUTER_MODEL,
    PROJECTS_DIR,
)
from core.database import (
    count_projects,
    get_analytics,
    get_project,
    init_db,
    list_projects,
    save_project,
)
from core.models import Project, Scene, ScenePrompts, ScriptResult, SeoPackage, ThumbnailPackage
from export.exporter import export_project, zip_project
from generators.caption_generator import generate_captions
from generators.llm_client import LLMClient
from generators.prompt_generator import generate_scene_prompts, generate_thumbnail
from generators.scene_generator import generate_scenes
from generators.script_generator import generate_script
from generators.seo_generator import generate_seo
from voiceover.tts_engine import list_edge_voices, list_engines, synthesize

# ---------------------------------------------------------------------------
# Topic templates (the "Templates" dashboard module) — one per niche pillar
# ---------------------------------------------------------------------------

TOPIC_TEMPLATES = [
    "Crows remember human faces for years",
    "The Pompeii worm survives boiling water on one end of its body",
    "Wood frogs freeze solid every winter and thaw back to life",
    "Ophiocordyceps fungus hijacks a living ant's muscles",
    "Greenland sharks can live for nearly 400 years",
    "Peregrine falcons dive at over 240 miles per hour",
    "Orcas teach their young a wave-hunting technique",
    "Harris's hawks hunt cooperatively like a wolf pack",
    "Bowerbirds build an optical illusion to attract a mate",
    "A giant Pacific octopus mother starves herself to guard her eggs",
]


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def _build_llm_client(
    backend: str, ollama_host: str, ollama_model: str, openrouter_key: str, openrouter_model: str
) -> LLMClient:
    return LLMClient(
        backend=backend,
        ollama_host=ollama_host or OLLAMA_HOST,
        ollama_model=ollama_model or OLLAMA_MODEL,
        openrouter_api_key=openrouter_key or "",
        openrouter_model=openrouter_model or OPENROUTER_MODEL,
    )


def run_pipeline(topic: str, llm: LLMClient) -> Project:
    script = generate_script(topic, llm)
    scenes = generate_scenes(script, llm)
    prompts = generate_scene_prompts(script.topic, scenes, llm)
    thumbnail = generate_thumbnail(script.topic, scenes, llm)
    seo = generate_seo(script.topic, script.title, llm)
    captions = generate_captions(script)

    project = Project(
        id=None,
        topic=script.topic,
        created_at="",
        script=script,
        scenes=scenes,
        prompts=prompts,
        thumbnail=thumbnail,
        seo=seo,
        captions=captions,
    )
    project.id = save_project(project)
    return project


# ---------------------------------------------------------------------------
# Rendering helpers (Project -> Gradio component values)
# ---------------------------------------------------------------------------

def _hooks_markdown(hooks: list[str]) -> str:
    return "\n".join(f"{i}. {h}" for i, h in enumerate(hooks, start=1))


def _script_rows(script: ScriptResult) -> list[list[str]]:
    return [[seg.timestamp_label, seg.text] for seg in script.segments]


def _scenes_rows(scenes: list[Scene]) -> list[list[str]]:
    return [
        [
            s.number, s.timestamp_label, s.narration, s.visual, s.camera_angle,
            s.camera_movement, s.lighting, s.mood, s.transition, s.sound_effect,
        ]
        for s in scenes
    ]


def _image_prompts_markdown(prompts: list[ScenePrompts]) -> str:
    return "\n\n".join(
        f"**Scene {p.scene_number} — AI Image Prompt**\n\n```\n{p.image_prompt}\n```" for p in prompts
    )


def _video_prompts_markdown(prompts: list[ScenePrompts]) -> str:
    return "\n\n".join(
        f"**Scene {p.scene_number} — Image-to-Video Prompt**\n\n```\n{p.video_prompt}\n```" for p in prompts
    )


def _thumbnail_markdown(thumb: ThumbnailPackage) -> str:
    text_opts = "\n".join(f"- {t}" for t in thumb.text_options)
    return (
        f"**Concept**\n\n{thumb.concept}\n\n"
        f"**AI Image Prompt**\n\n```\n{thumb.prompt}\n```\n\n"
        f"**Text options**\n\n{text_opts}\n\n"
        f"**Why people would click**\n\n{thumb.click_reason}"
    )


def _seo_markdown(seo: SeoPackage) -> str:
    titles = "\n".join(f"{i}. {t}" for i, t in enumerate(seo.titles, start=1))
    keywords = ", ".join(seo.keywords)
    return (
        f"**Titles**\n\n{titles}\n\n"
        f"**Description**\n\n{seo.description}\n\n"
        f"**Hashtags**\n\n{' '.join(seo.hashtags)}\n\n"
        f"**Keywords**\n\n{keywords}"
    )


def _retention_markdown(script: ScriptResult) -> str:
    return (
        f"### Viral score: {script.viral_score}/100\n\n{script.viral_score_explanation}\n\n"
        f"**Retention analysis**\n\n{script.retention_analysis}\n\n"
        f"**Ending question:** {script.ending_question}"
    )


_EMPTY_OUTPUTS = (
    None, "", "", [], [], "", "", "", "", "", "Generate or load a Short to see it here.",
)


def _render(project: Project) -> tuple:
    script = project.script
    return (
        project,
        script.title,
        _hooks_markdown(script.hooks),
        _script_rows(script),
        _scenes_rows(project.scenes),
        _image_prompts_markdown(project.prompts),
        _video_prompts_markdown(project.prompts),
        _thumbnail_markdown(project.thumbnail),
        _seo_markdown(project.seo),
        _retention_markdown(script),
        f"✅ Saved as project #{project.id} — {script.total_duration_seconds:.0f}s runtime.",
    )


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def on_generate(topic, backend, ollama_host, ollama_model, openrouter_key, openrouter_model):
    if not topic or not topic.strip():
        raise gr.Error("Enter a wildlife topic first.")
    llm = _build_llm_client(backend, ollama_host, ollama_model, openrouter_key, openrouter_model)
    project = run_pipeline(topic.strip(), llm)
    return _render(project)


def on_load_project(project_id_text):
    if not project_id_text:
        raise gr.Error("Enter a project ID from the Dashboard list.")
    try:
        project_id = int(project_id_text)
    except ValueError:
        raise gr.Error("Project ID must be a number.")
    project = get_project(project_id)
    if project is None or project.script is None:
        raise gr.Error(f"No project found with ID {project_id}.")
    return _render(project)


def on_refresh_dashboard():
    rows = list_projects()
    analytics = get_analytics()
    stats_md = (
        f"**Total projects:** {analytics['total_projects']}  \n"
        f"**Average viral score:** {analytics['average_viral_score']}/100  \n"
        f"**Most recent topic:** {analytics['most_recent_topic']}"
    )
    table = [[r["id"], r["topic"], r["title"], r["updated_at"]] for r in rows]
    return stats_md, table


def on_check_llm(backend, ollama_host, ollama_model, openrouter_key, openrouter_model):
    llm = _build_llm_client(backend, ollama_host, ollama_model, openrouter_key, openrouter_model)
    if llm.is_available():
        return f"✅ '{backend}' backend is ready."
    if backend == "ollama":
        return f"⚠️ Can't reach Ollama at {llm.ollama_host}. Is `ollama serve` running?"
    if backend == "openrouter":
        return "⚠️ No OpenRouter API key set."
    return "✅ Offline mode is always ready (no install needed)."


def on_refresh_engines():
    statuses = list_engines()
    choices = [(f"{s.label} — {'✅ Ready' if s.available else '⚠️ ' + s.detail}", s.key) for s in statuses]
    return gr.update(choices=choices, value=choices[0][1] if choices else None)


def on_generate_voiceover(project: Project | None, engine: str, voice: str):
    if project is None or project.script is None:
        raise gr.Error("Generate or load a Short in the Create Short tab first.")
    text = project.script.full_narration
    out_dir = PROJECTS_DIR / "_voiceover_previews"
    out_path = out_dir / f"project_{project.id or 'draft'}_voiceover"
    try:
        result_path = synthesize(text, engine, out_path, voice=voice or None)
    except (RuntimeError, ValueError) as exc:
        raise gr.Error(str(exc))

    project.voiceover_path = str(result_path)
    save_project(project)
    return project, str(result_path), str(result_path), f"✅ Voiceover saved to `{result_path}`."


def on_export(project: Project | None):
    if project is None or project.script is None:
        raise gr.Error("Generate or load a Short in the Create Short tab first.")
    voiceover_source = Path(project.voiceover_path) if project.voiceover_path else None
    folder = export_project(project, voiceover_source=voiceover_source)
    zip_path = zip_project(folder)
    return str(zip_path), f"✅ Exported to `{folder}`\n\nDownload the zip below."


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

_DARK_CSS = """
:root, body { color-scheme: dark; }
.gradio-container { background: #0f1115 !important; max-width: 1200px !important; }
#title_banner { text-align: center; padding: 0.5rem 0 1rem 0; }
button.primary, .primary { font-size: 1.05rem !important; padding: 0.8rem 1.4rem !important; border-radius: 10px !important; }
.gr-button { border-radius: 10px !important; }
.tabitem { padding-top: 0.75rem; }
"""

_FORCE_DARK_JS = """
function forceDarkTheme() {
    const url = new URL(window.location);
    if (url.searchParams.get('__theme') !== 'dark') {
        url.searchParams.set('__theme', 'dark');
        window.location.href = url.href;
    }
}
"""


def build_app() -> gr.Blocks:
    init_db()

    with gr.Blocks(title=f"{CHANNEL_NAME} Studio") as demo:
        demo.load(js=_FORCE_DARK_JS)

        project_state = gr.State(None)

        gr.Markdown(
            f"# 🦉 {CHANNEL_NAME} Studio\n"
            "Faceless AI wildlife YouTube Shorts, from one topic to a full production package. "
            "100% free by default — no API key required.",
            elem_id="title_banner",
        )

        with gr.Tabs():
            # ---------------------------------------------------------
            # Dashboard
            # ---------------------------------------------------------
            with gr.Tab("📊 Dashboard"):
                gr.Markdown("### Analytics")
                stats_md = gr.Markdown("Click Refresh to load stats.")
                refresh_btn = gr.Button("🔄 Refresh", variant="primary")

                gr.Markdown("### Recent Shorts")
                projects_table = gr.Dataframe(
                    headers=["ID", "Topic", "Title", "Last updated"],
                    datatype=["number", "str", "str", "str"],
                    interactive=False,
                    wrap=True,
                )

                gr.Markdown("### Load a project")
                with gr.Row():
                    load_id_box = gr.Textbox(label="Project ID", scale=1)
                    load_btn = gr.Button("📂 Load into Create Short tab", variant="primary", scale=2)

                gr.Markdown(
                    "### Templates\n"
                    "Ready-made topics across the channel's five pillars — copy one into "
                    "the Create Short tab, or pick it from the examples there.\n\n"
                    + "\n".join(f"- {t}" for t in TOPIC_TEMPLATES)
                )

            # ---------------------------------------------------------
            # Create Short
            # ---------------------------------------------------------
            with gr.Tab("✨ Create Short"):
                with gr.Row():
                    topic_box = gr.Textbox(
                        label="Wildlife topic",
                        placeholder="e.g. Crows remember human faces",
                        scale=3,
                    )
                    generate_btn = gr.Button("🪄 Generate Full Package", variant="primary", scale=1)

                gr.Examples(examples=TOPIC_TEMPLATES, inputs=topic_box, label="Templates")

                with gr.Accordion("⚙️ LLM backend (optional — offline works with zero setup)", open=False):
                    backend_radio = gr.Radio(
                        choices=[
                            ("Offline (free, no install, default)", "offline"),
                            ("Ollama (free, local model server)", "ollama"),
                            ("OpenRouter (optional, hosted, needs API key)", "openrouter"),
                        ],
                        value="offline",
                        label="Backend",
                    )
                    with gr.Row():
                        ollama_host_box = gr.Textbox(label="Ollama host", value=OLLAMA_HOST)
                        ollama_model_box = gr.Textbox(label="Ollama model", value=OLLAMA_MODEL)
                    with gr.Row():
                        openrouter_key_box = gr.Textbox(label="OpenRouter API key", type="password")
                        openrouter_model_box = gr.Textbox(label="OpenRouter model", value=OPENROUTER_MODEL)
                    check_llm_btn = gr.Button("Check backend status")
                    llm_status_md = gr.Markdown("")

                status_md = gr.Markdown("Generate or load a Short to see it here.")

                with gr.Accordion("🎬 Title & Hooks", open=True):
                    title_box = gr.Textbox(label="Title", interactive=False)
                    hooks_md = gr.Markdown()

                with gr.Accordion("📝 Script (timestamped)", open=True):
                    script_df = gr.Dataframe(headers=["Timestamp", "Narration"], interactive=False, wrap=True)

                with gr.Accordion("🎥 Scene Breakdown", open=False):
                    scenes_df = gr.Dataframe(
                        headers=[
                            "#", "Timestamp", "Narration", "Visual", "Camera Angle",
                            "Camera Movement", "Lighting", "Mood", "Transition", "Sound Effect",
                        ],
                        interactive=False,
                        wrap=True,
                    )

                with gr.Accordion("🖼️ AI Image Prompts", open=False):
                    image_prompts_md = gr.Markdown()

                with gr.Accordion("🎞️ Image-to-Video Prompts", open=False):
                    video_prompts_md = gr.Markdown()

                with gr.Accordion("🖱️ Thumbnail", open=False):
                    thumbnail_md = gr.Markdown()

                with gr.Accordion("🔎 SEO", open=False):
                    seo_md = gr.Markdown()

                with gr.Accordion("📈 Retention & Viral Score", open=False):
                    retention_md = gr.Markdown()

            # ---------------------------------------------------------
            # Voiceover
            # ---------------------------------------------------------
            with gr.Tab("🎙️ Voiceover"):
                gr.Markdown(
                    "Uses the Short currently loaded in **Create Short**. "
                    "Edge TTS is free and needs no install; Piper and Coqui/XTTS are free, "
                    "fully offline, but need a one-time local install."
                )
                engine_choices = [
                    (f"{s.label} — {'✅ Ready' if s.available else '⚠️ ' + s.detail}", s.key)
                    for s in list_engines()
                ]
                engine_dropdown = gr.Dropdown(
                    choices=engine_choices, value=engine_choices[0][1], label="TTS engine"
                )
                refresh_engines_btn = gr.Button("🔄 Re-check engine availability")
                voice_dropdown = gr.Dropdown(
                    choices=list_edge_voices(), value=list_edge_voices()[0],
                    label="Voice (Edge TTS only)",
                )
                voiceover_btn = gr.Button("🎙️ Generate Voiceover", variant="primary")
                voiceover_status_md = gr.Markdown("")
                voiceover_audio = gr.Audio(label="Preview", interactive=False)
                voiceover_file = gr.File(label="Download audio")

            # ---------------------------------------------------------
            # Export
            # ---------------------------------------------------------
            with gr.Tab("📦 Export"):
                gr.Markdown(
                    "Exports the Short currently loaded in **Create Short** to a full "
                    "production folder:\n\n"
                    "```\nProject/\n  Script.md\n  Images/\n  Video Prompts/\n  Voiceover/\n"
                    "  Captions/\n  Thumbnail/\n  SEO/\n  Assets/\n```"
                )
                export_btn = gr.Button("📦 Export Project", variant="primary")
                export_status_md = gr.Markdown("")
                export_file = gr.File(label="Download project (.zip)")

        # -----------------------------------------------------------------
        # Wiring
        # -----------------------------------------------------------------
        _create_outputs = [
            project_state, title_box, hooks_md, script_df, scenes_df,
            image_prompts_md, video_prompts_md, thumbnail_md, seo_md,
            retention_md, status_md,
        ]

        generate_btn.click(
            on_generate,
            inputs=[
                topic_box, backend_radio, ollama_host_box, ollama_model_box,
                openrouter_key_box, openrouter_model_box,
            ],
            outputs=_create_outputs,
        )

        check_llm_btn.click(
            on_check_llm,
            inputs=[backend_radio, ollama_host_box, ollama_model_box, openrouter_key_box, openrouter_model_box],
            outputs=[llm_status_md],
        )

        refresh_btn.click(on_refresh_dashboard, outputs=[stats_md, projects_table])
        demo.load(on_refresh_dashboard, outputs=[stats_md, projects_table])

        load_btn.click(on_load_project, inputs=[load_id_box], outputs=_create_outputs)

        refresh_engines_btn.click(on_refresh_engines, outputs=[engine_dropdown])

        voiceover_btn.click(
            on_generate_voiceover,
            inputs=[project_state, engine_dropdown, voice_dropdown],
            outputs=[project_state, voiceover_audio, voiceover_file, voiceover_status_md],
        )

        export_btn.click(on_export, inputs=[project_state], outputs=[export_file, export_status_md])

    return demo


if __name__ == "__main__":
    app = build_app()
    app.launch(theme=gr.themes.Base(primary_hue="emerald", neutral_hue="slate"), css=_DARK_CSS)
