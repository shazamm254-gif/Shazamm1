import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Short #1 from docs/FIRST_10_SHORTS.md — "Falling Into a Black Hole"
export const FPS = 30;
export const HOOK_FRAMES = FPS * 2; // 0-2s hook
export const END_FRAMES = FPS * 3; // last 3s
export const TOTAL_FRAMES = FPS * 30; // ~30s Short

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

export const BlackHole: React.FC = () => {
  return (
    <AbsoluteFill>
      <DriftingVoid />
      <Sequence from={0} durationInFrames={HOOK_FRAMES} name="Hook">
        <CaptionCard text="INTO THE BLACK" />
      </Sequence>
      <Sequence
        from={TOTAL_FRAMES - END_FRAMES}
        durationInFrames={END_FRAMES}
        name="End card"
      >
        <CaptionCard text="…and from outside, you're still falling." />
      </Sequence>
    </AbsoluteFill>
  );
};
