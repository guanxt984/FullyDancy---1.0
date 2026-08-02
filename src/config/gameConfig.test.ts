import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "./gameConfig";

type TimingWindows = {
  perfect: number;
  great: number;
  early?: number;
  late?: number;
};

function gradeOffsetWithConfig(offsetMs: number): string {
  const windows = GAME_CONFIG.timingWindowsMs as TimingWindows;
  const distance = Math.abs(offsetMs);

  if (distance <= windows.perfect) return "perfect";
  if (distance <= windows.great) return "great";
  if (offsetMs < 0 && distance <= (windows.early ?? 0)) return "early";
  if (offsetMs > 0 && distance <= (windows.late ?? 0)) return "late";
  return "miss";
}

describe("GAME_CONFIG timing windows", () => {
  it("keeps offsets between 200ms and 350ms as directional early or late grades", () => {
    expect(gradeOffsetWithConfig(-250)).toBe("early");
    expect(gradeOffsetWithConfig(250)).toBe("late");
  });
});
