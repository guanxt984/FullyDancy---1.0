import { useState } from "react";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import { AnalysisScreen, type AnalysisResult } from "../components/AnalysisScreen";
import { CalibrationScreen } from "../components/CalibrationScreen";
import { ChallengeScreen } from "../components/ChallengeScreen";
import { HomeScreen } from "../components/HomeScreen";
import { LevelSelectScreen } from "../components/LevelSelectScreen";
import type { BeatPoint } from "../domain/types";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import { DEFAULT_BUILT_IN_CHART } from "../levels/defaultChart";
import type { PrototypeScreen } from "./prototypeFlow";

export function App() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");
  const [chart, setChart] = useState<BeatPoint[]>([]);
  const [demoPoseCache, setDemoPoseCache] = useState<DemoPoseCache>([]);

  function acceptAnalysis(result: AnalysisResult) {
    setChart(result.chart);
    setDemoPoseCache(result.poseCache);
    setScreen("calibration");
  }

  function skipAnalysis(result: AnalysisResult | null) {
    setChart(result?.chart.length ? result.chart : DEFAULT_BUILT_IN_CHART);
    setDemoPoseCache(result?.poseCache ?? []);
    setScreen("calibration");
  }

  if (screen === "level-select") {
    return <LevelSelectScreen level={BUILT_IN_LEVEL} onBack={() => setScreen("home")} onSelect={() => setScreen("analysis")} onSkip={() => setScreen("analysis")} />;
  }

  if (screen === "analysis") {
    return (
      <AnalysisScreen
        level={BUILT_IN_LEVEL}
        onBack={() => setScreen("level-select")}
        onConfirm={acceptAnalysis}
        onSkip={skipAnalysis}
      />
    );
  }

  if (screen === "calibration") {
    return <CalibrationScreen chartCount={chart.length} onComplete={() => setScreen("challenge")} onSkip={() => setScreen("challenge")} />;
  }

  if (screen === "challenge") {
    return <ChallengeScreen level={BUILT_IN_LEVEL} chart={chart} initialPoseCache={demoPoseCache} onBack={() => setScreen("calibration")} />;
  }

  return <HomeScreen onStart={() => setScreen("level-select")} onSkip={() => setScreen("level-select")} />;
}
