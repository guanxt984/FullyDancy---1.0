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
}

export interface CameraSignature {
  bodyScale: number;
  centerX: number;
  centerY: number;
  limbRatios: Record<string, number>;
}

export interface CalibrationProfile {
  bodyScale: number;
  straightArmAngle: Record<Side, number>;
  standingHipHeight: number;
  squatDepth: number | null;
  cameraSignature: CameraSignature;
}

export interface BeatPoint {
  id: string;
  beatIndex: number;
  timeSec: number;
  salience: number;
  enabled: boolean;
  action: ActionRequirement;
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
