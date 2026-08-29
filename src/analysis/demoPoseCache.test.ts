import { describe, expect, it, vi } from "vitest";
import type { PoseFrame } from "../domain/types";
import type { PoseProvider } from "../pose/types";
import { extractDemoPoseCache, nearestPoseFrame } from "./demoPoseCache";

function poseFrame(timeSec: number): PoseFrame {
  return { captureTimeSec: timeSec, landmarks: [] };
}

describe("extractDemoPoseCache", () => {
  it("samples the whole demo video at a fixed interval", async () => {
    const video = document.createElement("video");
    const provider: PoseProvider = {
      start: vi.fn(async () => undefined),
      detect: vi.fn((_, timeSec) => poseFrame(timeSec)),
      stop: vi.fn(),
    };

    const cache = await extractDemoPoseCache("/demo.mp4", 0.5, {
      provider,
      video,
      sampleIntervalSec: 0.25,
      settleMs: 0,
      seekTimeoutMs: 0,
    });

    expect(cache.map((item) => item.captureTimeSec)).toEqual([0, 0.25, 0.5]);
    expect(video.currentTime).toBe(0.5);
    expect(provider.start).toHaveBeenCalledOnce();
    expect(provider.stop).toHaveBeenCalledOnce();
  });

  it("waits for each video seek before detecting that frame", async () => {
    const video = document.createElement("video");
    const waitedTimes: number[] = [];
    const provider: PoseProvider = {
      start: vi.fn(async () => undefined),
      detect: vi.fn((_, timeSec) => poseFrame(timeSec)),
      stop: vi.fn(),
    };

    await extractDemoPoseCache("/demo.mp4", 0.3, {
      provider,
      video,
      sampleIntervalSec: 0.15,
      seekTimeoutMs: 0,
      waitForSeek: async (_, timeSec) => {
        waitedTimes.push(timeSec);
      },
    });

    expect(waitedTimes).toEqual([0, 0.15, 0.3]);
    expect(provider.detect).toHaveBeenCalledTimes(3);
  });

  it("uses a denser default sample interval for accurate dance keyframes", async () => {
    const video = document.createElement("video");
    const provider: PoseProvider = {
      start: vi.fn(async () => undefined),
      detect: vi.fn((_, timeSec) => poseFrame(timeSec)),
      stop: vi.fn(),
    };

    const cache = await extractDemoPoseCache("/demo.mp4", 0.24, {
      provider,
      video,
      settleMs: 0,
      seekTimeoutMs: 0,
    });

    expect(cache.map((item) => item.captureTimeSec)).toEqual([0, 0.08, 0.16, 0.24]);
  });
});

describe("nearestPoseFrame", () => {
  it("returns the closest cached skeleton frame for the current playback time", () => {
    const cache = [poseFrame(0), poseFrame(0.3), poseFrame(0.6)];

    expect(nearestPoseFrame(cache, 0.31, 0.2)?.captureTimeSec).toBe(0.3);
    expect(nearestPoseFrame(cache, 0.9, 0.2)).toBeNull();
  });
});
