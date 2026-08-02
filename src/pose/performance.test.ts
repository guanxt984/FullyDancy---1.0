import { describe, expect, it } from "vitest";
import {
  MediaPipePoseProvider,
  type MediaPipeRuntime,
} from "./mediaPipePoseProvider";

const video = {} as HTMLVideoElement;

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
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.getModelTier()).toBe("lite");
    expect(provider.detect(video, 121)?.landmarks[0]?.x).toBe(2);
  });
});
