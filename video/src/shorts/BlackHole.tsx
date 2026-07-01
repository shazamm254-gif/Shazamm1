import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

// Short #1 from docs/FIRST_10_SHORTS.md — "Falling Into a Black Hole"
// VISUALS: "Slow drift toward a black hole's glowing accretion disk → a figure
// stretching into a thin line → the disk warping light around it → cut to
// pure black." Built as code (SVG/CSS) since no image-gen API/key is
// available in this sandbox — swap for AI-generated frames from
// product/cosmic-ai-prompt-pack later if you want a different look.
export const FPS = 30;
const HOOK_FRAMES = FPS * 2; // "INTO THE BLACK" card overlays the first 2s of the VO
const TAIL_PAD_FRAMES = FPS * 0.5; // let the end card linger a beat after the audio ends
const NUM_STARS = 120;

const VO_AUDIO = "audio/vo.wav";
const END_AUDIO = "audio/end.wav";

type BlackHoleProps = {
  voFrames: number;
  endFrames: number;
};

export const calculateBlackHoleMetadata = async () => {
  const [voSeconds, endSeconds] = await Promise.all([
    getAudioDurationInSeconds(staticFile(VO_AUDIO)),
    getAudioDurationInSeconds(staticFile(END_AUDIO)),
  ]);

  const voFrames = Math.ceil(voSeconds * FPS);
  const endFrames = Math.ceil(endSeconds * FPS) + TAIL_PAD_FRAMES;

  return {
    durationInFrames: voFrames + endFrames,
    props: { voFrames, endFrames },
  };
};

const Starfield: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = useMemo(
    () =>
      new Array(NUM_STARS).fill(0).map((_, i) => ({
        x: random(`star-x-${i}`) * 100,
        y: random(`star-y-${i}`) * 100,
        r: 0.15 + random(`star-r-${i}`) * 0.35,
        phase: random(`star-phase-${i}`) * Math.PI * 2,
      })),
    [],
  );

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {stars.map((s, i) => {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frame / 40 + s.phase));
        return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={twinkle} />;
      })}
    </svg>
  );
};

const AccretionDisk: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = frame * 0.25;

  return (
    <svg
      viewBox="-100 -100 200 200"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <radialGradient id="diskGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7e0" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#ffb347" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#ff5b1f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff5b1f" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* accretion disk, tilted by continuous rotation */}
      <g transform={`rotate(${rotation})`}>
        <ellipse cx="0" cy="0" rx="95" ry="30" fill="url(#diskGlow)" />
        <ellipse
          cx="0"
          cy="0"
          rx="95"
          ry="30"
          fill="none"
          stroke="#fff7e0"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
      </g>
      {/* photon ring — gravitational lensing of light around the horizon */}
      <circle cx="0" cy="0" r="42" fill="none" stroke="#ffe9c7" strokeOpacity="0.6" strokeWidth="1" />
      {/* event horizon — absolute darkness on top of everything else */}
      <circle cx="0" cy="0" r="38" fill="#000000" />
    </svg>
  );
};

const Silhouette: React.FC<{ voFrames: number }> = ({ voFrames }) => {
  const frame = useCurrentFrame();
  const start = voFrames * 0.32;
  const end = voFrames * 0.82;
  const t = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleY = interpolate(t, [0, 1], [1, 10]);
  const scaleX = interpolate(t, [0, 1], [1, 0.1]);
  const opacity = interpolate(frame, [start, start + 20, end - 15, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 26,
          height: 70,
          borderRadius: 14,
          background: "linear-gradient(180deg, #050208, #000)",
          transform: `scaleY(${scaleY}) scaleX(${scaleX})`,
          opacity,
          boxShadow: "0 0 30px rgba(0,0,0,0.8)",
        }}
      />
    </AbsoluteFill>
  );
};

const FadeToBlack: React.FC<{ voFrames: number }> = ({ voFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [voFrames * 0.88, voFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <AbsoluteFill style={{ backgroundColor: "black", opacity }} />;
};

const Scene: React.FC<{ voFrames: number }> = ({ voFrames }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Slow drift toward the event horizon for the whole runtime.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.7], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Starfield />
        <AccretionDisk />
        <Silhouette voFrames={voFrames} />
      </AbsoluteFill>
      <FadeToBlack voFrames={voFrames} />
    </AbsoluteFill>
  );
};

const CaptionCard: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(
    frame,
    [0, 5, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${pop})`,
          fontFamily: "sans-serif",
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.15,
          textAlign: "center",
          color: "white",
          textShadow: "0 0 40px rgba(120,80,255,0.8)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const BlackHole: React.FC<BlackHoleProps> = ({ voFrames, endFrames }) => {
  return (
    <AbsoluteFill>
      <Scene voFrames={voFrames} />
      <Sequence from={0} durationInFrames={voFrames} name="VO">
        <Audio src={staticFile(VO_AUDIO)} />
      </Sequence>
      <Sequence from={voFrames} durationInFrames={endFrames} name="End VO">
        <Audio src={staticFile(END_AUDIO)} />
      </Sequence>
      <Sequence from={0} durationInFrames={HOOK_FRAMES} name="Hook">
        <CaptionCard text="INTO THE BLACK" />
      </Sequence>
      <Sequence from={voFrames} durationInFrames={endFrames} name="End card">
        <CaptionCard text="…and from outside, you're still falling." />
      </Sequence>
    </AbsoluteFill>
  );
};
