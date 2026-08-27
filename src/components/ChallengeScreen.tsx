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
const title = "开始舞蹈";
const kicker = "Dance challenge";
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
  const releaseRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);
  const extractionPromiseRef = useRef<Promise<DemoPoseCache> | null>(null);
  const gestureRef = useRef(new DanceGestureController());
  const [poseCache, setPoseCache] = useState<DemoPoseCache>(initialPoseCache);
  const [poseStatus, setPoseStatus] = useState(initialPoseCache.length > 0 ? `已缓存 ${initialPoseCache.length} 帧骨架` : loadingText);
  const [cameraStatus, setCameraStatus] = useState("等待开启摄像头");
  const [currentTime, setCurrentTime] = useState(0);
  const [phase, setPhase] = useState<"instructions" | "starting" | "active" | "camera-error">("instructions");
  const [playing, setPlaying] = useState(false);
  const [gestureStatus, setGestureStatus] = useState("张开单手掌暂停 / 继续，双手举过头顶重新开始");
  const durationSec = useMemo(() => level.durationSec ?? Math.max(1, ...chart.map((beat) => beat.timeSec)) + 1, [chart, level.durationSec]);
  const activeFrame = nearestPoseFrame(poseCache, currentTime, 0.18) ?? poseCache[0] ?? null;

  useEffect(() => {
    if (initialPoseCache.length > 0) return;
    let cancelled = false;
    setPoseStatus(loadingText);
    extractionPromiseRef.current ??= poseExtractor(level.videoUrl, durationSec);
    extractionPromiseRef.current.then((cache) => {
      if (cancelled) return;
      setPoseCache(cache);
      setPoseStatus(cache.length > 0 ? `已提取 ${cache.length} 帧骨架` : "暂未提取到骨架，稍后可重试");
    });
    return () => {
      cancelled = true;
    };
  }, [durationSec, initialPoseCache.length, level.videoUrl, poseExtractor]);

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
    setPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    await media.play();
    setPlaying(true);
  }, []);

  const togglePlayback = useCallback(() => {
    if (playing) pause();
    else void play();
  }, [pause, play, playing]);

  const restart = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = 0;
    setCurrentTime(0);
    void play();
  }, [play]);

  const startChallenge = useCallback(async () => {
    const cameraVideo = cameraRef.current;
    if (!cameraVideo || phase === "starting" || phase === "active") return;
    setPhase("starting");
    setCameraStatus("正在请求摄像头权限…");
    let camera: CameraSession | null = null;
    let provider: PoseProvider | null = null;
    let cancelLoop: (() => void) | null = null;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      cancelLoop?.();
      provider?.stop();
      camera?.stop();
    };
    try {
      camera = await cameraStarter(cameraVideo, {
        videoConstraints: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!mountedRef.current) {
        camera.stop();
        return;
      }
      provider = providerFactory();
      await provider.start();
      if (!mountedRef.current) {
        provider.stop();
        camera.stop();
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
      await play();
      if (!mountedRef.current) {
        release();
        return;
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
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <section className="challenge-user-camera-card challenge-user-camera-card--background" aria-label={cameraTitle}>
        <video ref={cameraRef} className="challenge-camera-video" aria-label={cameraLabel} autoPlay muted playsInline />
        {phase !== "instructions" ? <span className="challenge-camera-status">{cameraStatus}</span> : null}
      </section>
      <header className="stage-header challenge-stage__header">
        <button className="back-action" type="button" onClick={onBack}>{backLabel}</button>
        <span className="stage-brand">FullyDancy</span>
        <span className="stage-mode">04 / 04</span>
      </header>

      <section className="challenge-shell challenge-shell--live" aria-labelledby="challenge-title">
        <section className="challenge-reference-overlay challenge-reference-overlay--full-height" aria-label={referenceTitle}>
          <div className="challenge-reference-stage">
            {activeFrame ? <DemoSkeleton frame={activeFrame} /> : <span className="challenge-empty-state">{loadingText}</span>}
          </div>
        </section>

        <section className="challenge-hud challenge-hud--floating" aria-label="挑战状态">
          <div className="challenge-hud__identity">
            <span>{kicker}</span>
            <h1 id="challenge-title">{title}</h1>
          </div>
          <div className="challenge-hud__metrics">
            <span>{chart.length} 个卡点</span>
            <span>{poseStatus}</span>
          </div>
        </section>

        <div className="challenge-transport challenge-transport--floating" aria-label="播放控制">
          {phase === "active" ? <button type="button" onClick={togglePlayback}>{playing ? "暂停" : "继续"}</button> : null}
          {phase === "active" ? <button type="button" onClick={restart}>重新开始</button> : null}
          {phase === "active" ? <span aria-live="polite">{gestureStatus}</span> : null}
          {phase === "camera-error" ? <button type="button" onClick={() => void startChallenge()}>重试摄像头</button> : null}
        </div>
      </section>

      {phase === "instructions" ? (
        <div className="challenge-instructions-layer">
          <section className="challenge-instructions" role="dialog" aria-modal="true" aria-labelledby="challenge-instructions-title">
            <h2 id="challenge-instructions-title">舞蹈玩法</h2>
            <p>跟随绿色骨架完成动作</p>
            <p>单手张开保持 0.6 秒：播放或暂停</p>
            <p>双手举过头顶保持 1 秒：重新开始</p>
            <button className="primary-action" type="button" onClick={() => void startChallenge()}>开始舞蹈</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
