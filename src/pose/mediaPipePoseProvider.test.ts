import { describe, expect, it, vi } from "vitest";
import {
  MediaPipePoseProvider,
  normalizePoseResult,
  type MediaPipePoseResult,
  type MediaPipeRuntime,
} from "./mediaPipePoseProvider";
import { runPoseLoop } from "./poseLoop";

const fakeResult = (): MediaPipePoseResult => ({
  landmarks: [[{ x: 0.1, y: 0.2, z: -0.3, visibility: 0.9 }]],
});

describe("MediaPipePoseProvider", () => {
  it("preserves the video media time captured before inference", () => {
    expect(normalizePoseResult(fakeResult(), 12.345)?.captureTimeSec).toBe(12.345);
  });

  it("closes a landmarker that finishes initializing after stop", async () => {
    let finishCreate: ((landmarker: { detectForVideo(): MediaPipePoseResult; close(): void }) => void) | undefined;
    const close = vi.fn();
    const runtime: MediaPipeRuntime = {
      createLandmarker: () => new Promise((resolve) => { finishCreate = resolve; }),
    };
    const provider = new MediaPipePoseProvider({ runtime });

    const started = provider.start();
    provider.stop();
    finishCreate?.({ detectForVideo: () => ({ landmarks: [] }), close });
    await started;

    expect(close).toHaveBeenCalledOnce();
  });
});

describe("runPoseLoop", () => {
  it("does not re-enter when detect synchronously triggers the next scheduled frame", () => {
    let callback: ((now: number, metadata: { mediaTime: number }) => void) | undefined;
    const video = {
      currentTime: 1,
      requestVideoFrameCallback(next: (now: number, metadata: { mediaTime: number }) => void) {
        callback = next;
        return 1;
      },
      cancelVideoFrameCallback() {},
    } as unknown as HTMLVideoElement;
    const detect = vi.fn(() => {
      if (detect.mock.calls.length === 1) callback?.(50, { mediaTime: 1.05 });
      return null;
    });
    const provider = { start: async () => {}, detect, stop: () => {} };

    const stop = runPoseLoop({ video, provider });
    callback?.(0, { mediaTime: 1 });

    expect(detect).toHaveBeenCalledOnce();
    stop();
  });
});
