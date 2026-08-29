import { describe, expect, it } from "vitest";
import type { PoseFrame } from "../domain/types";
import { buildCalibrationProfile, hasFullBodyInFrame } from "./calibrationProfile";

function frame(points: Record<number, [number, number, number?]>): PoseFrame {
  return {
    captureTimeSec: 0,
    landmarks: Array.from({ length: 33 }, (_, index) => {
      const point = points[index] ?? [0.5, 0.5, 0.2];
      return { x: point[0], y: point[1], z: 0, visibility: point[2] ?? 0.9 };
    }),
  };
}

describe("calibrationProfile", () => {
  it("detects whether the required full body landmarks are visible", () => {
    const fullBody = frame({
      11: [0.42, 0.28], 12: [0.58, 0.28], 15: [0.2, 0.48], 16: [0.8, 0.48],
      23: [0.44, 0.6], 24: [0.56, 0.6], 27: [0.42, 0.92], 28: [0.58, 0.92],
    });
    const missingFoot = frame({
      11: [0.42, 0.28], 12: [0.58, 0.28], 15: [0.2, 0.48], 16: [0.8, 0.48],
      23: [0.44, 0.6], 24: [0.56, 0.6], 27: [0.42, 0.92, 0.2], 28: [0.58, 0.92],
    });

    expect(hasFullBodyInFrame(fullBody)).toBe(true);
    expect(hasFullBodyInFrame(missingFoot)).toBe(false);
  });

  it("records body scale, arm length, leg ratio and lowest squat from the three calibration tasks", () => {
    const standing = frame({
      11: [0.42, 0.25], 12: [0.58, 0.25], 15: [0.38, 0.5], 16: [0.62, 0.5],
      23: [0.44, 0.58], 24: [0.56, 0.58], 25: [0.43, 0.74], 26: [0.57, 0.74], 27: [0.43, 0.9], 28: [0.57, 0.9],
    });
    const starPose = frame({
      11: [0.42, 0.25], 12: [0.58, 0.25], 15: [0.18, 0.34], 16: [0.82, 0.34],
      23: [0.44, 0.58], 24: [0.56, 0.58], 25: [0.36, 0.75], 26: [0.64, 0.75], 27: [0.32, 0.9], 28: [0.68, 0.9],
    });
    const squat = frame({
      11: [0.42, 0.42], 12: [0.58, 0.42], 15: [0.28, 0.56], 16: [0.72, 0.56],
      23: [0.44, 0.78], 24: [0.56, 0.78], 25: [0.36, 0.86], 26: [0.64, 0.86], 27: [0.32, 0.93], 28: [0.68, 0.93],
    });

    const profile = buildCalibrationProfile([standing], [starPose], [squat], 12345);

    expect(profile).toMatchObject({
      shoulderWidth: 0.16,
      hipWidth: 0.12,
      bodyHeight: 0.65,
      armSpan: 0.64,
      armLength: 0.256,
      armLengthRatio: 0.394,
      legLengthRatio: 0.493,
      lowestSquatHipY: 0.78,
      squatDepthRatio: 0.308,
      cameraScale: 0.65,
      capturedAt: 12345,
    });
  });
});
