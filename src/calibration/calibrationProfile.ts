import type { CalibrationProfile, PoseFrame, PoseLandmark } from "../domain/types";

const REQUIRED_FULL_BODY = [11, 12, 15, 16, 23, 24, 27, 28] as const;
const CALIBRATION_VISIBILITY_THRESHOLD = 0.25;

function visible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && landmark.visibility >= CALIBRATION_VISIBILITY_THRESHOLD);
}

function distanceX(left: PoseLandmark | undefined, right: PoseLandmark | undefined): number | null {
  return visible(left) && visible(right) ? Math.abs(right.x - left.x) : null;
}

function distance(left: PoseLandmark | undefined, right: PoseLandmark | undefined): number | null {
  if (!visible(left) || !visible(right)) return null;
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

export function hasFullBodyInFrame(frame: PoseFrame | null): boolean {
  return Boolean(frame && REQUIRED_FULL_BODY.every((index) => visible(frame.landmarks[index])));
}

export function buildCalibrationProfile(
  standingFrames: PoseFrame[],
  openArmFrames: PoseFrame[],
  squatFramesOrCapturedAt: PoseFrame[] | number = [],
  capturedAtArg = Date.now(),
): CalibrationProfile {
  const squatFrames = Array.isArray(squatFramesOrCapturedAt) ? squatFramesOrCapturedAt : [];
  const capturedAt = Array.isArray(squatFramesOrCapturedAt) ? capturedAtArg : squatFramesOrCapturedAt;
  const standingMetrics = standingFrames.filter(hasFullBodyInFrame).map((frame) => {
    const shoulderWidth = distanceX(frame.landmarks[11], frame.landmarks[12]) ?? 0;
    const hipWidth = distanceX(frame.landmarks[23], frame.landmarks[24]) ?? 0;
    const top = Math.min(frame.landmarks[11]?.y ?? 0, frame.landmarks[12]?.y ?? 0);
    const bottom = Math.max(frame.landmarks[27]?.y ?? 0, frame.landmarks[28]?.y ?? 0);
    const leftLeg = (distance(frame.landmarks[23], frame.landmarks[25]) ?? 0) + (distance(frame.landmarks[25], frame.landmarks[27]) ?? 0);
    const rightLeg = (distance(frame.landmarks[24], frame.landmarks[26]) ?? 0) + (distance(frame.landmarks[26], frame.landmarks[28]) ?? 0);
    const hipY = average([frame.landmarks[23]?.y ?? 0, frame.landmarks[24]?.y ?? 0]);
    return { shoulderWidth, hipWidth, bodyHeight: Math.max(0, bottom - top), legLength: average([leftLeg, rightLeg]), hipY };
  });
  const starMetrics = openArmFrames.filter(hasFullBodyInFrame).map((frame) => {
    const leftArm = distance(frame.landmarks[11], frame.landmarks[15]) ?? 0;
    const rightArm = distance(frame.landmarks[12], frame.landmarks[16]) ?? 0;
    return {
      armSpan: distanceX(frame.landmarks[15], frame.landmarks[16]) ?? 0,
      armLength: average([leftArm, rightArm]),
    };
  });
  const squatHipYs = squatFrames.filter(hasFullBodyInFrame).map((frame) => average([frame.landmarks[23]?.y ?? 0, frame.landmarks[24]?.y ?? 0]));
  const bodyHeight = rounded(average(standingMetrics.map((item) => item.bodyHeight)));
  const armLength = rounded(Math.max(...starMetrics.map((item) => item.armLength), 0));
  const lowestSquatHipY = rounded(Math.max(...squatHipYs, 0));
  const standingHipY = average(standingMetrics.map((item) => item.hipY));

  return {
    shoulderWidth: rounded(average(standingMetrics.map((item) => item.shoulderWidth))),
    hipWidth: rounded(average(standingMetrics.map((item) => item.hipWidth))),
    bodyHeight,
    armSpan: rounded(Math.max(...starMetrics.map((item) => item.armSpan), 0)),
    armLength,
    armLengthRatio: bodyHeight ? rounded(armLength / bodyHeight) : 0,
    legLengthRatio: bodyHeight ? rounded(average(standingMetrics.map((item) => item.legLength)) / bodyHeight) : 0,
    lowestSquatHipY,
    squatDepthRatio: bodyHeight ? rounded(Math.max(0, lowestSquatHipY - standingHipY) / bodyHeight) : 0,
    cameraScale: bodyHeight,
    capturedAt,
  };
}
