import rawPoseCache from "./assets/level-1.pose.json";
import type { DemoPoseCache } from "../analysis/demoPoseCache";

export function validateBuiltInPoseCache(value: unknown, durationSec: number): DemoPoseCache {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Built-in pose cache is empty");
  let previous = -1;
  for (const frame of value) {
    if (typeof frame !== "object" || frame === null) throw new Error("Invalid built-in pose frame");
    const candidate = frame as { captureTimeSec?: unknown; landmarks?: unknown };
    if (typeof candidate.captureTimeSec !== "number" || candidate.captureTimeSec < previous) throw new Error("Built-in pose frames must be ordered");
    if (!Array.isArray(candidate.landmarks) || candidate.landmarks.length !== 33) throw new Error("Built-in pose frame must contain 33 landmarks");
    previous = candidate.captureTimeSec;
  }
  if (previous < durationSec - 0.1) throw new Error("Built-in pose cache does not cover the level duration");
  return value as DemoPoseCache;
}

export const LEVEL_1_POSE_CACHE = validateBuiltInPoseCache(rawPoseCache, 13);
