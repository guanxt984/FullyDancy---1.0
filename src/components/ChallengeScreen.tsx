import { useCallback, useEffect, useRef, useState } from "react";
import { nearestPoseFrame } from "../analysis/demoPoseCache";
import type { BeatPoint, PoseFrame, PoseLandmark } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import type { SharedCameraSession } from "../pose/camera";
import { MediaPipePoseProvider } from "../pose/mediaPipePoseProvider";
import { runPoseLoop } from "../pose/poseLoop";
import type { PoseProvider } from "../pose/types";
import { DanceGestureController } from "./gestureControls";

interface ChallengeScreenProps {
  level: BuiltInLevel;
  chart: BeatPoint[];
  cameraSession: SharedCameraSession | null;
  onBack: () => void;
  providerFactory?: () => PoseProvider;
  poseLoop?: typeof runPoseLoop;
}

const backLabel = "返回";
const referenceTitle = "示范骨架舞者";
const cameraTitle = "你的实时舞蹈画面";
const skeletonLabel = "示范骨架运动";
const cameraLabel = "用户摄像头预览";
const returnToCalibrationLabel = "返回校准开启摄像头";

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
  cameraSession,
  onBack,
  providerFactory = () => new MediaPipePoseProvider(),
  poseLoop = runPoseLoop,
}: ChallengeScreenProps) {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const cameraLayerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const challengeShellRef = useRef<HTMLElement>(null);
  const returnCameraRef = useRef<HTMLButtonElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);
  const playingRef = useRef(false);
  const gestureRef = useRef(new DanceGestureController());
  const [cameraStatus, setCameraStatus] = useState("等待开始舞蹈");
  const [currentTime, setCurrentTime] = useState(0);
  const [phase, setPhase] = useState<"instructions" | "starting" | "active" | "session-error">("instructions");
  const [playing, setPlaying] = useState(false);
  const [gestureStatus, setGestureStatus] = useState("张开单手掌暂停 / 继续，双手举过头顶重新开始");
  const activeFrame = nearestPoseFrame(level.poseCache, currentTime, 0.18) ?? level.poseCache[0] ?? null;
  const hasLiveCamera = Boolean(cameraSession?.isLive());

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

  const leaveChallenge = useCallback(() => {
    releaseRef.current?.();
    onBack();
  }, [onBack]);

  const startChallenge = useCallback(async () => {
    const cameraVideo = cameraRef.current;
    const media = mediaRef.current;
    const session = cameraSession;
    if (!session || !session.isLive()) {
      leaveChallenge();
      return;
    }
    if (!cameraVideo || !media || releaseRef.current || phase !== "instructions") return;

    setPhase("starting");
    setCameraStatus("正在连接校准摄像头…");
    let provider: PoseProvider | null = null;
    let cancelLoop: (() => void) | null = null;
    let cameraAttached = false;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      cancelLoop?.();
      cancelLoop = null;
      provider?.stop();
      provider = null;
      media.pause();
      playingRef.current = false;
      if (mountedRef.current) setPlaying(false);
      session.detach(cameraVideo);
      if (releaseRef.current === release) releaseRef.current = null;
    };
    releaseRef.current = release;

    const mediaPlayPromise = play().then(() => true).catch(() => false);
    try {
      await session.attach(cameraVideo);
      cameraAttached = true;
      if (!mountedRef.current || releaseRef.current !== release) {
        release();
        return;
      }

      provider = providerFactory();
      await provider.start();
      if (!mountedRef.current || releaseRef.current !== release) {
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
      setCameraStatus("摄像头已连接");

      const playbackStarted = await mediaPlayPromise;
      if (!mountedRef.current || releaseRef.current !== release) {
        release();
        return;
      }
      if (!playbackStarted) {
        setGestureStatus("媒体未能自动播放，请点击继续；也可使用单手手势开始");
      }
      setPhase("active");
    } catch {
      release();
      if (!mountedRef.current) return;
      setCameraStatus(cameraAttached ? "姿态识别启动失败，请返回校准后重试" : "摄像头连接失败，请返回校准重新开启");
      setPhase("session-error");
    }
  }, [cameraSession, leaveChallenge, phase, play, poseLoop, providerFactory, restart, togglePlayback]);

  useEffect(() => {
    if (phase === "session-error") returnCameraRef.current?.focus();
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
        <button className="back-action" type="button" tabIndex={phase === "instructions" ? -1 : undefined} onClick={leaveChallenge}>{backLabel}</button>
      </header>

      <section ref={challengeShellRef} className="challenge-shell challenge-shell--live" aria-label="舞蹈挑战">
        <section className="challenge-reference-overlay challenge-reference-overlay--full-height" aria-label={referenceTitle}>
          <div className="challenge-reference-stage">
            {activeFrame ? <DemoSkeleton frame={activeFrame} /> : null}
          </div>
        </section>

        <div className="challenge-transport challenge-transport--floating" aria-label="播放控制">
          {phase === "active" ? <button type="button" onClick={togglePlayback}>{playing ? "暂停" : "继续"}</button> : null}
          {phase === "active" ? <button type="button" onClick={restart}>重新开始</button> : null}
          {phase === "active" ? <span aria-live="polite">{gestureStatus}</span> : null}
          {phase === "session-error" ? <button ref={returnCameraRef} type="button" onClick={leaveChallenge}>{returnToCalibrationLabel}</button> : null}
        </div>
      </section>

      {phase === "instructions" ? (
        <div className="challenge-instructions-layer">
          <section className="challenge-instructions" role="dialog" aria-modal="true" aria-labelledby="challenge-instructions-title">
            <h2 id="challenge-instructions-title">舞蹈玩法</h2>
            <p>跟随绿色骨架完成动作</p>
            <p>单手张开保持 0.6 秒：播放或暂停</p>
            <p>双手举过头顶保持 1 秒：重新开始</p>
            {hasLiveCamera ? (
              <button className="primary-action" type="button" autoFocus onClick={() => void startChallenge()}>开始舞蹈</button>
            ) : (
              <button className="primary-action" type="button" autoFocus onClick={leaveChallenge}>{returnToCalibrationLabel}</button>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
