import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCalibrationProfile } from "../calibration/calibrationProfile";
import type { CalibrationProfile, PoseFrame } from "../domain/types";
import { startCamera, type SharedCameraSession } from "../pose/camera";
import { MediaPipePoseProvider } from "../pose/mediaPipePoseProvider";
import { runPoseLoop } from "../pose/poseLoop";
import type { PoseProvider } from "../pose/types";
import { SkipAction } from "./SkipAction";

const introDurationMs = 2000;
const calibrationSteps = [
  {
    eyebrow: "步骤一",
    title: "全身入镜",
    copy: "让全身完整出现在画面里。",
    ready: "全身已入镜",
  },
  {
    eyebrow: "步骤二",
    title: "大字型姿势",
    copy: "双臂打开，双腿分开，摆成大字型。",
    ready: "大字型已识别",
  },
  {
    eyebrow: "步骤三",
    title: "下蹲",
    copy: "慢慢下蹲到你的最低位置。",
    ready: "下蹲位置已识别",
  },
] as const;

const skeletonLines = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]] as const;
const visibilityThreshold = 0.25;
const defaultVideoSize = { width: 16, height: 9 };
const createDefaultProvider = () => new MediaPipePoseProvider();
const getCurrentTime = () => Date.now();

interface OwnedRelease {
  runId: number;
  release: () => void;
}

interface OwnedCamera {
  runId: number;
  session: SharedCameraSession;
  video: HTMLVideoElement;
  stopOnDispose: boolean;
  released: boolean;
}

interface OwnedTimer {
  runId: number;
  id: number;
}

export interface CalibrationScreenProps {
  chartCount: number;
  onSkip: (camera: SharedCameraSession | null) => void;
  onComplete?: (profile: CalibrationProfile, camera: SharedCameraSession) => void;
  cameraSession?: SharedCameraSession | null;
  cameraStarter?: typeof startCamera;
  providerFactory?: () => PoseProvider;
  poseLoop?: typeof runPoseLoop;
  now?: () => number;
  stepDurationMs?: number;
}

function releaseCamera(owner: OwnedCamera, dispose: boolean) {
  if (owner.released) return;
  owner.released = true;
  owner.session.detach(owner.video);
  if (dispose && owner.stopOnDispose) owner.session.stop();
}

function isVisible(frame: PoseFrame, index: number) {
  const landmark = frame.landmarks[index];
  return Boolean(landmark && landmark.visibility >= visibilityThreshold);
}

function horizontalDistance(frame: PoseFrame, leftIndex: number, rightIndex: number) {
  const left = frame.landmarks[leftIndex];
  const right = frame.landmarks[rightIndex];
  if (!left || !right) return 0;
  return Math.abs(right.x - left.x);
}

function averageHipY(frame: PoseFrame) {
  return (frame.landmarks[23].y + frame.landmarks[24].y) / 2;
}

function getCalibrationGuidance(frame: PoseFrame | null, stepIndex: number, standingFrames: PoseFrame[]) {
  if (!frame) return { ready: false, message: "正在识别身体，请站到画面中央。" };
  const torsoVisible = [11, 12, 23, 24].every((index) => isVisible(frame, index));
  const handsVisible = [15, 16].every((index) => isVisible(frame, index));
  const legsVisible = [27, 28].every((index) => isVisible(frame, index));

  if (!torsoVisible) return { ready: false, message: "身体未完整入镜，请站到画面中央。" };
  if (!handsVisible) return { ready: false, message: "手部未完整入镜" };
  if (!legsVisible) return { ready: false, message: "脚部未完整入镜，请再往后站一点。" };

  if (stepIndex === 1) {
    const hipWidth = horizontalDistance(frame, 23, 24);
    const ankleWidth = horizontalDistance(frame, 27, 28);
    const armSpan = horizontalDistance(frame, 15, 16);
    const shoulderWidth = horizontalDistance(frame, 11, 12);
    if (hipWidth > 0 && ankleWidth < hipWidth * 1.12) return { ready: false, message: "腿部分开点" };
    if (shoulderWidth > 0 && armSpan < shoulderWidth * 2.1) return { ready: false, message: "手臂再打开一点" };
  }

  if (stepIndex === 2) {
    const standingHipY = standingFrames.length ? standingFrames.reduce((total, item) => total + averageHipY(item), 0) / standingFrames.length : averageHipY(frame);
    if (averageHipY(frame) - standingHipY < 0.08) return { ready: false, message: "再蹲低一点" };
  }

  return { ready: true, message: calibrationSteps[stepIndex]?.ready ?? "已识别到当前姿态" };
}

