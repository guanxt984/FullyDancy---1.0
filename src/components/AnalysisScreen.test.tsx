import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatPoint } from "../domain/types";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";

const chart: BeatPoint[] = [
  { id: "beat-1", beatIndex: 1, timeSec: 1, salience: 1, enabled: true, action: "rhythm" },
  { id: "beat-2", beatIndex: 2, timeSec: 2, salience: 1, enabled: true, action: "rhythm" },
];

vi.mock("../media/loadBuiltInLevelAudio", () => ({
  loadBuiltInLevelAudio: vi.fn(async () => ({ samples: new Float32Array([0, 1, 0]), sampleRate: 1, durationSec: 3 })),
}));

vi.mock("../beat-analysis/energyPeaks", () => ({
  detectEnergyPeaks: vi.fn(() => chart),
}));

import { AnalysisScreen } from "./AnalysisScreen";

describe("AnalysisScreen", () => {
  it("uses a stage-height video with a timeline for beat setup", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891")).toHaveClass("analysis-video");
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));

    expect(await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "\u9009\u62e9\u5361\u70b9 1.00s" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "\u624b\u81c2\u6253\u5f00" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "\u4e0b\u8e72" })).toBeInTheDocument();
  });

  it("confirms the user's edited chart", async () => {
    const onConfirm = vi.fn();
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={onConfirm} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
    fireEvent.click(screen.getByRole("radio", { name: "\u624b\u81c2\u6253\u5f00" }));
    fireEvent.click(screen.getByRole("button", { name: "\u786e\u8ba4\u5361\u70b9" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0][0].action).toBe("open");
  });

  it("does not render a file input", () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
