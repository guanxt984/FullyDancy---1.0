import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BeatPoint } from "../domain/types";
import { DEFAULT_BUILT_IN_CHART } from "../levels/defaultChart";

const homeTitle = "FullyDancy";
const startLabel = "\u5f00\u59cb\u6e38\u620f";
const selectLabel = "\u9009\u62e9 8\u67083\u65e5\u821e\u8e48\u6311\u6218";
const analysisLabel = "\u5206\u6790\u5361\u70b9";
const nextStepLabel = "进入下一步";
const challengeMockState = vi.hoisted(() => ({ renderReal: false }));

const chart: BeatPoint[] = [
  { id: "beat-1", beatIndex: 1, timeSec: 1, salience: 1, enabled: true, action: "rhythm" },
];

vi.mock("../media/loadBuiltInLevelAudio", () => ({
  loadBuiltInLevelAudio: vi.fn(async () => ({ samples: new Float32Array([0, 1, 0]), sampleRate: 1, durationSec: 3 })),
}));

vi.mock("../beat-analysis/energyPeaks", () => ({
  detectEnergyPeaks: vi.fn(() => chart),
}));

vi.mock("../analysis/demoPoseCache", async (importOriginal) => {
  const original = await importOriginal<typeof import("../analysis/demoPoseCache")>();
  return {
    ...original,
    extractDemoPoseCache: vi.fn(async () => [
      {
        captureTimeSec: 0,
        landmarks: Array.from({ length: 33 }, (_, index) => ({
          x: 0.35 + (index % 4) * 0.08,
          y: 0.18 + Math.floor(index / 4) * 0.07,
          z: 0,
          visibility: 0.95,
        })),
      },
    ]),
  };
});

vi.mock("../pose/camera", () => ({
  startCamera: vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() })),
}));

vi.mock("../components/CalibrationScreen", () => ({
  CalibrationScreen: ({ chartCount, onComplete, onSkip }: { chartCount: number; onComplete?: () => void; onSkip: () => void }) => (
    <main>
      <h1>身体校准</h1>
      <p>已确认 {chartCount} 个卡点，准备进行自动校准。</p>
      <button type="button" onClick={() => onComplete?.()}>完成校准</button>
      <button type="button" onClick={onSkip}>跳过</button>
    </main>
  ),
}));

vi.mock("../components/ChallengeScreen", async (importOriginal) => {
  const original = await importOriginal<typeof import("../components/ChallengeScreen")>();
  return {
    ChallengeScreen: (props: ComponentProps<typeof original.ChallengeScreen>) => challengeMockState.renderReal ? (
      <original.ChallengeScreen {...props} />
    ) : (
      <main>
        <h1>挑战测试页</h1>
        <span>缓存 {props.initialPoseCache.length} 帧</span>
        <span>卡点 {props.chart.length} 个</span>
      </main>
    ),
  };
});

import { App } from "./App";
import { extractDemoPoseCache } from "../analysis/demoPoseCache";
import { startCamera } from "../pose/camera";

describe("App", () => {
  it("moves from the game introduction to level selection", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: homeTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: startLabel }));

    expect(screen.getByRole("heading", { name: "\u9009\u62e9\u4f60\u7684\u6311\u6218" })).toBeInTheDocument();
  });

  it("opens the analysis setup after selecting the built-in level", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: startLabel }));
    fireEvent.click(screen.getByRole("button", { name: selectLabel }));

    expect(screen.getByRole("heading", { name: "\u5148\u627e\u5361\u70b9" })).toBeInTheDocument();
  });

  it("confirms analysis and moves to calibration", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: startLabel }));
    fireEvent.click(screen.getByRole("button", { name: selectLabel }));
    fireEvent.click(screen.getByRole("button", { name: analysisLabel }));
    await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
    fireEvent.click(screen.getByRole("button", { name: nextStepLabel }));

    expect(screen.getByRole("heading", { name: "\u8eab\u4f53\u6821\u51c6" })).toBeInTheDocument();
    expect(screen.getByText("\u5df2\u786e\u8ba4 1 \u4e2a\u5361\u70b9\uff0c\u51c6\u5907\u8fdb\u884c\u81ea\u52a8\u6821\u51c6\u3002")).toBeInTheDocument();
  });

  it("enters the lightweight challenge shell after calibration completes", async () => {
    const poseExtractor = vi.mocked(extractDemoPoseCache);
    const cameraStarter = vi.mocked(startCamera);
    poseExtractor.mockClear();
    cameraStarter.mockClear();
    challengeMockState.renderReal = true;

    try {
      render(<App />);

      fireEvent.click(screen.getByRole("button", { name: startLabel }));
      fireEvent.click(screen.getByRole("button", { name: selectLabel }));
      fireEvent.click(screen.getByRole("button", { name: analysisLabel }));
      await screen.findByRole("group", { name: "\u5361\u70b9\u65f6\u95f4\u8f74" });
      await screen.findByText("已提取 1 帧示范骨架");
      fireEvent.click(screen.getByRole("button", { name: nextStepLabel }));
      fireEvent.click(screen.getByRole("button", { name: "\u5b8c\u6210\u6821\u51c6" }));

      expect(screen.getByRole("dialog", { name: "舞蹈玩法" })).toBeVisible();
      await waitFor(() => expect(poseExtractor).toHaveBeenCalledTimes(1));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(poseExtractor).toHaveBeenCalledOnce();
      expect(cameraStarter).not.toHaveBeenCalled();
    } finally {
      challengeMockState.renderReal = false;
    }
  });

  it("uses deterministic fallbacks when every setup screen is skipped", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(screen.getByRole("heading", { name: "挑战测试页" })).toBeInTheDocument();
    expect(screen.getByText(`卡点 ${DEFAULT_BUILT_IN_CHART.length} 个`)).toBeInTheDocument();
    expect(screen.getByText("缓存 0 帧")).toBeInTheDocument();
  });

  it("keeps the camera technical slice out of the formal home flow", () => {
    render(<App />);

    expect(screen.queryByRole("heading", { name: "\u6444\u50cf\u5934\u4e0e\u59ff\u6001\u6027\u80fd\u9a8c\u8bc1" })).not.toBeInTheDocument();
  });
});
