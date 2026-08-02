import type { PoseFrame } from "../domain/types";

export interface PoseProvider {
  start(): Promise<void>;
  detect(video: HTMLVideoElement, captureTimeSec: number): PoseFrame | null;
  stop(): void;
}

export type PoseModelTier = "full" | "lite";
