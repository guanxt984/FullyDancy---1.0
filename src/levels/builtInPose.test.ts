import { describe, expect, it } from "vitest";
import { validateBuiltInPoseCache } from "./builtInPose";

describe("validateBuiltInPoseCache", () => {
  it("rejects unordered or malformed pose data", () => {
    expect(() => validateBuiltInPoseCache([{ captureTimeSec: 1, landmarks: [] }], 13)).toThrow(/33/);
  });
});
