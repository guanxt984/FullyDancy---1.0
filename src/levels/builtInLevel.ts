import type { DemoPoseCache } from "../analysis/demoPoseCache";
import { LEVEL_1_POSE_CACHE } from "./builtInPose";

export interface BuiltInLevel {
  id: string;
  title: string;
  videoUrl: string;
  durationSec: number;
  poseCache?: DemoPoseCache;
}

export const BUILT_IN_LEVEL = {
  id: "level-1",
  title: "8月3日舞蹈挑战",
  videoUrl: "/levels/level-1.mp4",
  durationSec: 13,
  poseCache: LEVEL_1_POSE_CACHE,
} satisfies BuiltInLevel;