function SkeletonPreview({ frame, size }: { frame: PoseFrame | null; size: { width: number; height: number } }) {
  if (!frame) return null;
  const strokeWidth = Math.max(size.width, size.height) * 0.006;
  const radius = Math.max(size.width, size.height) * 0.006;
  return (
    <svg className="calibration-skeleton" aria-label="校准骨架叠加层" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet">
      {skeletonLines.map(([fromIndex, toIndex]) => {
        const from = frame.landmarks[fromIndex];
        const to = frame.landmarks[toIndex];
        if (!from || !to || from.visibility < visibilityThreshold || to.visibility < visibilityThreshold) return null;
        return <line key={`${fromIndex}-${toIndex}`} x1={(1 - from.x) * size.width} y1={from.y * size.height} x2={(1 - to.x) * size.width} y2={to.y * size.height} strokeWidth={strokeWidth} />;
      })}
      {frame.landmarks.map((landmark, index) => landmark.visibility >= visibilityThreshold ? <circle key={index} cx={(1 - landmark.x) * size.width} cy={landmark.y * size.height} r={radius} /> : null)}
    </svg>
  );
}

export function CalibrationScreen({
  chartCount,
  onSkip,
  onComplete,
  cameraSession = null,
  cameraStarter = startCamera,
  providerFactory = createDefaultProvider,
  poseLoop = runPoseLoop,
  now = getCurrentTime,
  stepDurationMs = 3000,
}: CalibrationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraOwnerRef = useRef<OwnedCamera | null>(null);
  const providerReleaseRef = useRef<OwnedRelease | null>(null);
  const cancelLoopRef = useRef<OwnedRelease | null>(null);
  const introTimerRef = useRef<OwnedTimer | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const fullBodyFramesRef = useRef<PoseFrame[]>([]);
  const starPoseFramesRef = useRef<PoseFrame[]>([]);
  const squatFramesRef = useRef<PoseFrame[]>([]);
  const stepIndexRef = useRef(0);
  const readySinceRef = useRef<number | null>(null);
  const introVisibleRef = useRef(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [introVisible, setIntroVisible] = useState(true);
  const [instruction, setInstruction] = useState<string>(calibrationSteps[0].copy);
  const [latestFrame, setLatestFrame] = useState<PoseFrame | null>(null);
  const [videoSize, setVideoSize] = useState(defaultVideoSize);
  const [profile, setProfile] = useState<CalibrationProfile | null>(null);
  const [running, setRunning] = useState(false);
  const completed = Boolean(profile);
  const progressPercent = useMemo(() => completed ? 100 : ((stepIndex + 1) / (calibrationSteps.length + 1)) * 100, [completed, stepIndex]);

  const releaseRun = useCallback((disposeCamera: boolean, updateState = true) => {
    runIdRef.current += 1;
    if (introTimerRef.current) {
      window.clearTimeout(introTimerRef.current.id);
      introTimerRef.current = null;
    }
    cancelLoopRef.current?.release();
    cancelLoopRef.current = null;
    providerReleaseRef.current?.release();
    providerReleaseRef.current = null;
    const cameraOwner = cameraOwnerRef.current;
    cameraOwnerRef.current = null;
    if (cameraOwner) releaseCamera(cameraOwner, disposeCamera);
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    readySinceRef.current = null;
    if (updateState && mountedRef.current) setRunning(false);
    return disposeCamera ? null : cameraOwner?.session ?? null;
  }, []);

  const stop = useCallback((updateState = true) => {
    releaseRun(true, updateState);
  }, [releaseRun]);

  const transferCamera = useCallback(() => releaseRun(false), [releaseRun]);

  const syncVideoSize = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    setVideoSize({ width: video.videoWidth, height: video.videoHeight });
  }, []);

  const completeReadyStep = useCallback((readyStep: number) => {
    readySinceRef.current = null;
    if (readyStep < calibrationSteps.length - 1) {
      const next = readyStep + 1;
      setStepIndex(next);
      stepIndexRef.current = next;
      setInstruction(calibrationSteps[next].copy);
      return;
    }
    const nextProfile = buildCalibrationProfile(fullBodyFramesRef.current, starPoseFramesRef.current, squatFramesRef.current, now());
    setProfile(nextProfile);
    setInstruction("校准完成");
    setRunning(false);
    if (!onComplete) {
      stop();
      return;
    }
    const camera = transferCamera();
    if (camera) onComplete(nextProfile, camera);
  }, [now, onComplete, stop, transferCamera]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    stop();
    const runId = ++runIdRef.current;
    fullBodyFramesRef.current = [];
    starPoseFramesRef.current = [];
    squatFramesRef.current = [];
    readySinceRef.current = null;
    setLatestFrame(null);
    setProfile(null);
    introVisibleRef.current = true;
    setIntroVisible(true);
    setInstruction(calibrationSteps[0].copy);
    setRunning(true);
    setStepIndex(0);
    stepIndexRef.current = 0;

    const introTimerId = window.setTimeout(() => {
      if (introTimerRef.current?.runId === runId) introTimerRef.current = null;
      if (!mountedRef.current || runIdRef.current !== runId) return;
      introVisibleRef.current = false;
      setIntroVisible(false);
      setInstruction((current) => current === calibrationSteps[0].copy ? "正在识别身体，请站到画面中央。" : current);
    }, introDurationMs);
    introTimerRef.current = { runId, id: introTimerId };

    let cameraOwner: OwnedCamera | null = null;
    let provider: PoseProvider | null = null;
    try {
      if (cameraSession) {
        cameraOwner = {
          runId,
          session: cameraSession,
          video,
          stopOnDispose: false,
          released: false,
        };
        cameraOwnerRef.current = cameraOwner;
        await cameraSession.attach(video);
      } else {
        const camera = await cameraStarter(video);
        cameraOwner = {
          runId,
          session: camera,
          video,
          stopOnDispose: true,
          released: false,
        };
      }
      if (!mountedRef.current || runIdRef.current !== runId) {
        releaseCamera(cameraOwner, true);
        if (cameraOwnerRef.current?.runId === runId) cameraOwnerRef.current = null;
        return;
      }
      cameraOwnerRef.current = cameraOwner;
      provider = providerFactory();
      let providerReleased = false;
      const releaseProvider = () => {
        if (providerReleased) return;
        providerReleased = true;
        provider?.stop();
      };
      providerReleaseRef.current = { runId, release: releaseProvider };
      await provider.start();
      if (!mountedRef.current || runIdRef.current !== runId) {
        releaseProvider();
        releaseCamera(cameraOwner, true);
        if (providerReleaseRef.current?.runId === runId) providerReleaseRef.current = null;
        if (cameraOwnerRef.current?.runId === runId) cameraOwnerRef.current = null;
        return;
      }
      const cancelLoop = poseLoop({
        video,
        provider,
        onFrame(frame) {
          if (!mountedRef.current || runIdRef.current !== runId) return;
          syncVideoSize();
          setLatestFrame(frame);
          if (introVisibleRef.current) return;
          const activeStep = stepIndexRef.current;
          const guidance = getCalibrationGuidance(frame, activeStep, fullBodyFramesRef.current);
          if (!guidance.ready) {
            readySinceRef.current = null;
            if (!introVisibleRef.current) setInstruction(guidance.message);
            return;
          }

          if (activeStep === 0) fullBodyFramesRef.current.push(frame);
          if (activeStep === 1) starPoseFramesRef.current.push(frame);
          if (activeStep === 2) squatFramesRef.current.push(frame);

          const currentTime = now();
          readySinceRef.current ??= currentTime;
          const elapsed = currentTime - readySinceRef.current;
          const remainingSeconds = Math.max(1, Math.ceil((stepDurationMs - elapsed) / 1000));
          if (!introVisibleRef.current) setInstruction(`${guidance.message}，保持 ${remainingSeconds} 秒`);
          if (elapsed >= stepDurationMs) completeReadyStep(activeStep);
        },
      });
      cancelLoopRef.current = { runId, release: cancelLoop };
      if (!mountedRef.current || runIdRef.current !== runId) {
        cancelLoop();
        if (cancelLoopRef.current?.runId === runId) cancelLoopRef.current = null;
      }
    } catch (error) {
      if (!mountedRef.current || runIdRef.current !== runId) return;
      stop();
      setIntroVisible(false);
      setInstruction(`摄像头启动失败：${error instanceof Error ? error.message : "请检查摄像头权限"}`);
    }
  }, [cameraSession, cameraStarter, completeReadyStep, now, poseLoop, providerFactory, stepDurationMs, stop, syncVideoSize]);

  useEffect(() => {
    mountedRef.current = true;
    void start();
    return () => {
      mountedRef.current = false;
      stop(false);
    };
  }, [start, stop]);

  const handleSkip = useCallback(() => {
    onSkip(transferCamera());
  }, [onSkip, transferCamera]);

  return (
    <main className="calibration-stage calibration-stage--fullscreen">
      <header className="stage-header calibration-stage__header">
        <span />
        <span className="stage-brand">FullyDancy</span>
        <span className="stage-mode">03 / 04</span>
      </header>
      <section className="calibration-shell calibration-shell--fullscreen" aria-labelledby="calibration-title">
        <h1 id="calibration-title" className="visually-hidden">身体校准</h1>
        <p className="visually-hidden">已确认 {chartCount} 个卡点，准备进行自动校准。</p>
        <div className="calibration-camera-card">
          <div className="calibration-camera-frame calibration-camera-frame--fullscreen calibration-camera-frame--page-background">
            <video ref={videoRef} aria-label="本地摄像头校准预览" muted playsInline onLoadedMetadata={syncVideoSize} onCanPlay={syncVideoSize} />
            <SkeletonPreview frame={latestFrame} size={videoSize} />
            <div className="calibration-progress" aria-label="身体校准进度" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
              <span className="calibration-progress__fill" style={{ width: `${progressPercent}%` }} />
              <span className="calibration-progress__steps">
                {[...calibrationSteps, { eyebrow: "完成" }].map((step, index) => (
                  <span key={step.eyebrow} className={index <= (completed ? calibrationSteps.length : stepIndex) ? "calibration-progress__step calibration-progress__step--active" : "calibration-progress__step"}>
                    {step.eyebrow}
                  </span>
                ))}
              </span>
            </div>
            <div className="calibration-guide calibration-guide--single-line">
              <h2 className={introVisible ? "calibration-instruction calibration-instruction--intro" : "calibration-instruction"}>{instruction}</h2>
            </div>
            {!running && !profile ? (
              <div className="calibration-actions">
                <button className="primary-action calibration-primary" type="button" onClick={() => void start()}>
                  开启摄像头校准
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <SkipAction onSkip={handleSkip} />
    </main>
  );
}
