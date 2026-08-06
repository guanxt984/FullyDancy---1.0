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
  it("uses a stage-height video with a linked timeline for beat setup", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} />);

    const video = screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891") as HTMLVideoElement;
    expect(video).toHaveClass("analysis-video");
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));

    expect(await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "\u8df3\u5230\u5361\u70b9 2.00s" }));
    expect(video.currentTime).toBe(2);

    video.currentTime = 1.5;
    fireEvent.timeUpdate(video);
    expect(screen.getByLabelText("\u89c6\u9891\u8fdb\u5ea6")).toHaveStyle({ left: "75%" });
  });

  it("keeps every beat action control visible without selecting a beat first", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });

    expect(document.querySelectorAll(".beat-mini-actions")).toHaveLength(2);
    expect(document.querySelector(".beat-control-list")).toBeNull();
    expect(screen.getAllByRole("radio", { name: "\u5361\u8282\u594f" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "\u624b\u81c2\u6253\u5f00" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "\u4e0b\u8e72" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "\u5220\u9664" })).toHaveLength(2);
  });

  it("confirms the user's edited chart", async () => {
    const onConfirm = vi.fn();
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={onConfirm} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
    fireEvent.click(screen.getAllByRole("radio", { name: "\u624b\u81c2\u6253\u5f00" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "\u786e\u8ba4\u5361\u70b9" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0][0].action).toBe("open");
  });

  it("does not render a file input", () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});