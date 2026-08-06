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
const videoLabel = "\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891";
const title = "\u5148\u627e\u5361\u70b9";
const analyzeLabel = "\u5206\u6790\u5361\u70b9";
const loadingCopy = "\u6b63\u5728\u5206\u6790\u5361\u70b9\u2026";
const timelineLabel = "\u5361\u70b9\u65f6\u95f4\u8f74";
const emptyCopy = "\u6ca1\u627e\u5230\u660e\u663e\u5361\u70b9\uff0c\u8fd9\u6bb5\u5148\u53ea\u770b\u793a\u8303\u3002";
const retryLabel = "\u91cd\u8bd5";
const deleteLabel = "\u5220\u9664";
const confirmLabel = "\u786e\u8ba4\u5361\u70b9";
const loadError = "\u5173\u5361\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";
const actionLabels: Record<ActionRequirement, string> = {
  rhythm: "\u5361\u8282\u594f",
  open: "\u624b\u81c2\u6253\u5f00",
  squat: "\u4e0b\u8e72",
};

function createAudioContext(): MaybeClosableAudioContext {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : { decodeAudioData: async () => { throw new Error("AudioContext unavailable"); } };
}

function nextEnabledBeat(chart: BeatPoint[], currentId?: string) {
  return chart.find((beat) => beat.enabled && beat.id !== currentId) ?? chart.find((beat) => beat.enabled) ?? null;
}

export function AnalysisScreen({ level, onConfirm, onBack }: AnalysisScreenProps) {
  const [state, setState] = useState<AnalysisState>("idle");
  const [chart, setChart] = useState<BeatPoint[]>([]);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const enabledChart = useMemo(() => chart.filter((beat) => beat.enabled), [chart]);
  const selectedBeat = enabledChart.find((beat) => beat.id === selectedBeatId) ?? enabledChart[0] ?? null;
  const durationSec = Math.max(1, ...chart.map((beat) => beat.timeSec));

  async function analyze() {
    setState("loading");
    setError("");
    const context = createAudioContext();
    try {
      const beats = detectEnergyPeaks(await loadBuiltInLevelAudio(level, context));
      setChart(beats);
      setSelectedBeatId(beats.find((beat) => beat.enabled)?.id ?? null);
      setState("editing");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : loadError);
      setState("error");
    } finally {
      if (typeof context.close === "function") void context.close();
    }
  }

  function changeSelectedBeat(action: ActionRequirement) {
    if (!selectedBeat) return;
    setChart((current) => updateBeat(current, selectedBeat.id, { action }));
  }

  function deleteSelectedBeat() {
    if (!selectedBeat) return;
    setChart((current) => updateBeat(current, selectedBeat.id, { enabled: false }));
    setSelectedBeatId(nextEnabledBeat(chart, selectedBeat.id)?.id ?? null);
  }

  return (
    <main className="analysis-stage analysis-stage--timeline">
      <header className="stage-header analysis-stage__header">
        <button className="back-action" type="button" onClick={onBack}>{backLabel}</button>
        <span className="stage-brand">FullyDancy</span>
        <span className="stage-mode">02 / 04</span>
      </header>

      <section className="analysis-workbench" aria-labelledby="analysis-title">
        <h1 id="analysis-title" className="analysis-title">{title}</h1>
        <video className="analysis-video" aria-label={videoLabel} controls preload="metadata" src={level.videoUrl} />

        <div className="timeline-panel">
          {state === "idle" ? <button className="primary-action analysis-primary" type="button" onClick={analyze}>{analyzeLabel}</button> : null}
          {state === "loading" ? <p role="status" className="analysis-status">{loadingCopy}</p> : null}
          {state === "error" ? <div role="alert" className="analysis-error"><p>{error}</p><button className="primary-action analysis-primary" type="button" onClick={analyze}>{retryLabel}</button></div> : null}

          {state === "editing" ? (
            <>
              <div className="beat-timeline" role="group" aria-label={timelineLabel}>
                <div className="beat-timeline__rail" aria-hidden="true" />
                {chart.map((beat) => (
                  <button
                    key={beat.id}
                    className={beat.enabled && selectedBeat?.id === beat.id ? "beat-pin beat-pin--selected" : beat.enabled ? "beat-pin" : "beat-pin beat-pin--off"}
                    style={{ left: `${Math.min(100, (beat.timeSec / durationSec) * 100)}%` }}
                    type="button"
                    disabled={!beat.enabled}
                    aria-label={`\u9009\u62e9\u5361\u70b9 ${beat.timeSec.toFixed(2)}s`}
                    onClick={() => setSelectedBeatId(beat.id)}
                  >
                    <span>{beat.timeSec.toFixed(2)}s</span>
                  </button>
                ))}
              </div>

              {selectedBeat ? (
                <div className="beat-toolbar" aria-label="当前卡点设置">
                  <span className="beat-toolbar__time">{selectedBeat.timeSec.toFixed(2)}s</span>
                  {(Object.keys(actionLabels) as ActionRequirement[]).map((action) => (
                    <label key={action} className="beat-choice">
                      <input checked={selectedBeat.action === action} name={`${selectedBeat.id}-action`} type="radio" onChange={() => changeSelectedBeat(action)} />
                      {actionLabels[action]}
                    </label>
                  ))}
                  <button type="button" className="delete-beat" onClick={deleteSelectedBeat}>{deleteLabel}</button>
                  <button className="primary-action analysis-primary" type="button" onClick={() => onConfirm(enabledChart)}>{confirmLabel}</button>
                </div>
              ) : <p className="analysis-status">{emptyCopy}</p>}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
