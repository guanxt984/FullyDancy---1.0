import { useEffect, useMemo, useRef, useState } from "react";
import { extractDemoPoseCache, nearestPoseFrame, type DemoPoseCache } from "../analysis/demoPoseCache";
import { inferBeatActionsFromPose } from "../analysis/inferBeatActionsFromPose";
import { detectEnergyPeaks } from "../beat-analysis/energyPeaks";
import { updateBeat } from "../chart/chart";
import type { ActionRequirement, BeatPoint, PoseFrame, PoseLandmark } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import { loadBuiltInLevelAudio } from "../media/loadBuiltInLevelAudio";
import { SkipAction } from "./SkipAction";

export interface AnalysisResult {
  chart: BeatPoint[];
  poseCache: DemoPoseCache;
}

interface AnalysisScreenProps {
  level: BuiltInLevel;
  onConfirm: (result: AnalysisResult) => void;
  onSkip: (result: AnalysisResult | null) => void;
  onBack: () => void;
}

type AnalysisState = "idle" | "loading" | "editing" | "error";
type PoseCacheState = "idle" | "extracting" | "ready" | "failed";
type MaybeClosableAudioContext = Pick<BaseAudioContext, "decodeAudioData"> & { close?: () => Promise<void> };

const backLabel = "\u8fd4\u56de";
const videoLabel = "\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891";
const title = "\u5148\u627e\u5361\u70b9";
const analyzeLabel = "\u5206\u6790\u5361\u70b9";
const loadingCopy = "\u6b63\u5728\u5206\u6790\u5361\u70b9\u2026";
const timelineLabel = "\u5361\u70b9\u65f6\u95f4\u8f74";
const progressLabel = "\u89c6\u9891\u8fdb\u5ea6";
const videoTimeLabel = "视频时间";
const playVideoLabel = "播放视频";
const pauseVideoLabel = "暂停视频";
const skeletonLabel = "\u793a\u8303\u9aa8\u67b6\u53e0\u52a0\u5c42";
const armHighlightLabel = "\u624b\u81c2\u9ad8\u4eae";
const squatHighlightLabel = "\u4e0b\u8e72\u9ad8\u4eae";
const emptyCopy = "\u6ca1\u627e\u5230\u660e\u663e\u5361\u70b9\uff0c\u8fd9\u6bb5\u5148\u53ea\u770b\u793a\u8303\u3002";
const retryLabel = "\u91cd\u8bd5";
const addBeatLabel = "新增卡点";
const deleteLabel = "删除卡点";
const confirmLabel = "进入下一步";
const loadError = "\u5173\u5361\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";
const poseExtractingCopy = "\u6b63\u5728\u63d0\u53d6\u793a\u8303\u9aa8\u67b6\u2026";
const poseFailedCopy = "\u793a\u8303\u9aa8\u67b6\u63d0\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";
const retryPoseLabel = "\u91cd\u8bd5\u9aa8\u67b6\u63d0\u53d6";
const actionLabels: Record<ActionRequirement, string> = {
  rhythm: "\u5361\u8282\u594f",
  open: "手臂伸直",
  squat: "\u4e0b\u8e72",
};
const actionIcons: Record<ActionRequirement, string> = {
  rhythm: "♪",
  open: "↕",
  squat: "⌄",
};

const skeletonLines = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
] as const;
const armLines = [[11, 13], [13, 15], [12, 14], [14, 16]] as const;
const squatLines = [[23, 25], [25, 27], [24, 26], [26, 28]] as const;

function createAudioContext(): MaybeClosableAudioContext {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : { decodeAudioData: async () => { throw new Error("AudioContext unavailable"); } };
}

function visible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && landmark.visibility >= 0.45);
}

function sameLine(line: readonly [number, number], group: readonly (readonly [number, number])[]): boolean {
  return group.some(([from, to]) => from === line[0] && to === line[1]);
}

