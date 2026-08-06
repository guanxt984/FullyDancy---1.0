import { describe, expect, it } from "vitest";
import type { BeatPoint } from "../domain/types";
import { updateBeat } from "./chart";

const chart: BeatPoint[] = [
  { id: "beat-1", beatIndex: 1, timeSec: 1, salience: 1, enabled: true, action: "rhythm" },
  { id: "beat-2", beatIndex: 2, timeSec: 2, salience: 1, enabled: true, action: "rhythm" },
];

describe("updateBeat", () => {
  it("allows only one action on each candidate beat", () => {
    const opened = updateBeat(chart, "beat-2", { action: "open" });

    expect(updateBeat(opened, "beat-2", { action: "squat" })[1].action).toBe("squat");
  });

  it("updates immutably", () => {
    const updated = updateBeat(chart, "beat-1", { enabled: false });

    expect(updated).not.toBe(chart);
    expect(chart[0].enabled).toBe(true);
    expect(updated[0].enabled).toBe(false);
  });
});
