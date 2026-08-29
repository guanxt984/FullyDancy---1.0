import { describe, expect, it } from "vitest";
import {
  MediaPipePoseProvider,
  type MediaPipeRuntime,
} from "./mediaPipePoseProvider";

const video = {} as HTMLVideoElement;

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("MediaPipePoseProvider performance safeguards", () => {
  it("falls back to CPU if GPU initialization fails", async () => {
    const delegates: string[] = [];
    const runtime: MediaPipeRuntime = {
      async createLandmarker({ delegate }) {
        delegates.push(delegate);
        if (delegate === "GPU") throw new Error("GPU unavailable");
        return { detectForVideo: () => ({ landmarks: [[]] }), close() {} };
      },
    };
    const provider = new MediaPipePoseProvider({ runtime });
    await provider.start();

    expect(delegates).toEqual(["GPU", "CPU"]);
  });

  it("switches from Heavy to Full after 120 slow inferences", async () => {
    let now = 0;
    const runtime: MediaPipeRuntime = {
      async createLandmarker({ modelAssetPath }) {
        const isFull = modelAssetPath.includes("full");
        return {
          detectForVideo: () => {
            now += 46;
            return { landmarks: [[{ x: isFull ? 2 : 1, y: 0, z: 0, visibility: 1 }]], worldLandmarks: [[]] };
          },
          close() {},
        };
      },
    };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("full");
    expect(provider.detect(video, 121)?.landmarks[0]?.x).toBe(2);
  });

  it("switches from Full to Lite only after Full is also slow", async () => {
    let now = 0;
    const runtime: MediaPipeRuntime = { async createLandmarker({ modelAssetPath }) {
      const duration = modelAssetPath.includes("lite") ? 5 : 46;
      return {
        detectForVideo: () => {
          now += duration;
          return { landmarks: [[{ x: modelAssetPath.includes("lite") ? 3 : modelAssetPath.includes("full") ? 2 : 1, y: 0, z: 0, visibility: 1 }]], worldLandmarks: [[]] };
        },
        close() {},
      };
    } };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();
    expect(provider.getModelTier()).toBe("full");
    for (let index = 120; index < 240; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("lite");
    provider.detect(video, 241);
    expect(provider.getPerformanceStats()).toEqual({ sampleCount: 1, meanMs: 5, p95Ms: 5 });
  });

  it("keeps the active model and does not retry downgrade after GPU and CPU initialization fail", async () => {
    let now = 0;
    let fullAttempts = 0;
    const runtime: MediaPipeRuntime = { async createLandmarker({ modelAssetPath }) {
      if (modelAssetPath.includes("full")) {
        fullAttempts += 1;
        throw new Error("Full unavailable");
      }
      return { detectForVideo: () => { now += 46; return { landmarks: [[]], worldLandmarks: [[]] }; }, close() {} };
    } };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();
    for (let index = 0; index < 240; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("heavy");
    expect(provider.getDowngradeError()).toBe("Full unavailable");
    expect(fullAttempts).toBe(2);
  });

  it("reports a hand-checkable rolling mean and P95 for recent inference durations", async () => {
    let now = 0;
    let nextDuration = 1;
    const runtime: MediaPipeRuntime = { async createLandmarker() {
      return {
        detectForVideo: () => {
          now += nextDuration;
          nextDuration += 1;
          return { landmarks: [[]], worldLandmarks: [[]] };
        },
        close() {},
      };
    } };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 20; index += 1) provider.detect(video, index);

    expect(provider.getPerformanceStats()).toEqual({ sampleCount: 20, meanMs: 10.5, p95Ms: 19 });
  });
});
