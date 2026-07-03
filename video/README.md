# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Generate narration**

Renders `scripts/narration.txt` to `public/assets/narration.mp3` using the
[`edge-tts`](https://github.com/rany2/edge-tts) Python package (free,
Microsoft Edge's TTS voices — no API key, no Docker). Installs `edge-tts`
automatically via `pip` if it isn't already on your PATH.

```console
npm run narrate
```

Uses voice `en-US-AndrewNeural` at `--rate=-8%` for a calm, deliberate,
deadpan read rather than an excited-announcer tone. To use a different
voice or rate, edit `scripts/narrate.sh`. To change what gets narrated,
edit `scripts/narration.txt` and rerun `npm run narrate`.

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
