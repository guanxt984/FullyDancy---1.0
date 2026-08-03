import { useState } from "react";
import { BuiltInLevelStep } from "../components/BuiltInLevelStep";
import { HomeScreen } from "../components/HomeScreen";
import { LevelSelectScreen } from "../components/LevelSelectScreen";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import type { PrototypeScreen } from "./prototypeFlow";

const preparingCopy = "\u6b63\u5728\u51c6\u5907\u5361\u70b9\u5206\u6790\u2026";

export function App() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");
  const [isPreparingAnalysis, setIsPreparingAnalysis] = useState(false);

  if (screen === "level-select") {
    return <LevelSelectScreen level={BUILT_IN_LEVEL} onBack={() => setScreen("home")} onSelect={() => setScreen("analysis")} />;
  }

  if (screen === "analysis") {
    return (
      <main className="analysis-preview">
        <BuiltInLevelStep level={BUILT_IN_LEVEL} onAnalyze={() => setIsPreparingAnalysis(true)} />
        {isPreparingAnalysis ? <p role="status">{preparingCopy}</p> : null}
      </main>
    );
  }

  return <HomeScreen onStart={() => setScreen("level-select")} />;
}
