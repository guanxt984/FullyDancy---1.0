import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseFrame, PoseLandmark } from "../domain/types";
import { startCamera, type CameraSession } from "../pose/camera";
import {
  MediaPipePoseProvider,
  type PosePerformanceStats,
} from "../pose/mediaPipePoseProvider";
import { runPoseLoop } from "../pose/poseLoop";
import type { PoseModelTier } from "../pose/types";

const SKELETON_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
] as const;

const RETEST_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "user",
  width: { ideal: 960 },
  height: { ideal: 540 },
};

interface Telemetry extends PosePerformanceStats {
  tier: PoseModelTier;
  downgradeError: string | null;
}

const EMPTY_TELEMETRY: Telemetry = {
  tier: "full",
  sampleCount: 0,
  meanMs: null,
  p95Ms: null,
  downgradeError: null,
};

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && landmark.visibility >= 0.5);
}

function drawSkeleton(canvas: HTMLCanvasElement, frame: PoseFrame): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#32e6a1";
  context.fillStyle = "#ffffff";
  context.lineWidth = 3;

  for (const [fromIndex, toIndex] of SKELETON_CONNECTIONS) {
    const from = frame.landmarks[fromIndex];
    const to = frame.landmarks[toIndex];
    if (!isVisible(from) || !isVisible(to)) continue;
    context.beginPath();
    context.moveTo((1 - from.x) * canvas.width, from.y * canvas.height);
    context.lineTo((1 - to.x) * canvas.width, to.y * canvas.height);
    context.stroke();
  }

  for (const landmark of frame.landmarks) {
    if (!isVisible(landmark)) continue;
    context.beginPath();
    context.arc((1 - landmark.x) * canvas.width, landmark.y * canvas.height, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function formatDuration(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} ms`;
}

export function TechnicalSlice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const loopRef = useRef<(() => void) | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState("摄像头尚未启动");
  const [poseFrame, setPoseFrame] = useState<PoseFrame | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY_TELEMETRY);

  const stop = useCallback(() => {
    requestRef.current += 1;
    loopRef.current?.();
    loopRef.current = null;
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  const start = useCallback(async (videoConstraints?: MediaTrackConstraints) => {
    const video = videoRef.current;
    if (!video) return;
    stop();
    const request = requestRef.current;
    let camera: CameraSession | null = null;
    let release: (() => void) | null = null;
    setPoseFrame(null);
    setTelemetry(EMPTY_TELEMETRY);
    setStatus("正在启动本地摄像头和姿态模型…");
    try {
      camera = await startCamera(video, { videoConstraints });
      if (request !== requestRef.current) return camera.stop();
      const activeCamera = camera;
      const provider = new MediaPipePoseProvider();
      let released = false;
      release = () => {
        if (released) return;
        released = true;
        provider.stop();
        activeCamera.stop();
      };
      releaseRef.current = release;
      await provider.start();
      if (request !== requestRef.current) return;
      const updateTelemetry = () => {
        const performance = provider.getPerformanceStats();
        setTelemetry({
          tier: provider.getModelTier(),
          ...performance,
          downgradeError: provider.getDowngradeError(),
        });
      };
      updateTelemetry();
      loopRef.current = runPoseLoop({
        video,
        provider,
        onFrame(frame) {
          if (request !== requestRef.current) return;
          setPoseFrame(frame);
          updateTelemetry();
        },
      });
      setStatus("本地姿态检测运行中（目标 20 FPS）");
    } catch (error) {
      if (release) release();
      else camera?.stop();
      if (releaseRef.current === release) releaseRef.current = null;
      if (request === requestRef.current) {
        setStatus(`启动失败：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
  }, [stop]);

  useEffect(() => {
    if (poseFrame && canvasRef.current) drawSkeleton(canvasRef.current, poseFrame);
  }, [poseFrame]);
  useEffect(() => stop, [stop]);

  return (
    <section aria-labelledby="technical-slice-title">
      <h2 id="technical-slice-title">摄像头与姿态性能验证</h2>
      <p role="status">{status}</p>
      <div style={{ position: "relative", width: "min(100%, 960px)", aspectRatio: "16 / 9", background: "#111827" }}>
        <video
          ref={videoRef}
          data-testid="camera-preview"
          aria-label="本地摄像头镜像预览"
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          data-testid="pose-skeleton"
          aria-label="姿态骨架叠加层"
          width={960}
          height={540}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
      </div>
      <dl aria-label="MediaPipe 推理指标">
        <div><dt>当前模型</dt><dd>{telemetry.tier === "full" ? "Full" : "Lite"}</dd></div>
        <div><dt>平均推理耗时</dt><dd>{formatDuration(telemetry.meanMs)}</dd></div>
        <div><dt>P95 推理耗时</dt><dd>{formatDuration(telemetry.p95Ms)}</dd></div>
      </dl>
      {telemetry.downgradeError ? <p role="alert">Lite 切换失败：{telemetry.downgradeError}</p> : null}
      <button type="button" onClick={() => void start()}>启动本地摄像头</button>
      <button type="button" onClick={() => void start(RETEST_CONSTRAINTS)}>960 × 540 复测</button>
      <button type="button" onClick={stop}>停止摄像头</button>
    </section>
  );
}
