# Idea → Script → Visuals → Assembly

The full production pipeline, end to end, for any niche in `tools/niche.json`
(or `niche-money.json`, `niche-dreams.json`, or one you generate yourself with
`tools/niche_generator.py`).

```
generate_ideas.py          niche_generator.py
   (hooks)                    (which niche?)
      \                          /
       v                        v
              tools/niche.json  <-- one config drives every tool
                      |
                      v
          tools/generate_script.py        --> script_<slug>.json
        (hook -> timed beats: VO,             (title, description, hook,
         on-screen text, shot list)             end_line, beats[on_screen,
                      |                          vo, visual, duration])
                      v
          tools/generate_visuals.py       --> script_<slug>_prompts.txt/json
        (beats -> AI image/video               (paste-ready prompts, styled
         generation prompts, on-brand)          to your niche's visual_style)
                      |
        [ you generate each shot in Midjourney / Runway / Kling / DALL-E /
          your tool of choice, save as shot_01.png, shot_02.png, ... ]
        [ optional: record/generate a voiceover track of the "vo" lines ]
                      |
                      v
          tools/assemble_video.py         --> short_<slug>.mp4
        (images + captions + voiceover         (final vertical 1080x1920
         + music -> ffmpeg render)               Short, Ken Burns + captions)
                      |
                      v
          tools/optimize_metadata.py      --> lint/rewrite title+description
                      |
                      v
                 publish, then
          tools/analyze_channel.py        --> what worked, when to post next
```

## 1. Pick or generate a niche

```bash
python tools/niche_generator.py -n 10          # explore/score niche ideas
```
Edit `tools/niche.json` (or point at `niche-money.json` / `niche-dreams.json`
/ your own file with `--niche-file`) — every tool below retunes from it.

## 2. Script it

```bash
python tools/generate_script.py --hook "This is what happens if you fall into a black hole."
python tools/generate_script.py --use-claude --series "Space Horror"
```

- Offline mode is instant and free — a rough 3-beat draft (hook / build /
  payoff) to block out timing and shot count. Expect to punch up the wording.
- `--use-claude` writes a full, on-voice script (3-6 beats) matching the
  quality bar of `docs/FIRST_10_SHORTS.md`.

Either way you get a `script_<slug>.json` with per-beat voiceover text,
on-screen captions, a one-line visual description per shot, and an
auto-computed duration for each beat (from word count at the niche's
narration pace).

## 3. Turn beats into visual prompts

```bash
python tools/generate_visuals.py --script tools/output/script_foo.json --tool midjourney
```

Appends your niche's `visual_style.style_suffix` (and, if the script has a
`series`, that series' style tag) to each beat's visual description, so every
shot in every Short stays visually on-brand — the same idea as
`product/cosmic-ai-prompt-pack/STYLE-GUIDE.md`, but generated per-script and
tuned to whichever niche you're running. `--use-claude` writes sharper,
more specific prompts instead of the template concatenation.

Generate each prompt in your image/video tool of choice and save the results
as `shot_01.png`, `shot_02.png`, ... (matching beat order, any common image
extension) in one folder.

## 4. Assemble the final video

```bash
python tools/assemble_video.py --script tools/output/script_foo.json \
    --images-dir ./shots --voiceover ./vo.mp3 --stretch-to-audio
```

Needs **ffmpeg** on your PATH (not a pip package — see `requirements.txt`).
No other video library required; it shells out to ffmpeg directly.

- Applies a subtle Ken Burns zoom to each shot for its beat's duration.
- Burns in the beat's on-screen caption, word-wrapped, lower-third, styled
  from `visual_style.caption_style`.
- Mixes in your voiceover (and, with `--music`, a ducked background bed).
- `--stretch-to-audio` rescales every beat's duration to match your real
  recorded voiceover length once you have final VO (the script's durations
  are only an estimate from word count until then).
- Missing shot images are filled with a plain color card from the niche's
  palette, so you can preview timing and captions before your art is ready.
- `--dry-run` prints the ffmpeg command instead of running it.

Output is a ready-to-upload vertical MP4 (1080x1920 @ 30fps by default).

## 5. Package and post

```bash
python tools/optimize_metadata.py --title "..." --use-claude
```

Then upload, and once you've got a few Shorts live:

```bash
python tools/analyze_channel.py --channel "@YourHandle"
```
