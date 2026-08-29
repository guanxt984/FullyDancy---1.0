import rawPoseCache from "./assets/level-1.pose.json";
import type { DemoPoseCache } from "../analysis/demoPoseCache";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateLandmarks(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 33) throw new Error(`Built-in pose frame must contain 33 ${label} landmarks`);
  for (const landmark of value) {
    if (typeof landmark !== "object" || landmark === null) throw new Error(`Invalid built-in ${label} landmark`);
    const candidate = landmark as Record<string, unknown>;
    if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) || !isFiniteNumber(candidate.z) || !isFiniteNumber(candidate.visibility)) {
      throw new Error(`Built-in ${label} landmark must contain finite x, y, z, and visibility values`);
    }
  }
}

export function validateBuiltInPoseCache(value: unknown, durationSec: number): DemoPoseCache {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Built-in pose cache is empty");
  let previous = -1;
  for (const frame of value) {
    if (typeof frame !== "object" || frame === null) throw new Error("Invalid built-in pose frame");
    const candidate = frame as { captureTimeSec?: unknown; landmarks?: unknown; worldLandmarks?: unknown };
    if (!isFiniteNumber(candidate.captureTimeSec) || candidate.captureTimeSec < 0) throw new Error("Built-in pose frame captureTimeSec must be a finite non-negative number");
    if (candidate.captureTimeSec < previous) throw new Error("Built-in pose frames must be ordered");
    validateLandmarks(candidate.landmarks, "pose");
    if (candidate.worldLandmarks !== undefined) validateLandmarks(candidate.worldLandmarks, "world");
    previous = candidate.captureTimeSec;
  }
  if (previous < durationSec - 0.1) throw new Error("Built-in pose cache does not cover the level duration");
  return value as DemoPoseCache;
}

export const LEVEL_1_POSE_CACHE = validateBuiltInPoseCache(rawPoseCache, 13);
