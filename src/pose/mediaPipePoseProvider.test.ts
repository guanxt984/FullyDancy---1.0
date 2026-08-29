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
  worldLandmarks: [[{ x: 0.01, y: 0.02, z: -0.03, visibility: 0.95 }]],
});

describe("MediaPipePoseProvider", () => {
  it("preserves the video media time captured before inference", () => {
    expect(normalizePoseResult(fakeResult(), 12.345)?.captureTimeSec).toBe(12.345);
  });

  it("preserves MediaPipe world landmarks for distance-stable pose judgement", () => {
    const frame = normalizePoseResult(fakeResult(), 1);

    expect(frame?.worldLandmarks?.[0]).toMatchObject({ x: 0.01, y: 0.02, z: -0.03, visibility: 0.95 });
  });

  it("smooths low-confidence landmarks with the previous reliable frame without marking them visible", async () => {
    const runtime: MediaPipeRuntime = {
      async createLandmarker() {
        let call = 0;
        return {
          detectForVideo: () => {
            call += 1;
            return {
              landmarks: [[call === 1
                ? { x: 0.2, y: 0.3, z: 0, visibility: 0.95 }
                : { x: 0.9, y: 0.8, z: 0, visibility: 0.1 }]],
              worldLandmarks: [[]],
            };
          },
          close() {},
        };
      },
    };
    const provider = new MediaPipePoseProvider({ runtime, now: () => 0 });
    await provider.start();

    expect(provider.detect({} as HTMLVideoElement, 0)?.landmarks[0]).toMatchObject({ x: 0.2, y: 0.3, visibility: 0.95 });
    expect(provider.detect({} as HTMLVideoElement, 0.1)?.landmarks[0]).toMatchObject({ x: 0.2, y: 0.3, visibility: 0.24 });
  });

  it("starts with the Heavy model for highest demo skeleton accuracy", async () => {
    const requestedModels: string[] = [];
    const runtime: MediaPipeRuntime = {
      async createLandmarker({ modelAssetPath }) {
        requestedModels.push(modelAssetPath);
        return { detectForVideo: () => ({ landmarks: [[]], worldLandmarks: [[]] }), close() {} };
      },
    };
    const provider = new MediaPipePoseProvider({ runtime });

    await provider.start();

    expect(provider.getModelTier()).toBe("heavy");
    expect(requestedModels[0]).toContain("heavy");
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
