import type { BuiltInLevel } from "../levels/builtInLevel";

interface BuiltInLevelStepProps {
  level: BuiltInLevel;
  onAnalyze: () => void;
}

export function BuiltInLevelStep({ level, onAnalyze }: BuiltInLevelStepProps) {
  return (
    <section aria-labelledby="built-in-level-title">
      <h2 id="built-in-level-title">{level.title}</h2>
      <video aria-label="内置舞蹈示范" controls preload="metadata" src={level.videoUrl} />
      <p>先观看示范，再分析音乐强拍。</p>
      <button type="button" onClick={onAnalyze}>分析卡点</button>
    </section>
  );
}
