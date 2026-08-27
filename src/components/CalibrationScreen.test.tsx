import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PoseFrame } from "../domain/types";
import type { PoseProvider } from "../pose/types";
import { CalibrationScreen } from "./CalibrationScreen";

function fullBodyFrame(): PoseFrame {
  return {
    captureTimeSec: 0,
    landmarks: Array.from({ length: 33 }, (_, index) => ({
      x: index === 11 ? 0.42 : index === 12 ? 0.58 : index === 15 ? 0.18 : index === 16 ? 0.82 : index === 23 ? 0.44 : index === 24 ? 0.56 : index === 27 ? 0.43 : index === 28 ? 0.57 : 0.5,
      y: index === 11 || index === 12 ? 0.25 : index === 15 || index === 16 ? 0.34 : index === 23 || index === 24 ? 0.58 : index === 27 || index === 28 ? 0.9 : 0.5,
      z: 0,
      visibility: 0.9,
    })),
  };
}

function frameWithVisibility(overrides: Record<number, number>): PoseFrame {
  return {
    ...fullBodyFrame(),
    landmarks: fullBodyFrame().landmarks.map((landmark, index) => ({
      ...landmark,
      visibility: overrides[index] ?? landmark.visibility,
    })),
  };
}

function squatFrame(): PoseFrame {
  return {
    ...fullBodyFrame(),
    landmarks: fullBodyFrame().landmarks.map((landmark, index) => {
      if (index === 11 || index === 12) return { ...landmark, y: 0.42 };
      if (index === 15 || index === 16) return { ...landmark, y: 0.56 };
      if (index === 23 || index === 24) return { ...landmark, y: 0.78 };
      if (index === 25 || index === 26) return { ...landmark, y: 0.86 };
      if (index === 27 || index === 28) return { ...landmark, y: 0.93 };
      return landmark;
    }),
  };
}

describe("CalibrationScreen", () => {
  it("skips calibration without manufacturing a profile", () => {
    const onSkip = vi.fn();
    const cameraStarter = vi.fn(() => new Promise<never>(() => undefined));
    render(<CalibrationScreen chartCount={3} onSkip={onSkip} cameraStarter={cameraStarter} />);

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("shows one large instruction line, then advances with a continuous hold countdown", async () => {
    vi.useFakeTimers();
    let currentTime = 0;
    const onComplete = vi.fn();
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    const provider: PoseProvider = { start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() };
    let emitFrame: ((frame: PoseFrame) => void) | undefined;

    render(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        onComplete={onComplete}
        cameraStarter={cameraStarter}
        providerFactory={() => provider}
        poseLoop={({ onFrame }) => {
          emitFrame = onFrame;
          return vi.fn();
        }}
        now={() => currentTime}
        stepDurationMs={3000}
      />,
    );

    expect(screen.getByRole("heading", { name: "身体校准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "让全身完整出现在画面里。" })).toHaveClass("calibration-instruction");
    expect(document.querySelector(".calibration-camera-frame--page-background")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    expect(cameraStarter).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("heading", { name: "正在识别身体，请站到画面中央。" })).toBeInTheDocument();

    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "全身已入镜，保持 3 秒" })).toBeInTheDocument();

    currentTime = 1000;
    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "全身已入镜，保持 2 秒" })).toBeInTheDocument();

    currentTime = 2000;
    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "全身已入镜，保持 1 秒" })).toBeInTheDocument();

    currentTime = 3000;
    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "双臂打开，双腿分开，摆成大字型。" })).toBeInTheDocument();

    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "大字型已识别，保持 3 秒" })).toBeInTheDocument();

    currentTime = 6000;
    await act(async () => {
      emitFrame?.(fullBodyFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "慢慢下蹲到你的最低位置。" })).toBeInTheDocument();

    currentTime = 9000;
    await act(async () => {
      emitFrame?.(squatFrame());
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "下蹲位置已识别，保持 3 秒" })).toBeInTheDocument();

    currentTime = 12000;
    await act(async () => {
      emitFrame?.(squatFrame());
      await Promise.resolve();
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      armLength: expect.any(Number),
      armLengthRatio: expect.any(Number),
      legLengthRatio: expect.any(Number),
      lowestSquatHipY: expect.any(Number),
      squatDepthRatio: expect.any(Number),
    }));
    vi.useRealTimers();
  });

  it("shows live missing-part guidance and accepts low-confidence full-body frames", async () => {
    vi.useFakeTimers();
    let currentTime = 0;
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    const provider: PoseProvider = { start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() };
    let emitFrame: ((frame: PoseFrame) => void) | undefined;

    render(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        cameraStarter={cameraStarter}
        providerFactory={() => provider}
        poseLoop={({ onFrame }) => {
          emitFrame = onFrame;
          return vi.fn();
        }}
        now={() => currentTime}
        stepDurationMs={3000}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(2000);
    });

    await act(async () => {
      emitFrame?.(frameWithVisibility({ 15: 0.1, 16: 0.1 }));
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "手部未完整入镜" })).toBeInTheDocument();

    await act(async () => {
      emitFrame?.(frameWithVisibility({ 11: 0.35, 12: 0.35, 15: 0.35, 16: 0.35, 23: 0.35, 24: 0.35, 27: 0.35, 28: 0.35 }));
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "全身已入镜，保持 3 秒" })).toBeInTheDocument();

    currentTime = 3000;
    await act(async () => {
      emitFrame?.(frameWithVisibility({ 11: 0.35, 12: 0.35, 15: 0.35, 16: 0.35, 23: 0.35, 24: 0.35, 27: 0.35, 28: 0.35 }));
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "双臂打开，双腿分开，摆成大字型。" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});
