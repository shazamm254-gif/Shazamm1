import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
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
// pure black." Images are AI-generated stills matching the shot list in
// product/cosmic-ai-prompt-pack/SHOT-LISTS.md (shots #1/#3 and #2); shot #4
// ("pure black, faint glow") is just the fade-to-black itself.
export const FPS = 30;
const HOOK_FRAMES = FPS * 2; // "INTO THE BLACK" card overlays the first 2s of the VO
const TAIL_PAD_FRAMES = FPS * 0.5; // let the end card linger a beat after the audio ends

const VO_AUDIO = "audio/vo.wav";
const END_AUDIO = "audio/end.wav";
const DISK_IMAGE = "images/black-hole-disk.jpg";
const SILHOUETTE_IMAGE = "images/stretching-silhouette.jpg";

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

const KenBurns: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ voFrames: number }> = ({ voFrames }) => {
  const frame = useCurrentFrame();
  // Crossfade from the wide accretion-disk shot to the stretching silhouette
  // as the VO reaches the spaghettification line.
  const silhouetteOpacity = interpolate(
    frame,
    [voFrames * 0.28, voFrames * 0.38],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const blackOpacity = interpolate(frame, [voFrames * 0.88, voFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <KenBurns src={DISK_IMAGE} />
      <AbsoluteFill style={{ opacity: silhouetteOpacity }}>
        <KenBurns src={SILHOUETTE_IMAGE} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "black", opacity: blackOpacity }} />
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
