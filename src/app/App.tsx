import { useState } from "react";
import { BuiltInLevelStep } from "../components/BuiltInLevelStep";
import { HomeScreen } from "../components/HomeScreen";
import { LevelSelectScreen } from "../components/LevelSelectScreen";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import type { PrototypeScreen } from "./prototypeFlow";

export function App() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");

  if (screen === "level-select") {
    return (
      <LevelSelectScreen
        level={BUILT_IN_LEVEL}
        onBack={() => setScreen("home")}
        onSelect={() => setScreen("analysis")}
      />
    );
  }

  if (screen === "analysis") {
    return (
      <main className="analysis-preview">
        <BuiltInLevelStep level={BUILT_IN_LEVEL} onAnalyze={() => undefined} />
      </main>
    );
  }

  return <HomeScreen onStart={() => setScreen("level-select")} />;
}
