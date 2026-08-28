import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractDemoPoseCache, nearestPoseFrame, type DemoPoseCache } from "../analysis/demoPoseCache";
import type { BeatPoint, PoseFrame, PoseLandmark } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import { startCamera, type CameraSession } from "../pose/camera";
import { MediaPipePoseProvider } from "../pose/mediaPipePoseProvider";
import { runPoseLoop } from "../pose/poseLoop";
import type { PoseProvider } from "../pose/types";
import { DanceGestureController } from "./gestureControls";

interface ChallengeScreenProps {
  level: BuiltInLevel;
  chart: BeatPoint[];
  initialPoseCache: DemoPoseCache;
  onBack: () => void;
  poseExtractor?: typeof extractDemoPoseCache;
  cameraStarter?: typeof startCamera;
  providerFactory?: () => PoseProvider;
  poseLoop?: typeof runPoseLoop;
}

const backLabel = "返回";
const referenceTitle = "示范骨架舞者";
const cameraTitle = "你的实时舞蹈画面";
const skeletonLabel = "示范骨架运动";
const cameraLabel = "用户摄像头预览";
const loadingText = "正在提取示范骨架…";

const skeletonLines = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;

function visible(landmark: PoseLandmark | undefined) {
  return Boolean(landmark && landmark.visibility >= 0.35);
}

function DemoSkeleton({ frame }: { frame: PoseFrame }) {
  return (
    <svg className="challenge-reference-skeleton" aria-label={skeletonLabel} viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
      {skeletonLines.map(([from, to]) => {
        const a = frame.landmarks[from];
        const b = frame.landmarks[to];
        if (!visible(a) || !visible(b)) return null;
        const isArm = from === 11 || from === 12 || from === 13 || from === 14;
        return (
          <line
            key={`${from}-${to}`}
            className={isArm ? "challenge-reference-limb challenge-reference-limb--key" : "challenge-reference-limb"}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
          />
        );
      })}
      {frame.landmarks.map((landmark, index) =>
        visible(landmark) ? (
          <circle
            key={index}
            className={index >= 11 && index <= 16 ? "challenge-reference-joint challenge-reference-joint--key" : "challenge-reference-joint"}
            cx={landmark.x}
            cy={landmark.y}
            r={index >= 11 && index <= 16 ? 0.016 : 0.012}
          />
        ) : null,
      )}
    </svg>
  );
}

