import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

// Short #1 from docs/FIRST_10_SHORTS.md — "Falling Into a Black Hole"
export const FPS = 30;
const HOOK_FRAMES = FPS * 2; // "INTO THE BLACK" card overlays the first 2s of the VO
const TAIL_PAD_FRAMES = FPS * 0.5; // let the end card linger a beat after the audio ends

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

const DriftingVoid: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Slow drift toward the "event horizon" for the whole runtime.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.6], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          background:
            "radial-gradient(circle at 50% 50%, #3a2a5c 0%, #150f2b 35%, #05030a 65%, #000000 100%)",
        }}
      />
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
      <DriftingVoid />
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
