import { describe, expect, it } from "vitest";
import { normalizePoseResult, type MediaPipePoseResult } from "./mediaPipePoseProvider";
import { runPoseLoop } from "./poseLoop";

const fakeResult = (): MediaPipePoseResult => ({
  landmarks: [[{ x: 0.1, y: 0.2, z: -0.3, visibility: 0.9 }]],
});

describe("MediaPipePoseProvider", () => {
  it("preserves the video media time captured before inference", () => {
    expect(normalizePoseResult(fakeResult(), 12.345)?.captureTimeSec).toBe(12.345);
  });
});

describe("runPoseLoop", () => {
  it("does not overlap an unresolved inference", () => {
    let callback: ((now: number, metadata: { mediaTime: number }) => void) | undefined;
    const video = {
      currentTime: 0,
      requestVideoFrameCallback(next: (now: number, metadata: { mediaTime: number }) => void) {
        callback = next;
        return 1;
      },
      cancelVideoFrameCallback() {},
    } as unknown as HTMLVideoElement;
    let resolveDetect: (() => void) | undefined;
    const provider = {
      start: async () => {},
      detect: () => new Promise<void>((resolve) => { resolveDetect = resolve; }) as never,
      stop: () => {},
    };

    const stop = runPoseLoop({ video, provider });
    video.currentTime = 1;
    callback?.(0, { mediaTime: 1 });
    video.currentTime = 1.02;
    callback?.(20, { mediaTime: 1.02 });

    expect(resolveDetect).toBeTypeOf("function");
    stop();
  });
});