export function ChallengeScreen({
  level,
  chart,
  initialPoseCache,
  onBack,
  poseExtractor = extractDemoPoseCache,
  cameraStarter = startCamera,
  providerFactory = () => new MediaPipePoseProvider(),
  poseLoop = runPoseLoop,
}: ChallengeScreenProps) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const cameraLayerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const challengeShellRef = useRef<HTMLElement>(null);
  const retryCameraRef = useRef<HTMLButtonElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);
  const playingRef = useRef(false);
  const extractionPromiseRef = useRef<{
    videoUrl: string;
    durationSec: number;
    extractor: typeof extractDemoPoseCache;
    promise: Promise<DemoPoseCache>;
  } | null>(null);
  const gestureRef = useRef(new DanceGestureController());
  const [poseCache, setPoseCache] = useState<DemoPoseCache>(initialPoseCache);
  const [poseExtractionState, setPoseExtractionState] = useState<"loading" | "ready" | "error">(initialPoseCache.length > 0 ? "ready" : "loading");
  const [poseRetryVersion, setPoseRetryVersion] = useState(0);
  const [cameraStatus, setCameraStatus] = useState("等待开启摄像头");
  const [currentTime, setCurrentTime] = useState(0);
  const [phase, setPhase] = useState<"instructions" | "starting" | "active" | "camera-error">("instructions");
  const [playing, setPlaying] = useState(false);
  const [gestureStatus, setGestureStatus] = useState("张开单手掌暂停 / 继续，双手举过头顶重新开始");
  const durationSec = useMemo(() => level.durationSec ?? Math.max(1, ...chart.map((beat) => beat.timeSec)) + 1, [chart, level.durationSec]);
  const activeFrame = nearestPoseFrame(poseCache, currentTime, 0.18) ?? poseCache[0] ?? null;

  useEffect(() => {
    if (initialPoseCache.length > 0) {
      setPoseCache(initialPoseCache);
      setPoseExtractionState("ready");
      return;
    }
    let cancelled = false;
    setPoseCache([]);
    setPoseExtractionState("loading");
    const existing = extractionPromiseRef.current;
    const request = existing
      && existing.videoUrl === level.videoUrl
      && existing.durationSec === durationSec
      && existing.extractor === poseExtractor
      ? existing.promise
      : Promise.resolve().then(() => poseExtractor(level.videoUrl, durationSec));
    if (request !== existing?.promise) {
      extractionPromiseRef.current = { videoUrl: level.videoUrl, durationSec, extractor: poseExtractor, promise: request };
    }
    request
      .then((cache) => {
        if (cancelled) return;
        if (cache.length > 0) {
          setPoseCache(cache);
          setPoseExtractionState("ready");
        } else {
          setPoseExtractionState("error");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPoseExtractionState("error");
      })
      .finally(() => {
        if (extractionPromiseRef.current?.promise === request) extractionPromiseRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [durationSec, initialPoseCache.length, level.videoUrl, poseExtractor, poseRetryVersion]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, []);

  const pause = useCallback(() => {
    mediaRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    await media.play();
    if (!mountedRef.current) return;
    playingRef.current = true;
    setPlaying(true);
  }, []);

  const togglePlayback = useCallback(() => {
    if (playingRef.current) pause();
    else void play();
  }, [pause, play]);

  const restart = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = 0;
    setCurrentTime(0);
    void play();
  }, [play]);

  const startChallenge = useCallback(async () => {
    const cameraVideo = cameraRef.current;
    const media = mediaRef.current;
    if (!cameraVideo || !media || phase === "starting" || phase === "active") return;
    setPhase("starting");
    setCameraStatus("正在请求摄像头权限…");
    let camera: CameraSession | null = null;
    let provider: PoseProvider | null = null;
    let cancelLoop: (() => void) | null = null;
    let mediaReleased = false;
    let mediaStarted = true;
    const release = () => {
      if (mediaStarted && !mediaReleased) {
        mediaReleased = true;
        media.pause();
      }
      cancelLoop?.();
      cancelLoop = null;
      provider?.stop();
      provider = null;
      camera?.stop();
      camera = null;
      if (releaseRef.current === release) releaseRef.current = null;
    };
    releaseRef.current = release;
    const mediaPlayPromise = play().then(() => true).catch(() => false);
    try {
      camera = await cameraStarter(cameraVideo, {
        videoConstraints: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!mountedRef.current) {
        release();
        return;
      }
      provider = providerFactory();
      await provider.start();
      if (!mountedRef.current) {
        release();
        return;
      }
      cancelLoop = poseLoop({
        video: cameraVideo,
        provider,
        onFrame(frame) {
          const action = gestureRef.current.update(frame, performance.now());
          if (action === "restart") {
            setGestureStatus("已识别：重新开始");
            restart();
          } else if (action === "toggle-playback") {
            setGestureStatus("已识别：播放 / 暂停");
            togglePlayback();
          }
        },
      });
      releaseRef.current = release;
      setCameraStatus("摄像头已开启");
      const playbackStarted = await mediaPlayPromise;
      if (!mountedRef.current) {
        release();
        return;
      }
      if (!playbackStarted) {
        setGestureStatus("媒体未能自动播放，请点击继续；也可使用单手手势开始");
      }
      setPhase("active");
    } catch (error) {
      release();
      if (!mountedRef.current) return;
      setCameraStatus(error instanceof DOMException && error.name === "NotAllowedError"
        ? "摄像头权限被拒绝，请在浏览器设置中允许访问后重试"
        : "摄像头启动失败，请重试");
      setPhase("camera-error");
    }
  }, [cameraStarter, phase, play, poseLoop, providerFactory, restart, togglePlayback]);

  useEffect(() => {
    if (phase === "camera-error") retryCameraRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    const backgroundLayers = [cameraLayerRef.current, headerRef.current, challengeShellRef.current];
    backgroundLayers.forEach((layer) => {
      if (layer) layer.inert = phase === "instructions";
    });
  }, [phase]);

  return (
    <main className="challenge-stage challenge-stage--live challenge-stage--camera-fullscreen">
      <video
        ref={mediaRef}
        className="challenge-media-clock"
        aria-label="舞蹈音乐与统一时间轴"
        src={level.videoUrl}
        preload="auto"
        playsInline
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          playingRef.current = true;
          setPlaying(true);
        }}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
        }}
        onEnded={() => {
          playingRef.current = false;
          setPlaying(false);
        }}
      />
      <section ref={cameraLayerRef} className="challenge-user-camera-card challenge-user-camera-card--background" aria-label={cameraTitle}>
        <video ref={cameraRef} className="challenge-camera-video" aria-label={cameraLabel} autoPlay muted playsInline />
        {phase !== "instructions" ? <span className="challenge-camera-status">{cameraStatus}</span> : null}
      </section>
      <header ref={headerRef} className="stage-header challenge-stage__header">
        <button className="back-action" type="button" tabIndex={phase === "instructions" ? -1 : undefined} onClick={onBack}>{backLabel}</button>
      </header>

      <section ref={challengeShellRef} className="challenge-shell challenge-shell--live" aria-label="舞蹈挑战">
        <section className="challenge-reference-overlay challenge-reference-overlay--full-height" aria-label={referenceTitle}>
          <div className="challenge-reference-stage">
            {activeFrame ? <DemoSkeleton frame={activeFrame} /> : poseExtractionState === "error" ? (
              <button className="challenge-pose-retry" type="button" onClick={() => setPoseRetryVersion((version) => version + 1)}>重试示范骨架</button>
            ) : <span className="challenge-empty-state">{loadingText}</span>}
          </div>
        </section>

        <div className="challenge-transport challenge-transport--floating" aria-label="播放控制">
          {phase === "active" ? <button type="button" onClick={togglePlayback}>{playing ? "暂停" : "继续"}</button> : null}
          {phase === "active" ? <button type="button" onClick={restart}>重新开始</button> : null}
          {phase === "active" ? <span aria-live="polite">{gestureStatus}</span> : null}
          {phase === "camera-error" ? <button ref={retryCameraRef} type="button" onClick={() => void startChallenge()}>重试摄像头</button> : null}
        </div>
      </section>

      {phase === "instructions" ? (
        <div className="challenge-instructions-layer">
          <section className="challenge-instructions" role="dialog" aria-modal="true" aria-labelledby="challenge-instructions-title">
            <h2 id="challenge-instructions-title">舞蹈玩法</h2>
            <p>跟随绿色骨架完成动作</p>
            <p>单手张开保持 0.6 秒：播放或暂停</p>
            <p>双手举过头顶保持 1 秒：重新开始</p>
            <button className="primary-action" type="button" autoFocus onClick={() => void startChallenge()}>开始舞蹈</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
