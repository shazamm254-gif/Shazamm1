#!/usr/bin/env python3
"""
Write a ShortsCaptioner transcript JSON using pocketsphinx instead of Whisper.

ShortsCaptioner transcribes with faster-whisper, which fetches its weights from
HuggingFace on first run. That host is blocked by this environment's proxy
(403), so the model cannot load here. The tool's three stages are independent
by design and app.py will LOAD a --transcript json if the file already exists,
so this fills that file from an offline recogniser and the renderer never
knows the difference.

On a normal machine you do not need this: just run app.py and let Whisper do
it, which will also be markedly more accurate on proper nouns.
"""
import json, os, subprocess, sys

def words_from(audio):
    from pocketsphinx import Config, Decoder
    import pocketsphinx
    wav = "/tmp/_sx16k.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ar", "16000",
                    "-ac", "1", "-y", wav], check=True)
    m = os.path.join(os.path.dirname(pocketsphinx.__file__), "model", "en-us")
    c = Config()
    c.set_string("-hmm", os.path.join(m, "en-us"))
    c.set_string("-lm", os.path.join(m, "en-us.lm.bin"))
    c.set_string("-dict", os.path.join(m, "cmudict-en-us.dict"))
    c.set_string("-logfn", os.devnull)
    d = Decoder(c)
    d.start_utt()
    d.process_raw(open(wav, "rb").read(), full_utt=True)
    d.end_utt()
    skip = {"<s>", "</s>", "<sil>", "[SPEECH]", "[NOISE]", "<unk>"}
    out = []
    for s in d.seg():
        w = s.word.split("(")[0]
        if w in skip:
            continue
        out.append({"text": w, "start": s.start_frame / 100.0,
                    "end": s.end_frame / 100.0, "probability": 1.0})
    return out

if __name__ == "__main__":
    audio, out = sys.argv[1], sys.argv[2]
    words = words_from(audio)
    json.dump({"version": 1, "words": words}, open(out, "w"), indent=2)
    print(f"{len(words)} words -> {out}")
