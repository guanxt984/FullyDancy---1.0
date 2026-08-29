import type { ActionRequirement, BeatPoint, PoseFrame, PoseLandmark } from "../domain/types";

const WINDOW_SEC = 0.25;
const STRAIGHT_ARM_DEGREES = 155;
const SQUAT_DROP = 0.08;

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && landmark.visibility >= 0.45);
}

function angleDegrees(a: PoseLandmark, joint: PoseLandmark, b: PoseLandmark): number {
  const ax = a.x - joint.x;
  const ay = a.y - joint.y;
  const bx = b.x - joint.x;
  const by = b.y - joint.y;
  const dot = ax * bx + ay * by;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (length === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / length));
  return Math.acos(cosine) * (180 / Math.PI);
}

function armStraight(frame: PoseFrame, side: "left" | "right"): boolean {
  const [shoulderIndex, elbowIndex, wristIndex] = side === "left" ? [11, 13, 15] : [12, 14, 16];
  const shoulder = frame.landmarks[shoulderIndex];
  const elbow = frame.landmarks[elbowIndex];
  const wrist = frame.landmarks[wristIndex];
  return isVisible(shoulder) && isVisible(elbow) && isVisible(wrist) && angleDegrees(shoulder, elbow, wrist) >= STRAIGHT_ARM_DEGREES;
}

function hipY(frame: PoseFrame): number | null {
  const left = frame.landmarks[23];
  const right = frame.landmarks[24];
  if (!isVisible(left) || !isVisible(right)) return null;
  return (left.y + right.y) / 2;
}

function framesNear(cache: PoseFrame[], timeSec: number): PoseFrame[] {
  return cache.filter((frame) => Math.abs(frame.captureTimeSec - timeSec) <= WINDOW_SEC);
}

function standingBaseline(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function inferAction(beat: BeatPoint, cache: PoseFrame[], standingHipY: number | null): ActionRequirement {
  const nearby = framesNear(cache, beat.timeSec);
  if (nearby.some((frame) => armStraight(frame, "left") || armStraight(frame, "right"))) return "open";

  if (standingHipY !== null) {
    const deepestHip = Math.max(...nearby.map(hipY).filter((value): value is number => value !== null));
    if (Number.isFinite(deepestHip) && deepestHip - standingHipY >= SQUAT_DROP) return "squat";
  }

  return "rhythm";
}

export function inferBeatActionsFromPose(beats: BeatPoint[], cache: PoseFrame[]): BeatPoint[] {
  const standingHipY = standingBaseline(cache.map(hipY).filter((value): value is number => value !== null));
  return beats.map((beat) => {
    if (!beat.enabled) return beat;
    const action = inferAction(beat, cache, standingHipY);
    return { ...beat, action, actions: beat.actions?.length ? beat.actions : [action] };
  });
}

