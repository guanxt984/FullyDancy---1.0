import { useMemo, useState } from "react";
import { detectEnergyPeaks } from "../beat-analysis/energyPeaks";
import { updateBeat } from "../chart/chart";
import type { ActionRequirement, BeatPoint } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import { loadBuiltInLevelAudio } from "../media/loadBuiltInLevelAudio";

interface AnalysisScreenProps {
  level: BuiltInLevel;
  onConfirm: (chart: BeatPoint[]) => void;
  onBack: () => void;
}

type AnalysisState = "idle" | "loading" | "editing" | "error";
type MaybeClosableAudioContext = Pick<BaseAudioContext, "decodeAudioData"> & { close?: () => Promise<void> };

const backLabel = "\u8fd4\u56de";
const videoLabel = "\u821e\u8e48\u793a\u8303";
const title = "\u5148\u627e\u5361\u70b9";
const copy = "\u7cfb\u7edf\u4f1a\u4ece\u5185\u7f6e\u89c6\u9891\u7684\u672c\u5730\u97f3\u9891\u91cc\u627e\u51fa\u5019\u9009\u5361\u70b9\uff0c\u4f60\u53ea\u8981\u7ed9\u5b83\u6807\u4e0a\u8282\u594f\u3001\u6253\u5f00\u6216\u8e72\u4f4e\u3002";
const analyzeLabel = "\u5206\u6790\u5361\u70b9";
const loadingCopy = "\u6b63\u5728\u5206\u6790\u5361\u70b9\u2026";
const settingsTitle = "\u5361\u70b9\u8bbe\u7f6e";
const emptyCopy = "\u6ca1\u627e\u5230\u660e\u663e\u5361\u70b9\uff0c\u6362\u4e00\u6bb5\u66f4\u6709\u8282\u594f\u7684\u89c6\u9891\u4f1a\u66f4\u597d\u3002";
const retryLabel = "\u91cd\u8bd5";
const deleteLabel = "\u5220\u9664";
const confirmLabel = "\u786e\u8ba4\u5361\u70b9";
const loadError = "\u5173\u5361\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";
const actionLabels: Record<ActionRequirement, string> = {
  rhythm: "\u53ea\u5361\u8282\u594f",
  open: "\u6253\u5f00",
  squat: "\u8e72\u4f4e",
};

function createAudioContext(): MaybeClosableAudioContext {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : { decodeAudioData: async () => { throw new Error("AudioContext unavailable"); } };
}

export function AnalysisScreen({ level, onConfirm, onBack }: AnalysisScreenProps) {
  const [state, setState] = useState<AnalysisState>("idle");
  const [chart, setChart] = useState<BeatPoint[]>([]);
  const [error, setError] = useState("");
  const enabledChart = useMemo(() => chart.filter((beat) => beat.enabled), [chart]);

  async function analyze() {
    setState("loading");
    setError("");
    const context = createAudioContext();
    try {
      const audio = await loadBuiltInLevelAudio(level, context);
      setChart(detectEnergyPeaks(audio));
      setState("editing");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : loadError);
      setState("error");
    } finally {
      if (typeof context.close === "function") void context.close();
    }
  }

  return (
    <main className="analysis-stage">
      <header className="stage-header analysis-stage__header">
        <button className="back-action" type="button" onClick={onBack}>{backLabel}</button>
        <span className="stage-brand">FullyDancy</span>
        <span className="stage-mode">02 / 04</span>
      </header>

      <section className="analysis-shell" aria-labelledby="analysis-title">
        <div className="analysis-video-panel">
          <video aria-label={videoLabel} controls preload="metadata" src={level.videoUrl} />
        </div>
        <div className="analysis-controls">
          <p className="stage-kicker">Beat setup</p>
          <h1 id="analysis-title">{title}</h1>
          <p className="analysis-copy">{copy}</p>

          {state === "idle" ? <button className="primary-action analysis-primary" type="button" onClick={analyze}>{analyzeLabel}</button> : null}
          {state === "loading" ? <p role="status" className="analysis-status">{loadingCopy}</p> : null}
          {state === "error" ? <div role="alert" className="analysis-error"><p>{error}</p><button className="primary-action analysis-primary" type="button" onClick={analyze}>{retryLabel}</button></div> : null}

          {state === "editing" ? (
            <div className="beat-editor" aria-label={settingsTitle}>
              <h2>{settingsTitle}</h2>
              {chart.length === 0 ? <p className="analysis-status">{emptyCopy}</p> : null}
              <ol className="beat-list">
                {chart.map((beat) => (
                  <li className={beat.enabled ? "beat-row" : "beat-row beat-row--off"} key={beat.id}>
                    <span className="beat-time">{beat.timeSec.toFixed(2)}s</span>
                    <div className="beat-actions">
                      {(Object.keys(actionLabels) as ActionRequirement[]).map((action) => (
                        <label key={action}>
                          <input checked={beat.action === action} disabled={!beat.enabled} name={`${beat.id}-action`} type="radio" onChange={() => setChart((current) => updateBeat(current, beat.id, { action }))} />
                          {actionLabels[action]}
                        </label>
                      ))}
                    </div>
                    <button type="button" className="delete-beat" onClick={() => setChart((current) => updateBeat(current, beat.id, { enabled: false }))}>{deleteLabel}</button>
                  </li>
                ))}
              </ol>
              <button className="primary-action analysis-primary" type="button" disabled={enabledChart.length === 0} onClick={() => onConfirm(enabledChart)}>{confirmLabel}</button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
