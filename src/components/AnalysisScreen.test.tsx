import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import type { BeatPoint } from "../domain/types";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";

const chart: BeatPoint[] = [
  { id: "beat-1", beatIndex: 1, timeSec: 1, salience: 1, enabled: true, action: "rhythm" },
  { id: "beat-2", beatIndex: 2, timeSec: 2, salience: 1, enabled: true, action: "open", actions: ["rhythm", "open"] },
];

const openArmCache: DemoPoseCache = [
  {
    captureTimeSec: 1,
    landmarks: Array.from({ length: 33 }, (_, index) => ({
      x: index === 11 ? 0.3 : index === 13 ? 0.45 : index === 15 ? 0.6 : index === 12 || index === 14 || index === 16 ? 0.75 : 0.5,
      y: index === 15 || index === 16 ? 0.35 : index === 13 || index === 14 ? 0.42 : 0.55,
      z: 0,
      visibility: 0.9,
    })),
  },
];

vi.mock("../media/loadBuiltInLevelAudio", () => ({
  loadBuiltInLevelAudio: vi.fn(async () => ({ samples: new Float32Array([0, 1, 0]), sampleRate: 1, durationSec: 3 })),
}));

vi.mock("../beat-analysis/energyPeaks", () => ({
  detectEnergyPeaks: vi.fn(() => chart),
}));

vi.mock("../analysis/demoPoseCache", () => ({
  extractDemoPoseCache: vi.fn(async () => openArmCache),
  keyframesFromPoseCache: vi.fn((beats: BeatPoint[]) => Object.fromEntries(beats.filter((beat) => beat.id === "beat-1").map((beat) => [beat.id, openArmCache[0]]))),
  nearestPoseFrame: vi.fn((cache: DemoPoseCache, timeSec: number) => cache.find((frame) => Math.abs(frame.captureTimeSec - timeSec) <= 0.25) ?? null),
}));

import { AnalysisScreen } from "./AnalysisScreen";