function formatClockTime(timeSec: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(timeSec) ? timeSec : 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function beatActions(beat: BeatPoint | null): ActionRequirement[] {
  if (!beat) return [];
  const actions = beat.actions?.length ? beat.actions : [beat.action];
  return Array.from(new Set(actions));
}

function hasBeatAction(beat: BeatPoint | null, action: ActionRequirement): boolean {
  return beatActions(beat).includes(action);
}

function SkeletonOverlay({ beat, frame }: { beat: BeatPoint | null; frame: PoseFrame }) {
  const hotActions = beatActions(beat);
  return (
    <svg className="analysis-skeleton" aria-label={skeletonLabel} viewBox="0 0 1 1" preserveAspectRatio="none">
      {skeletonLines.map((line) => {
        const from = frame.landmarks[line[0]];
        const to = frame.landmarks[line[1]];
        if (!visible(from) || !visible(to)) return null;
        const armHit = hotActions.includes("open") && sameLine(line, armLines);
        const squatHit = hotActions.includes("squat") && sameLine(line, squatLines);
        return (
          <line
            key={`${line[0]}-${line[1]}`}
            className={armHit || squatHit ? "skeleton-line skeleton-line--hot" : "skeleton-line"}
            aria-label={armHit ? armHighlightLabel : squatHit ? squatHighlightLabel : undefined}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          />
        );
      })}
      {frame.landmarks.map((landmark, index) => visible(landmark) ? <circle key={index} className="skeleton-joint" cx={landmark.x} cy={landmark.y} r="0.006" /> : null)}
    </svg>
  );
}

export function AnalysisScreen({ level, onConfirm, onSkip, onBack }: AnalysisScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AnalysisState>("idle");
  const [poseCacheState, setPoseCacheState] = useState<PoseCacheState>("idle");
  const [chart, setChart] = useState<BeatPoint[]>([]);
  const [poseCache, setPoseCache] = useState<DemoPoseCache>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const enabledChart = useMemo(() => chart.filter((beat) => beat.enabled), [chart]);
  const timelineDuration = Math.max(1, duration, currentTime, ...chart.map((beat) => beat.timeSec));
  const progressPercent = Math.min(100, (currentTime / timelineDuration) * 100);
  const videoTimeCopy = `${formatClockTime(currentTime)} / ${formatClockTime(timelineDuration)}`;
  const activeBeat = useMemo(() => {
    if (activeBeatId) return enabledChart.find((beat) => beat.id === activeBeatId) ?? null;
    return enabledChart.find((beat) => Math.abs(beat.timeSec - currentTime) <= 0.25) ?? null;
  }, [activeBeatId, currentTime, enabledChart]);
  const activeFrame = useMemo(
    () => nearestPoseFrame(poseCache, currentTime, 0.25) ?? (activeBeat ? nearestPoseFrame(poseCache, activeBeat.timeSec, 0.25) : null),
    [activeBeat, currentTime, poseCache],
  );
  const poseStatusCopy = poseCacheState === "extracting"
    ? poseExtractingCopy
    : poseCacheState === "ready"
      ? `\u5df2\u63d0\u53d6 ${poseCache.length} \u5e27\u793a\u8303\u9aa8\u67b6`
      : poseCacheState === "failed"
        ? poseFailedCopy
        : "";

  useEffect(() => {
    setPoseCache([]);
    setPoseCacheState("idle");
  }, [level.videoUrl]);

  async function extractPoseCache(beats: BeatPoint[]) {
    setPoseCache([]);
    setPoseCacheState("extracting");
    try {
      const cache = await extractDemoPoseCache(level.videoUrl, Math.max(videoRef.current?.duration || 0, ...beats.map((beat) => beat.timeSec)));
      if (cache.length === 0) {
        setPoseCacheState("failed");
        return;
      }
      setPoseCache(cache);
      setPoseCacheState("ready");
      setChart((current) => inferBeatActionsFromPose(current, cache));
    } catch {
      setPoseCache([]);
      setPoseCacheState("failed");
    }
  }

  async function analyze() {
    setState("loading");
    setError("");
    setPoseCache([]);
    setPoseCacheState("idle");
    const context = createAudioContext();
    try {
      const beats = detectEnergyPeaks(await loadBuiltInLevelAudio(level, context));
      setChart(beats);
      setActiveBeatId(beats.find((beat) => beat.enabled)?.id ?? null);
      setState("editing");
      void extractPoseCache(beats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : loadError);
      setState("error");
    } finally {
      if (typeof context.close === "function") void context.close();
    }
  }

  function seekToTime(timeSec: number, beatId: string | null = null) {
    const nextTime = Math.max(0, Math.min(timelineDuration, timeSec));
    if (videoRef.current) videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    setActiveBeatId(beatId);
  }

  function seekToBeat(beat: BeatPoint) {
    seekToTime(beat.timeSec, beat.id);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      return;
    }
    void video.play().catch(() => setIsPlaying(false));
  }

  function seekTimeline(event: React.MouseEvent<HTMLDivElement>) {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekToTime(ratio * timelineDuration);
  }

  function toggleBeatAction(beat: BeatPoint, action: ActionRequirement) {
    seekToBeat(beat);
    const currentActions = beatActions(beat);
    const nextActions = currentActions.includes(action)
      ? currentActions.filter((item) => item !== action)
      : [...currentActions, action];
    const safeActions = nextActions.length > 0 ? nextActions : ["rhythm" as const];
    setChart((current) => updateBeat(current, beat.id, { action, actions: safeActions }));
  }

  function addBeat() {
    const timeSec = Number(currentTime.toFixed(2));
    const nextBeat: BeatPoint = {
      id: `manual-${Date.now()}-${Math.round(timeSec * 100)}`,
      beatIndex: chart.length + 1,
      timeSec,
      salience: 0.85,
      enabled: true,
      action: "rhythm",
      actions: ["rhythm"],
    };
    setChart((current) => [...current, nextBeat].sort((left, right) => left.timeSec - right.timeSec));
    setActiveBeatId(nextBeat.id);
    seekToTime(timeSec, nextBeat.id);
  }

  function deleteBeat(beat: BeatPoint) {
    seekToBeat(beat);
    setChart((current) => updateBeat(current, beat.id, { enabled: false }));
    setActiveBeatId(null);
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
        <div className="analysis-video-frame">
          <video
            ref={videoRef}
            className="analysis-video"
            aria-label={videoLabel}
            preload="metadata"
            src={level.videoUrl}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          {activeFrame ? <SkeletonOverlay beat={activeBeat} frame={activeFrame} /> : null}
          <button className="analysis-play-toggle" type="button" aria-label={isPlaying ? pauseVideoLabel : playVideoLabel} onClick={togglePlayback}>
            <span className={isPlaying ? "play-icon play-icon--pause" : "play-icon play-icon--play"} aria-hidden="true">
              {isPlaying ? (
                <>
                  <span className="play-icon-bar" />
                  <span className="play-icon-bar" />
                </>
              ) : <span className="play-icon-triangle" />}
            </span>
          </button>
          <span className="analysis-video-time" aria-label={videoTimeLabel}>{videoTimeCopy}</span>
        </div>

        <div className="timeline-panel timeline-panel--compact">
          {state === "idle" ? <button className="primary-action analysis-primary" type="button" onClick={analyze}>{analyzeLabel}</button> : null}
          {state === "loading" ? <p role="status" className="analysis-status">{loadingCopy}</p> : null}
          {state === "error" ? <div role="alert" className="analysis-error"><p>{error}</p><button className="primary-action analysis-primary" type="button" onClick={analyze}>{retryLabel}</button></div> : null}

          {state === "editing" ? (
            <>
              <div ref={timelineRef} className="beat-timeline beat-timeline--with-actions" role="group" aria-label={timelineLabel} onClick={seekTimeline}>
                <div className="beat-timeline__rail" aria-hidden="true" />
                <span className="playhead-dot" aria-label={progressLabel} style={{ left: `${progressPercent}%` }} />
                {chart.map((beat) => {
                  const left = `${Math.min(100, (beat.timeSec / timelineDuration) * 100)}%`;
                  return (
                    <div className={beat.enabled ? "beat-marker" : "beat-marker beat-marker--off"} key={beat.id} style={{ left }} onClick={(event) => event.stopPropagation()}>
                      <span className="beat-pin-action-icons beat-pin-action-icons--row">
                        {beatActions(beat).map((action) => (
                          <span key={action} className={`beat-pin-action-icon beat-pin-action-icon--${action}`} aria-label={`卡点任务：${actionLabels[action]}`}>{actionIcons[action]}</span>
                        ))}
                      </span>
                      <button
                        className={beat.enabled && activeBeatId === beat.id ? "beat-pin beat-pin--selected" : "beat-pin"}
                        type="button"
                        disabled={!beat.enabled}
                        aria-label={`\u8df3\u5230\u5361\u70b9 ${beat.timeSec.toFixed(2)}s`}
                        onClick={() => seekToBeat(beat)}
                      >
                        <span className="beat-pin-dot" aria-hidden="true" />
                        <span className="beat-pin-time">{beat.timeSec.toFixed(2)}s</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="timeline-actions-row">
                {activeBeat ? (
                  <div className="beat-tool-tab">
                    <span className="beat-tool-time">{activeBeat.timeSec.toFixed(2)}s</span>
                    <span className="beat-tool-group beat-tool-group--points" aria-label="卡点操作">
                      <button type="button" className="beat-tool-button" onClick={addBeat}>
                        <span className="beat-action-icon" aria-hidden="true">＋</span>
                        <span>{addBeatLabel}</span>
                      </button>
                      <button type="button" className="beat-tool-button beat-tool-button--delete" aria-label={deleteLabel} onClick={() => deleteBeat(activeBeat)}>
                        <span className="beat-action-icon" aria-hidden="true">×</span>
                        <span>{deleteLabel}</span>
                      </button>
                    </span>
                    <span className="beat-tool-group beat-tool-group--actions" aria-label="动作打标">
                      {(Object.keys(actionLabels) as ActionRequirement[]).map((action) => (
                        <label key={action} className={hasBeatAction(activeBeat, action) ? "beat-tool-button beat-tool-button--active" : "beat-tool-button"}>
                          <input checked={hasBeatAction(activeBeat, action)} name={`${activeBeat.id}-${action}`} type="checkbox" onChange={() => toggleBeatAction(activeBeat, action)} />
                          <span className={`beat-action-icon beat-action-icon--${action}`} aria-hidden="true">{actionIcons[action]}</span>
                          <span>{actionLabels[action]}</span>
                        </label>
                      ))}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="timeline-footer">
                {poseCacheState === "failed" ? (
                  <div className="pose-cache-status" role="alert">
                    <span>{poseStatusCopy}</span>
                    <button type="button" onClick={() => void extractPoseCache(chart)}>{retryPoseLabel}</button>
                  </div>
                ) : poseStatusCopy ? <p role="status" className="pose-cache-status">{poseStatusCopy}</p> : <span />}
                {enabledChart.length > 0 ? <button className="primary-action analysis-primary timeline-confirm" type="button" disabled={poseCacheState !== "ready"} onClick={() => onConfirm({ chart: enabledChart, poseCache })}>{confirmLabel}</button> : <p className="analysis-status">{emptyCopy}</p>}
              </div>
            </>
          ) : null}
        </div>
      </section>
      <SkipAction onSkip={() => onSkip(chart.length > 0 ? { chart: enabledChart, poseCache } : null)} />
    </main>
  );
}
