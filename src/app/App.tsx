import { useState } from "react";
import { BuiltInLevelStep } from "../components/BuiltInLevelStep";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import { TechnicalSlice } from "../components/TechnicalSlice";

export function App() {
  const [isPreparingAnalysis, setIsPreparingAnalysis] = useState(false);

  return (
    <main>
      <h1>FullyDancy</h1>
      <p>视频和摄像头数据仅在本地处理</p>
      <BuiltInLevelStep
        level={BUILT_IN_LEVEL}
        onAnalyze={() => setIsPreparingAnalysis(true)}
      />
      {isPreparingAnalysis ? <p>正在准备卡点分析…</p> : null}
      <TechnicalSlice />
    </main>
  );
}
