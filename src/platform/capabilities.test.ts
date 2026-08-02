import { describe, expect, it } from "vitest";
import {
  detectCapabilities,
  type CapabilityEnvironment,
} from "./capabilities";

const fakeEnvironment = (
  overrides: Partial<CapabilityEnvironment> = {},
): CapabilityEnvironment => ({
  mediaDevices: { getUserMedia: () => Promise.resolve(new MediaStream()) },
  AudioContext: class {},
  Worker: class {},
  HTMLVideoElement: class {},
  requestAnimationFrame: () => 1,
  ...overrides,
});

describe("detectCapabilities", () => {
  it("reports the app unsupported when camera access is unavailable", () => {
    expect(detectCapabilities(fakeEnvironment({ mediaDevices: null }))).toMatchObject({
      supported: false,
      missing: ["camera"],
    });
  });

  it("requires camera, Web Audio and Worker", () => {
    expect(detectCapabilities(fakeEnvironment({ mediaDevices: null })).supported).toBe(false);
    expect(detectCapabilities(fakeEnvironment()).supported).toBe(true);
  });

  it("allows video frame callbacks to fall back to animation frames", () => {
    expect(detectCapabilities(fakeEnvironment())).toMatchObject({
      supported: true,
      videoFrameCallbackSupported: false,
    });
  });
});
