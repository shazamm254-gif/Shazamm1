import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { BlackHole, calculateBlackHoleMetadata, FPS } from "./shorts/BlackHole";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={60}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="BlackHole"
        component={BlackHole}
        calculateMetadata={calculateBlackHoleMetadata}
        durationInFrames={1}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ voFrames: 0, endFrames: 0 }}
      />
    </>
  );
};
