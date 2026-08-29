import type { PoseFrame, PoseLandmark } from "../domain/types";

export type DanceGestureAction = "toggle-playback" | "restart";

function visible(point: PoseLandmark | undefined): point is PoseLandmark {
  return Boolean(point && point.visibility >= 0.55);
}

function distance(a: PoseLandmark, b: PoseLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasHandsOverhead(frame: PoseFrame): boolean {
  const nose = frame.landmarks[0];
  const leftWrist = frame.landmarks[15];
  const rightWrist = frame.landmarks[16];
  return visible(nose) && visible(leftWrist) && visible(rightWrist) && leftWrist.y < nose.y && rightWrist.y < nose.y;
}

function hasOpenPalm(frame: PoseFrame): boolean {
  const shoulderWidth = distance(frame.landmarks[11], frame.landmarks[12]);
  return [
    [15, 17, 19, 21],
    [16, 18, 20, 22],
  ].some(([wristIndex, pinkyIndex, indexIndex, thumbIndex]) => {
    const wrist = frame.landmarks[wristIndex];
    const pinky = frame.landmarks[pinkyIndex];
    const index = frame.landmarks[indexIndex];
    const thumb = frame.landmarks[thumbIndex];
    if (![wrist, pinky, index, thumb].every(visible)) return false;
    return distance(pinky, thumb) >= shoulderWidth * 0.55 && distance(wrist, index) >= shoulderWidth * 0.45;
  });
}

function classifyGesture(frame: PoseFrame | null): DanceGestureAction | null {
  if (!frame) return null;
  if (hasHandsOverhead(frame)) return "restart";
  if (hasOpenPalm(frame)) return "toggle-playback";
  return null;
}

export class DanceGestureController {
  private candidate: DanceGestureAction | null = null;
  private candidateSinceMs = 0;
  private latched = false;

  update(frame: PoseFrame | null, nowMs: number): DanceGestureAction | null {
    const next = classifyGesture(frame);
    if (!next) {
      this.candidate = null;
      this.latched = false;
      return null;
    }
    if (this.latched) return null;
    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateSinceMs = nowMs;
      return null;
    }
    const holdMs = next === "restart" ? 1000 : 600;
    if (nowMs - this.candidateSinceMs < holdMs) return null;
    this.latched = true;
    return next;
  }
}
