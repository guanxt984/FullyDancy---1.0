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

  it("switches from Full to Lite after 120 slow inferences", async () => {
    let now = 0;
    const runtime: MediaPipeRuntime = {
      async createLandmarker({ modelAssetPath }) {
        const isLite = modelAssetPath.includes("lite");
        return {
          detectForVideo: () => {
            now += 46;
            return { landmarks: [[{ x: isLite ? 2 : 1, y: 0, z: 0, visibility: 1 }]] };
          },
          close() {},
        };
      },
    };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("lite");
    expect(provider.detect(video, 121)?.landmarks[0]?.x).toBe(2);
  });

  it("starts Lite performance statistics with only Lite inference samples", async () => {
    let now = 0;
    const runtime: MediaPipeRuntime = { async createLandmarker({ modelAssetPath }) {
      const duration = modelAssetPath.includes("lite") ? 5 : 46;
      return {
        detectForVideo: () => {
          now += duration;
          return { landmarks: [[]] };
        },
        close() {},
      };
    } };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("lite");
    provider.detect(video, 121);
    expect(provider.getPerformanceStats()).toEqual({ sampleCount: 1, meanMs: 5, p95Ms: 5 });
  });

  it("keeps Full and does not retry Lite after GPU and CPU initialization fail", async () => {
    let now = 0;
    let liteAttempts = 0;
    const runtime: MediaPipeRuntime = { async createLandmarker({ modelAssetPath }) {
      if (modelAssetPath.includes("lite")) {
        liteAttempts += 1;
        throw new Error("Lite unavailable");
      }
      return { detectForVideo: () => { now += 46; return { landmarks: [[]] }; }, close() {} };
    } };
    const provider = new MediaPipePoseProvider({ runtime, now: () => now });
    await provider.start();
    for (let index = 0; index < 120; index += 1) provider.detect(video, index);
    await flushAsyncWork();
    for (let index = 0; index < 240; index += 1) provider.detect(video, index);
    await flushAsyncWork();

    expect(provider.getModelTier()).toBe("full");
    expect(provider.getDowngradeError()).toBe("Lite unavailable");
    expect(liteAttempts).toBe(2);
  });

  it("reports a hand-checkable rolling mean and P95 for recent inference durations", async () => {
    let now = 0;
    let nextDuration = 1;
    const runtime: MediaPipeRuntime = { async createLandmarker() {
      return {
        detectForVideo: () => {
          now += nextDuration;
          nextDuration += 1;
          return { landmarks: [[]] };
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