describe("AnalysisScreen", () => {
  it("skips with the current analysis result", async () => {
    const onSkip = vi.fn();
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "分析卡点" }));
    await screen.findByRole("group", { name: "卡点时间轴" });
    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ chart: expect.any(Array), poseCache: expect.any(Array) }));
  });

  it("uses one product timeline to seek video and beat setup", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    const video = screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891") as HTMLVideoElement;
    expect(video).toHaveClass("analysis-video");
    expect(video.controls).toBe(false);
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));

    const timeline = await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
    fireEvent.click(screen.getByRole("button", { name: "播放视频" }));
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(video);
    const pauseButton = screen.getByRole("button", { name: "暂停视频" });
    expect(pauseButton.querySelectorAll(".play-icon-bar")).toHaveLength(2);
    expect(pauseButton).not.toHaveTextContent("Ⅱ");
    fireEvent.click(pauseButton);
    expect(pause).toHaveBeenCalledOnce();
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 120, width: 200, height: 120,
      toJSON: () => ({}),
    });
    fireEvent.click(timeline, { clientX: 50 });
    expect(video.currentTime).toBe(0.5);

    fireEvent.click(screen.getByRole("button", { name: "\u8df3\u5230\u5361\u70b9 2.00s" }));
    expect(video.currentTime).toBe(2);

    video.currentTime = 1.5;
    fireEvent.timeUpdate(video);
    expect(screen.getByLabelText("\u89c6\u9891\u8fdb\u5ea6")).toHaveStyle({ left: "75%" });
    expect(screen.getByLabelText("视频时间")).toHaveTextContent("0:01 / 0:02");
  });

  it("shows a lightweight tool tab and larger icons for multi-action beats", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });

    expect(document.querySelectorAll(".beat-tool-tab")).toHaveLength(1);
    expect(document.querySelectorAll(".beat-selected-actions")).toHaveLength(0);
    expect(document.querySelector(".beat-mini-actions")).toBeNull();
    expect(screen.getByRole("button", { name: "新增卡点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除卡点" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "\u5361\u8282\u594f" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "手臂伸直" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "\u4e0b\u8e72" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("卡点任务：卡节奏").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("卡点任务：手臂伸直").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".beat-pin-action-icon")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "\u8df3\u5230\u5361\u70b9 2.00s" }));
    expect(document.querySelectorAll(".beat-tool-tab")).toHaveLength(1);
    expect(document.querySelector(".beat-tool-tab")?.textContent).toContain("2.00s");
    expect(screen.getByRole("checkbox", { name: "\u5361\u8282\u594f" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "手臂伸直" })).toBeChecked();
    const selectedPin = document.querySelector(".beat-pin--selected");
    const selectedMarker = selectedPin?.closest(".beat-marker");
    const selectedIconGroup = selectedMarker?.querySelector(".beat-pin-action-icons");
    expect(selectedIconGroup?.children).toHaveLength(2);
    expect(selectedPin?.querySelector(".beat-pin-action-icons")).toBeNull();
    expect(selectedMarker?.firstElementChild).toBe(selectedIconGroup);
    expect(selectedIconGroup).toHaveClass("beat-pin-action-icons--row");
  });

  it("keeps the track, slim tool tab, and footer in separate ordered rows", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });

    const panel = document.querySelector(".timeline-panel--compact");
    expect(panel?.children[0]).toHaveClass("beat-timeline");
    expect(panel?.children[1]).toHaveClass("timeline-actions-row");
    expect(panel?.children[2]).toHaveClass("timeline-footer");
    expect(document.querySelector(".beat-tool-tab")?.parentElement).toHaveClass("timeline-actions-row");
    expect(document.querySelector(".beat-tool-group--points")?.textContent).toContain("新增卡点");
    expect(document.querySelector(".beat-tool-group--points")?.textContent).toContain("删除卡点");
    expect(document.querySelector(".beat-tool-group--actions")?.textContent).toContain("\u5361\u8282\u594f");
    expect(document.querySelector(".beat-tool-group--actions")?.textContent).toContain("手臂伸直");
    expect(document.querySelector(".beat-tool-group--actions")?.textContent).toContain("\u4e0b\u8e72");
    expect(document.querySelector(".beat-tool-tab .timeline-confirm")).toBeNull();
    expect(document.querySelector(".timeline-footer .timeline-confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入下一步" })).toBeInTheDocument();
  });

  it("adds a lightweight beat at the current video time", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    const video = screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891") as HTMLVideoElement;
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });

    video.currentTime = 1.5;
    fireEvent.timeUpdate(video);
    fireEvent.click(screen.getByRole("button", { name: "新增卡点" }));

    expect(screen.getByRole("button", { name: "\u8df3\u5230\u5361\u70b9 1.50s" })).toBeInTheDocument();
    expect(document.querySelector(".beat-tool-tab")?.textContent).toContain("1.50s");
  });

  it("uses the full-video pose cache to suggest beat actions and highlight the demo skeleton", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    const video = screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891") as HTMLVideoElement;
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));

    const armOpen = (await screen.findAllByRole("checkbox", { name: "手臂伸直" }))[0];
    await waitFor(() => expect(armOpen).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "\u8df3\u5230\u5361\u70b9 1.00s" }));

    expect(video.currentTime).toBe(1);
    expect(await screen.findByLabelText("\u793a\u8303\u9aa8\u67b6\u53e0\u52a0\u5c42")).toBeInTheDocument();
    expect(screen.getAllByLabelText("\u624b\u81c2\u9ad8\u4eae").length).toBeGreaterThan(0);
  });

  it("shows cached demo skeleton for the current playback time", async () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    const video = screen.getByLabelText("\u5f85\u5206\u6790\u821e\u8e48\u89c6\u9891") as HTMLVideoElement;
    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));

    await screen.findByText("\u5df2\u63d0\u53d6 1 \u5e27\u793a\u8303\u9aa8\u67b6");
    video.currentTime = 1;
    fireEvent.timeUpdate(video);

    expect(await screen.findByLabelText("\u793a\u8303\u9aa8\u67b6\u53e0\u52a0\u5c42")).toBeInTheDocument();
  });

  it("confirms the user's edited chart", async () => {
    const onConfirm = vi.fn();
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={onConfirm} onBack={vi.fn()} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u5206\u6790\u5361\u70b9" }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
    const firstSquat = screen.getAllByRole("checkbox", { name: "\u4e0b\u8e72" })[0];
    fireEvent.click(firstSquat);
    expect(screen.getByLabelText("\u5361\u70b9\u4efb\u52a1\uff1a\u4e0b\u8e72")).toHaveClass("beat-pin-action-icon--squat");
    fireEvent.click(screen.getByRole("button", { name: "进入下一步" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0].chart[0].action).toBe("squat");
    expect(onConfirm.mock.calls[0][0].chart[0].actions).toContain("squat");
  });

  it("does not render a file input", () => {
    render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
