import { describe, expect, it } from "vitest";

import { BUILT_IN_LEVEL } from "./builtInLevel";
import { DEFAULT_BUILT_IN_CHART } from "./defaultChart";

describe("DEFAULT_BUILT_IN_CHART", () => {
  it("contains enabled beats ordered within the built-in level duration", () => {
    expect(DEFAULT_BUILT_IN_CHART.some((beat) => beat.enabled)).toBe(true);
    expect(DEFAULT_BUILT_IN_CHART.every((beat) => beat.timeSec >= 0 && beat.timeSec <= BUILT_IN_LEVEL.durationSec)).toBe(true);
    expect(DEFAULT_BUILT_IN_CHART.every((beat, index, beats) => index === 0 || beats[index - 1].timeSec <= beat.timeSec)).toBe(true);
  });
});
