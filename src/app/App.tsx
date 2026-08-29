import { useEffect, useRef, useState } from "react";
import { AnalysisScreen, type AnalysisResult } from "../components/AnalysisScreen";
import { CalibrationScreen } from "../components/CalibrationScreen";
import { ChallengeScreen } from "../components/ChallengeScreen";
import { HomeScreen } from "../components/HomeScreen";
import { LevelSelectScreen } from "../components/LevelSelectScreen";
import type { BeatPoint } from "../domain/types";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import { DEFAULT_BUILT_IN_CHART } from "../levels/defaultChart";
import type { SharedCameraSession } from "../pose/camera";
import type { PrototypeScreen } from "./prototypeFlow";

export function App() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");
  const [chart, setChart] = useState<BeatPoint[]>([]);
  const [cameraSession, setCameraSession] = useState<SharedCameraSession | null>(null);
  const cameraSessionRef = useRef<SharedCameraSession | null>(null);

  function ownCameraSession(nextSession: SharedCameraSession | null) {
    const previousSession = cameraSessionRef.current;
    if (previousSession === nextSession) return;
    cameraSessionRef.current = nextSession;
    setCameraSession(nextSession);
    previousSession?.stop();
  }

  useEffect(() => () => {
    const currentSession = cameraSessionRef.current;
    cameraSessionRef.current = null;
    currentSession?.stop();
  }, []);

  function acceptAnalysis(result: AnalysisResult) {
    setChart(result.chart);
    setScreen("calibration");
  }

  function skipAnalysis(result: AnalysisResult | null) {
    setChart(result?.chart.length ? result.chart : DEFAULT_BUILT_IN_CHART);
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
    return (
      <CalibrationScreen
        chartCount={chart.length}
        cameraSession={cameraSession}
        onComplete={(_profile, transferredCamera) => {
          ownCameraSession(transferredCamera);
          setScreen("challenge");
        }}
        onSkip={(transferredCamera) => {
          ownCameraSession(transferredCamera);
          setScreen("challenge");
        }}
      />
    );
  }

  if (screen === "challenge") {
    return (
      <ChallengeScreen
        level={BUILT_IN_LEVEL}
        chart={chart}
        cameraSession={cameraSession}
        onBack={() => setScreen("calibration")}
      />
    );
  }

  return <HomeScreen onStart={() => setScreen("level-select")} onSkip={() => setScreen("level-select")} />;
}
