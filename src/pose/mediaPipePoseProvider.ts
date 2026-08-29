import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { PoseFrame, PoseLandmark } from "../domain/types";
import type { PoseModelTier, PoseProvider } from "./types";

const modelPaths: Record<PoseModelTier, string> = {
  heavy: "/models/pose_landmarker_heavy-v1.task",
  full: "/models/pose_landmarker_full-v1.task",
  lite: "/models/pose_landmarker_lite-v1.task",
};

export interface MediaPipePoseResult {
  landmarks: PoseLandmark[][];
  worldLandmarks?: PoseLandmark[][];
}
interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): MediaPipePoseResult;
  close(): void;
}
export interface MediaPipeRuntime {
  createLandmarker(options: {
    modelAssetPath: string;
    delegate: "GPU" | "CPU";
    minPoseDetectionConfidence: number;
    minPosePresenceConfidence: number;
    minTrackingConfidence: number;
  }): Promise<Landmarker>;
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
        baseOptions: { modelAssetPath, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.65,
        minPosePresenceConfidence: 0.65,
        minTrackingConfidence: 0.7,
      });
    },
  };
}

export function normalizePoseResult(result: MediaPipePoseResult | PoseLandmarkerResult, captureTimeSec: number): PoseFrame | null {
  const landmarks = result.landmarks[0];
  if (!landmarks) return null;
  const worldLandmarks = result.worldLandmarks?.[0];
  return worldLandmarks ? { captureTimeSec, landmarks, worldLandmarks } : { captureTimeSec, landmarks };
}

export class MediaPipePoseProvider implements PoseProvider {
  private readonly runtime: MediaPipeRuntime;
  private readonly now: () => number;
  private landmarker: Landmarker | null = null;
  private tier: PoseModelTier = "heavy";
  private recentDurations: number[] = [];
  private tierDurations: number[] = [];
  private previousFrame: PoseFrame | null = null;
  private lifecycle = 0;
  private switching = false;
  private downgradeError: string | null = null;

  constructor(options: { runtime?: MediaPipeRuntime; now?: () => number } = {}) {
    this.runtime = options.runtime ?? browserRuntime();
    this.now = options.now ?? (() => performance.now());
  }

  async start(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    const landmarker = await this.create("heavy");
    if (lifecycle !== this.lifecycle) return landmarker.close();
    this.landmarker?.close();
    this.landmarker = landmarker;
    this.tier = "heavy";
    this.recentDurations = [];
    this.tierDurations = [];
    this.previousFrame = null;
    this.downgradeError = null;
  }

  detect(video: HTMLVideoElement, captureTimeSec: number): PoseFrame | null {
    if (!this.landmarker) return null;
    const startedAt = this.now();
    const result = this.landmarker.detectForVideo(video, captureTimeSec * 1000);
    this.recordDuration(this.now() - startedAt);
    const frame = normalizePoseResult(result, captureTimeSec);
    if (!frame) return null;
    const stableFrame = this.stabilizeFrame(frame);
    this.previousFrame = stableFrame;
    return stableFrame;
  }

  stop(): void {
    this.lifecycle += 1;
    this.landmarker?.close();
    this.landmarker = null;
    this.recentDurations = [];
    this.tierDurations = [];
    this.previousFrame = null;
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
    if (this.tier === "lite" || this.switching || this.downgradeError) return;
    this.tierDurations.push(duration);
    if (this.tierDurations.length < 120) return;
    const average = this.tierDurations.reduce((total, value) => total + value, 0) / 120;
    if (average > 45) {
      void this.switchToNextLowerTier().catch((error) => { this.downgradeError = error instanceof Error ? error.message : String(error); });
    } else {
      this.tierDurations.shift();
    }
  }

  private async switchToNextLowerTier(): Promise<void> {
    const nextTier = this.tier === "heavy" ? "full" : "lite";
    this.switching = true;
    const lifecycle = this.lifecycle;
    try {
      const next = await this.create(nextTier);
      if (lifecycle !== this.lifecycle) return next.close();
      const previous = this.landmarker;
      this.landmarker = next;
      this.tier = nextTier;
      this.recentDurations = [];
      this.tierDurations = [];
      this.previousFrame = null;
      previous?.close();
    } finally {
      this.switching = false;
    }
  }

  private stabilizeFrame(frame: PoseFrame): PoseFrame {
    if (!this.previousFrame) return frame;
    return {
      ...frame,
      landmarks: this.stabilizeLandmarks(frame.landmarks, this.previousFrame.landmarks),
      worldLandmarks: frame.worldLandmarks && this.previousFrame.worldLandmarks
        ? this.stabilizeLandmarks(frame.worldLandmarks, this.previousFrame.worldLandmarks)
        : frame.worldLandmarks,
    };
  }

  private stabilizeLandmarks(current: PoseLandmark[], previous: PoseLandmark[]): PoseLandmark[] {
    return current.map((landmark, index) => {
      if (landmark.visibility >= 0.25) return landmark;
      const fallback = previous[index];
      if (!fallback || fallback.visibility < 0.45) return landmark;
      return { ...fallback, visibility: 0.24 };
    });
  }

  private async create(tier: PoseModelTier): Promise<Landmarker> {
    const options = {
      modelAssetPath: modelPaths[tier],
      minPoseDetectionConfidence: 0.65,
      minPosePresenceConfidence: 0.65,
      minTrackingConfidence: 0.7,
    };
    try { return await this.runtime.createLandmarker({ ...options, delegate: "GPU" }); }
    catch { return this.runtime.createLandmarker({ ...options, delegate: "CPU" }); }
  }
}
