Drop reusable stock frames here (.jpg/.jpeg/.png, any resolution — they get
cropped to the configured 9:16 output size automatically).

If FLUX image generation fails for a scene after 3 retries, `run.py` falls
back to the next unused file in this folder instead of stopping the run. Add
a handful of on-theme frames (courthouse, prison corridor, case-file desk,
noir cityscape) so a failed scene never leaves a gap.
