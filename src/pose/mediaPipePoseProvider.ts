import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { PoseFrame, PoseLandmark } from "../domain/types";
import type { PoseModelTier, PoseProvider } from "./types";

const modelPaths: Record<PoseModelTier, string> = {
  full: "/models/pose_landmarker_full-v1.task",
  lite: "/models/pose_landmarker_lite-v1.task",
};

export interface MediaPipePoseResult { landmarks: PoseLandmark[][]; }
interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): MediaPipePoseResult;
  close(): void;
}
export interface MediaPipeRuntime {
  createLandmarker(options: { modelAssetPath: string; delegate: "GPU" | "CPU" }): Promise<Landmarker>;
}

export interface PosePerformanceStats {
  sampleCount: number;
  meanMs: number | null;
  p95Ms: number | null;
}

function browserRuntime(): MediaPipeRuntime {
  let vision: ReturnType<typeof FilesetResolver.forVisionTasks> | undefined;
  return {
    async createLandmarker({ modelAssetPath, delegate }) {
      vision ??= FilesetResolver.forVisionTasks("/wasm");
      return PoseLandmarker.createFromOptions(await vision, {
        baseOptions: { modelAssetPath, delegate }, runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: false,
      });
    },
  };
}

export function normalizePoseResult(result: MediaPipePoseResult | PoseLandmarkerResult, captureTimeSec: number): PoseFrame | null {
  const landmarks = result.landmarks[0];
  return landmarks ? { captureTimeSec, landmarks } : null;
}

export class MediaPipePoseProvider implements PoseProvider {
  private readonly runtime: MediaPipeRuntime;
  private readonly now: () => number;
  private landmarker: Landmarker | null = null;
  private tier: PoseModelTier = "full";
  private recentDurations: number[] = [];
  private fullDurations: number[] = [];
  private lifecycle = 0;
  private switching = false;
  private downgradeError: string | null = null;

  constructor(options: { runtime?: MediaPipeRuntime; now?: () => number } = {}) {
    this.runtime = options.runtime ?? browserRuntime();
    this.now = options.now ?? (() => performance.now());
  }

  async start(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    const landmarker = await this.create("full");
    if (lifecycle !== this.lifecycle) return landmarker.close();
    this.landmarker?.close();
    this.landmarker = landmarker;
    this.tier = "full";
    this.recentDurations = [];
    this.fullDurations = [];
    this.downgradeError = null;
  }

  detect(video: HTMLVideoElement, captureTimeSec: number): PoseFrame | null {
    if (!this.landmarker) return null;
    const startedAt = this.now();
    const result = this.landmarker.detectForVideo(video, captureTimeSec * 1000);
    this.recordDuration(this.now() - startedAt);
    return normalizePoseResult(result, captureTimeSec);
  }

  stop(): void {
    this.lifecycle += 1;
    this.landmarker?.close();
    this.landmarker = null;
    this.recentDurations = [];
    this.fullDurations = [];
  }

  getModelTier(): PoseModelTier { return this.tier; }
  getDowngradeError(): string | null { return this.downgradeError; }
  getPerformanceStats(): PosePerformanceStats {
    const sampleCount = this.recentDurations.length;
    if (sampleCount === 0) return { sampleCount: 0, meanMs: null, p95Ms: null };
    const meanMs = this.recentDurations.reduce((total, value) => total + value, 0) / sampleCount;
    const sorted = [...this.recentDurations].sort((left, right) => left - right);
    const p95Ms = sorted[Math.ceil(sampleCount * 0.95) - 1] ?? null;
    return { sampleCount, meanMs, p95Ms };
  }

  private recordDuration(duration: number): void {
    this.recentDurations.push(duration);
    if (this.recentDurations.length > 120) this.recentDurations.shift();
    if (this.tier !== "full" || this.switching || this.downgradeError) return;
    this.fullDurations.push(duration);
    if (this.fullDurations.length < 120) return;
    const average = this.fullDurations.reduce((total, value) => total + value, 0) / 120;
    if (average > 45) {
      void this.switchToLite().catch((error) => { this.downgradeError = error instanceof Error ? error.message : String(error); });
    } else {
      this.fullDurations.shift();
    }
  }

  private async switchToLite(): Promise<void> {
    this.switching = true;
    const lifecycle = this.lifecycle;
    try {
      const lite = await this.create("lite");
      if (lifecycle !== this.lifecycle) return lite.close();
      const full = this.landmarker;
      this.landmarker = lite;
      this.tier = "lite";
      full?.close();
    } finally {
      this.switching = false;
    }
  }

  private async create(tier: PoseModelTier): Promise<Landmarker> {
    try { return await this.runtime.createLandmarker({ modelAssetPath: modelPaths[tier], delegate: "GPU" }); }
    catch { return this.runtime.createLandmarker({ modelAssetPath: modelPaths[tier], delegate: "CPU" }); }
  }
}
