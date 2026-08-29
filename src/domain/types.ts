export type ActionRequirement = "rhythm" | "open" | "squat";
export type TimingGrade = "perfect" | "great" | "early" | "late" | "miss";
export type ActionGrade = "hit" | "miss" | "unjudgeable";
export type Side = "left" | "right";
export type Reliable<T> =
  | { kind: "value"; value: T }
  | { kind: "unjudgeable"; reason: string };

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  captureTimeSec: number;
  landmarks: PoseLandmark[];
  worldLandmarks?: PoseLandmark[];
}

export interface CameraSignature {
  bodyScale: number;
  centerX: number;
  centerY: number;
  limbRatios: Record<string, number>;
}

export interface CalibrationProfile {
  shoulderWidth: number;
  hipWidth: number;
  bodyHeight: number;
  armSpan: number;
  armLength: number;
  armLengthRatio: number;
  legLengthRatio: number;
  lowestSquatHipY: number;
  squatDepthRatio: number;
  cameraScale: number;
  capturedAt: number;
}

export interface BeatPoint {
  id: string;
  beatIndex: number;
  timeSec: number;
  salience: number;
  enabled: boolean;
  action: ActionRequirement;
  actions?: ActionRequirement[];
}

export interface BeatJudgement {
  grade: TimingGrade;
  deltaMs: number | null;
  endpointId: string | null;
}

export interface ActionJudgement {
  action: Exclude<ActionRequirement, "rhythm">;
  grade: ActionGrade;
  reason?: string;
}

export interface BeatResult {
  beatId: string;
  timing: BeatJudgement;
  action: ActionJudgement | null;
}
