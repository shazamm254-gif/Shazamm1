"""Caption Generator — word-level timed captions from the script's segments,
exportable as SRT, TXT, and ASS (Advanced SubStation Alpha).

Timing: each ScriptSegment's duration is split proportionally across its
words (by character length, so short words don't get identical timing to
long ones), producing punchy 2-4 word caption cues suited to Shorts-style
burned-in captions rather than full-sentence subtitle blocks.
"""

from __future__ import annotations

from core.models import CaptionCue, ScriptResult

_WORDS_PER_CUE = 3


def generate_captions(script: ScriptResult, words_per_cue: int = _WORDS_PER_CUE) -> list[CaptionCue]:
    cues: list[CaptionCue] = []
    cue_index = 1

    for seg in script.segments:
        words = seg.text.split()
        if not words:
            continue

        seg_duration = seg.end_seconds - seg.start_seconds
        weights = [len(w) + 1 for w in words]  # +1 so 1-letter words still get real time
        total_weight = sum(weights)

        chunks: list[list[str]] = [
            words[i : i + words_per_cue] for i in range(0, len(words), words_per_cue)
        ]
        chunk_weights: list[int] = []
        wi = 0
        for chunk in chunks:
            chunk_weights.append(sum(weights[wi : wi + len(chunk)]))
            wi += len(chunk)

        cursor = seg.start_seconds
        for chunk, weight in zip(chunks, chunk_weights):
            duration = (weight / total_weight) * seg_duration if total_weight else 0
            start = cursor
            end = cursor + duration
            cues.append(
                CaptionCue(
                    index=cue_index,
                    start_seconds=round(start, 2),
                    end_seconds=round(end, 2),
                    text=" ".join(chunk),
                )
            )
            cue_index += 1
            cursor = end

    return cues


# ---------------------------------------------------------------------------
# Export formats
# ---------------------------------------------------------------------------

def to_srt(cues: list[CaptionCue]) -> str:
    lines = []
    for cue in cues:
        lines.append(str(cue.index))
        lines.append(f"{_srt_timestamp(cue.start_seconds)} --> {_srt_timestamp(cue.end_seconds)}")
        lines.append(cue.text)
        lines.append("")
    return "\n".join(lines)


def to_txt(cues: list[CaptionCue]) -> str:
    return "\n".join(cue.text for cue in cues)


def to_ass(cues: list[CaptionCue]) -> str:
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, "
        "BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\n"
        "Style: Default,Arial Black,90,&H00FFFFFF,&H00000000,&H64000000,"
        "1,4,0,8,60,60,180\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Text\n"
    )
    body_lines = [
        f"Dialogue: 0,{_ass_timestamp(cue.start_seconds)},{_ass_timestamp(cue.end_seconds)},"
        f"Default,,0,0,0,,{cue.text}"
        for cue in cues
    ]
    return header + "\n".join(body_lines) + "\n"


def _srt_timestamp(seconds: float) -> str:
    ms_total = int(round(seconds * 1000))
    hours, rem = divmod(ms_total, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def _ass_timestamp(seconds: float) -> str:
    cs_total = int(round(seconds * 100))  # centiseconds
    hours, rem = divmod(cs_total, 360_000)
    minutes, rem = divmod(rem, 6_000)
    secs, cs = divmod(rem, 100)
    return f"{hours:01d}:{minutes:02d}:{secs:02d}.{cs:02d}"
