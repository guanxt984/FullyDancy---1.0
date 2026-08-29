import { describe, expect, it } from "vitest";
import type { BeatPoint, PoseFrame } from "../domain/types";
import { inferBeatActionsFromPose } from "./inferBeatActionsFromPose";

function frame(timeSec: number, overrides: Record<number, { x: number; y: number }> = {}): PoseFrame {
  return {
    captureTimeSec: timeSec,
    landmarks: Array.from({ length: 33 }, (_, index) => ({
      x: overrides[index]?.x ?? 0.5,
      y: overrides[index]?.y ?? 0.5,
      z: 0,
      visibility: 0.95,
    })),
  };
}

function beat(id: string, timeSec: number): BeatPoint {
  return { id, beatIndex: Number(id.replace("beat-", "")), timeSec, salience: 1, enabled: true, action: "rhythm" };
}

describe("inferBeatActionsFromPose", () => {
  it("marks a beat as arm-open when either arm is straight near the beat", () => {
    const result = inferBeatActionsFromPose([beat("beat-1", 1)], [
      frame(1, {
        11: { x: 0.3, y: 0.5 },
        13: { x: 0.45, y: 0.5 },
        15: { x: 0.6, y: 0.5 },
      }),
    ]);

    expect(result[0].action).toBe("open");
  });

  it("marks a beat as squat when hips drop near the beat", () => {
    const result = inferBeatActionsFromPose([beat("beat-1", 1)], [
      frame(0, { 23: { x: 0.45, y: 0.45 }, 24: { x: 0.55, y: 0.45 } }),
      frame(1, { 23: { x: 0.45, y: 0.6 }, 24: { x: 0.55, y: 0.6 } }),
    ]);

    expect(result[0].action).toBe("squat");
  });

  it("keeps pure timing beats as rhythm when no pose signal is strong", () => {
    const result = inferBeatActionsFromPose([beat("beat-1", 1)], [frame(1)]);

    expect(result[0].action).toBe("rhythm");
  });
});
