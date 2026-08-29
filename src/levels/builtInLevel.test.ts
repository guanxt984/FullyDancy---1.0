import { describe, expect, expectTypeOf, it } from "vitest";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import { BUILT_IN_LEVEL, type BuiltInLevel } from "./builtInLevel";

describe("BUILT_IN_LEVEL", () => {
  it("provides the playable bundled dance video", () => {
    expect(BUILT_IN_LEVEL).toMatchObject({
      id: "level-1",
      title: "8月3日舞蹈挑战",
      videoUrl: "/levels/level-1.mp4",
      durationSec: 13,
    });
  });

  it("ships a validated pose cache with the built-in level", () => {
    expect(BUILT_IN_LEVEL.poseCache.length).toBeGreaterThan(100);
    expect(BUILT_IN_LEVEL.poseCache[0].captureTimeSec).toBe(0);
    expect(BUILT_IN_LEVEL.poseCache[BUILT_IN_LEVEL.poseCache.length - 1].captureTimeSec).toBeGreaterThanOrEqual(BUILT_IN_LEVEL.durationSec - 0.1);
    expect(BUILT_IN_LEVEL.poseCache.every((frame) => frame.landmarks.length === 33)).toBe(true);
  });

  it("requires every BuiltInLevel to provide a pose cache", () => {
    expectTypeOf<BuiltInLevel["poseCache"]>().toEqualTypeOf<DemoPoseCache>();
  });
});
