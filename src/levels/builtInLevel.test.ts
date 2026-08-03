import { describe, expect, it } from "vitest";
import { BUILT_IN_LEVEL } from "./builtInLevel";

describe("BUILT_IN_LEVEL", () => {
  it("provides the playable bundled dance video", () => {
    expect(BUILT_IN_LEVEL).toEqual({
      id: "level-1",
      title: "8月3日舞蹈挑战",
      videoUrl: "/levels/level-1.mp4",
    });
  });
});
