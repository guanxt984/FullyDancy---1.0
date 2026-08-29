import { describe, expect, it } from "vitest";
import { validateBuiltInPoseCache } from "./builtInPose";

const validLandmark = { x: 0.5, y: 0.4, z: -0.1, visibility: 0.9 };

function validLandmarks(): unknown[] {
  return Array.from({ length: 33 }, () => ({ ...validLandmark }));
}

function validFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { captureTimeSec: 13, landmarks: validLandmarks(), ...overrides };
}

describe("validateBuiltInPoseCache", () => {
  it("rejects unordered or malformed pose data", () => {
    expect(() => validateBuiltInPoseCache([{ captureTimeSec: 1, landmarks: [] }], 13)).toThrow(/33/);
  });

  it.each([
    ["null", null],
    ["an empty object", {}],
    ["a string", "invalid"],
    ["a landmark missing x", { y: 0.4, z: -0.1, visibility: 0.9 }],
    ["a landmark missing y", { x: 0.5, z: -0.1, visibility: 0.9 }],
    ["a landmark missing z", { x: 0.5, y: 0.4, visibility: 0.9 }],
    ["a landmark missing visibility", { x: 0.5, y: 0.4, z: -0.1 }],
    ["a non-number x", { ...validLandmark, x: "0.5" }],
    ["a non-number y", { ...validLandmark, y: "0.4" }],
    ["a non-number z", { ...validLandmark, z: "-0.1" }],
    ["a non-number visibility", { ...validLandmark, visibility: "0.9" }],
    ["a NaN x", { ...validLandmark, x: Number.NaN }],
    ["a NaN y", { ...validLandmark, y: Number.NaN }],
    ["a NaN z", { ...validLandmark, z: Number.NaN }],
    ["a NaN visibility", { ...validLandmark, visibility: Number.NaN }],
    ["an infinite x", { ...validLandmark, x: Number.POSITIVE_INFINITY }],
    ["an infinite y", { ...validLandmark, y: Number.NEGATIVE_INFINITY }],
    ["an infinite z", { ...validLandmark, z: Number.POSITIVE_INFINITY }],
    ["an infinite visibility", { ...validLandmark, visibility: Number.NEGATIVE_INFINITY }],
  ])("rejects %s landmark", (_name, invalidLandmark) => {
    const landmarks = validLandmarks();
    landmarks[0] = invalidLandmark;

    expect(() => validateBuiltInPoseCache([validFrame({ landmarks })], 13)).toThrow(/landmark/i);
  });

  it.each([
    ["missing", undefined],
    ["non-number", "13"],
    ["negative", -0.01],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("rejects a %s captureTimeSec", (_name, captureTimeSec) => {
    expect(() => validateBuiltInPoseCache([validFrame({ captureTimeSec })], 13)).toThrow(/captureTimeSec/i);
  });

  it.each([
    ["the wrong count", validLandmarks().slice(1)],
    ["an invalid landmark", ["invalid", ...validLandmarks().slice(1)]],
  ])("rejects world landmarks with %s", (_name, worldLandmarks) => {
    expect(() => validateBuiltInPoseCache([validFrame({ worldLandmarks })], 13)).toThrow(/world landmark/i);
  });
});
