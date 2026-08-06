import { useState } from "react";
import { AnalysisScreen } from "../components/AnalysisScreen";
import { HomeScreen } from "../components/HomeScreen";
import { LevelSelectScreen } from "../components/LevelSelectScreen";
import type { BeatPoint } from "../domain/types";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import type { PrototypeScreen } from "./prototypeFlow";

const calibrationTitle = "\u8eab\u4f53\u6821\u51c6";
const calibrationCopyStart = "\u5df2\u786e\u8ba4";
const calibrationCopyEnd = "\u4e2a\u5361\u70b9\uff0c\u4e0b\u4e00\u6b65\u5c06\u6253\u5f00\u6444\u50cf\u5934\u8fdb\u884c\u81ea\u52a8\u6821\u51c6\u3002";

export function App() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");
  const [chart, setChart] = useState<BeatPoint[]>([]);

  if (screen === "level-select") {
    return <LevelSelectScreen level={BUILT_IN_LEVEL} onBack={() => setScreen("home")} onSelect={() => setScreen("analysis")} />;
  }

  if (screen === "analysis") {
    return (
      <AnalysisScreen
        level={BUILT_IN_LEVEL}
        onBack={() => setScreen("level-select")}
        onConfirm={(confirmedChart) => {
          setChart(confirmedChart);
          setScreen("calibration");
        }}
      />
    );
  }

  if (screen === "calibration") {
    return (
      <main className="calibration-placeholder">
        <span className="stage-brand">FullyDancy</span>
        <h1>{calibrationTitle}</h1>
        <p>{calibrationCopyStart} {chart.length} {calibrationCopyEnd}</p>
      </main>
    );
  }

  return <HomeScreen onStart={() => setScreen("level-select")} />;
}
