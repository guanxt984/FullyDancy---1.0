import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PoseFrame } from "../domain/types";
import type { SharedCameraSession } from "../pose/camera";
import type { PoseProvider } from "../pose/types";
import { CalibrationScreen } from "./CalibrationScreen";

function createCameraSession(overrides: Partial<SharedCameraSession> = {}): SharedCameraSession {
  return {
    stream: {} as MediaStream,
    attach: vi.fn(async () => undefined),
    detach: vi.fn(),
    stop: vi.fn(),
    isLive: vi.fn(() => true),
    ...overrides,
  };
}

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
  it("skips pending camera permission with null without manufacturing a profile", () => {
    const onSkip = vi.fn();
    const onComplete = vi.fn();
    const cameraStarter = vi.fn(() => new Promise<never>(() => undefined));
    const view = render(<CalibrationScreen chartCount={3} onSkip={onSkip} onComplete={onComplete} cameraStarter={cameraStarter} />);

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(onSkip).toHaveBeenCalledWith(null);
    expect(onComplete).not.toHaveBeenCalled();
    view.unmount();
  });

  it("stops a camera that resolves after calibration was skipped and does not start the provider", async () => {
    let resolveCamera!: (session: SharedCameraSession) => void;
    const session = createCameraSession();
    const onSkip = vi.fn();
    const cameraStarter = vi.fn(() => new Promise<SharedCameraSession>((resolve) => {
      resolveCamera = resolve;
    }));
    const provider: PoseProvider = { start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() };
    const view = render(
      <CalibrationScreen chartCount={3} onSkip={onSkip} cameraStarter={cameraStarter} providerFactory={() => provider} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    expect(onSkip).toHaveBeenCalledWith(null);
    await act(async () => {
      resolveCamera(session);
      await Promise.resolve();
    });

    expect(session.stop).toHaveBeenCalledOnce();
    expect(provider.start).not.toHaveBeenCalled();
    expect(provider.stop).not.toHaveBeenCalled();
    view.unmount();
  });

  it("transfers an acquired camera and releases only the provider when skipped during provider startup", async () => {
    const session = createCameraSession();
    const onSkip = vi.fn();
    const provider: PoseProvider = {
      start: vi.fn(() => new Promise<never>(() => undefined)),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    };
    const view = render(
      <CalibrationScreen
        chartCount={3}
        onSkip={onSkip}
        cameraStarter={vi.fn(async () => session)}
        providerFactory={() => provider}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    view.unmount();

    expect(onSkip).toHaveBeenCalledWith(session);
    expect(session.detach).toHaveBeenCalledOnce();
    expect(session.stop).not.toHaveBeenCalled();
    expect(provider.stop).toHaveBeenCalledOnce();
  });

  it("reattaches an App-owned camera without requesting another camera session", async () => {
    const session = createCameraSession();
    const cameraStarter = vi.fn(async () => session);
    const onSkip = vi.fn();
    const providerFactory = vi.fn((): PoseProvider => ({
      start: vi.fn(async () => undefined),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    }));
    const firstView = render(
      <CalibrationScreen
        chartCount={3}
        onSkip={onSkip}
        cameraStarter={cameraStarter}
        providerFactory={providerFactory}
        poseLoop={vi.fn(() => vi.fn())}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    expect(onSkip).toHaveBeenCalledWith(session);

    firstView.rerender(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        cameraSession={session}
        cameraStarter={cameraStarter}
        providerFactory={providerFactory}
        poseLoop={vi.fn(() => vi.fn())}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cameraStarter).toHaveBeenCalledOnce();
    expect(session.attach).toHaveBeenCalledOnce();
    firstView.unmount();
    expect(session.stop).not.toHaveBeenCalled();
  });

  it("reacquires the camera when the App-owned session has ended", async () => {
    const endedSession = createCameraSession({ isLive: vi.fn(() => false) });
    const replacementSession = createCameraSession();
    const cameraStarter = vi.fn(async () => replacementSession);
    const onSkip = vi.fn();

    render(
      <CalibrationScreen
        chartCount={3}
        onSkip={onSkip}
        cameraSession={endedSession}
        cameraStarter={cameraStarter}
        providerFactory={() => ({
          start: vi.fn(async () => undefined),
          detect: vi.fn(() => null),
          stop: vi.fn(),
        })}
        poseLoop={vi.fn(() => vi.fn())}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(endedSession.attach).not.toHaveBeenCalled();
    expect(cameraStarter).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    expect(onSkip).toHaveBeenCalledWith(replacementSession);
    expect(replacementSession.stop).not.toHaveBeenCalled();
  });

  it("clears the intro timer on skip and never completes calibration afterward", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        onComplete={onComplete}
        cameraStarter={vi.fn(() => new Promise<never>(() => undefined))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    view.unmount();
    await act(async () => {
      vi.runAllTimers();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it("starts a fresh calibration session after the StrictMode effect cleanup", async () => {
    const cameraStarter = vi.fn(async () => createCameraSession());
    const providerFactory = vi.fn((): PoseProvider => ({
      start: vi.fn(async () => undefined),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    }));

    render(
      <StrictMode>
        <CalibrationScreen
          chartCount={3}
          onSkip={vi.fn()}
          cameraStarter={cameraStarter}
          providerFactory={providerFactory}
          poseLoop={vi.fn(() => vi.fn())}
        />
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cameraStarter).toHaveBeenCalledTimes(2);
    expect(providerFactory).toHaveBeenCalledOnce();
  });

  it("does not let a late camera from an obsolete run overwrite the current run resources", async () => {
    const pending: Array<(session: SharedCameraSession) => void> = [];
    const cameraStarter = vi.fn(() => new Promise<SharedCameraSession>((resolve) => pending.push(resolve)));
    const firstSession = createCameraSession();
    const secondSession = createCameraSession();
    const onSkip = vi.fn();
    const provider: PoseProvider = {
      start: vi.fn(async () => undefined),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    };
    const cancelLoop = vi.fn();
    const poseLoop = vi.fn(() => cancelLoop);
    const view = render(
      <StrictMode>
        <CalibrationScreen
          chartCount={3}
          onSkip={onSkip}
          cameraStarter={cameraStarter}
          providerFactory={() => provider}
          poseLoop={poseLoop}
        />
      </StrictMode>,
    );
    expect(cameraStarter).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending[1](secondSession);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(provider.start).toHaveBeenCalledOnce();
    expect(poseLoop).toHaveBeenCalledOnce();

    await act(async () => {
      pending[0](firstSession);
      await Promise.resolve();
    });
    expect(firstSession.stop).toHaveBeenCalledOnce();
    expect(secondSession.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    view.unmount();

    expect(onSkip).toHaveBeenCalledWith(secondSession);
    expect(secondSession.detach).toHaveBeenCalledOnce();
    expect(secondSession.stop).not.toHaveBeenCalled();
    expect(provider.stop).toHaveBeenCalledOnce();
    expect(cancelLoop).toHaveBeenCalledOnce();
  });

  it("releases acquired resources when provider startup fails", async () => {
    const session = createCameraSession();
    const provider: PoseProvider = {
      start: vi.fn(async () => { throw new Error("model failed"); }),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    };
    render(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        cameraStarter={vi.fn(async () => session)}
        providerFactory={() => provider}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(session.stop).toHaveBeenCalledOnce();
    expect(provider.stop).toHaveBeenCalledOnce();
  });

  it("disposes the camera when calibration completes without an onComplete receiver", async () => {
    vi.useFakeTimers();
    const session = createCameraSession();
    const provider: PoseProvider = {
      start: vi.fn(async () => undefined),
      detect: vi.fn(() => null),
      stop: vi.fn(),
    };
    const cancelLoop = vi.fn();
    let emitFrame: ((frame: PoseFrame) => void) | undefined;
    const view = render(
      <CalibrationScreen
        chartCount={3}
        onSkip={vi.fn()}
        cameraStarter={vi.fn(async () => session)}
        providerFactory={() => provider}
        poseLoop={({ onFrame }) => {
          emitFrame = onFrame;
          return cancelLoop;
        }}
        now={() => 0}
        stepDurationMs={0}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(2000);
    });

    await act(async () => {
      emitFrame?.(fullBodyFrame());
      emitFrame?.(fullBodyFrame());
      emitFrame?.(squatFrame());
      await Promise.resolve();
    });

    expect(session.stop).toHaveBeenCalledOnce();
    expect(provider.stop).toHaveBeenCalledOnce();
    expect(cancelLoop).toHaveBeenCalledOnce();
    view.unmount();
    expect(session.stop).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("shows one large instruction line, then advances with a continuous hold countdown", async () => {
    vi.useFakeTimers();
    let currentTime = 0;
    const onComplete = vi.fn();
    const session = createCameraSession();
    const cameraStarter = vi.fn(async () => session);
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
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        armLength: expect.any(Number),
        armLengthRatio: expect.any(Number),
        legLengthRatio: expect.any(Number),
        lowestSquatHipY: expect.any(Number),
        squatDepthRatio: expect.any(Number),
      }),
      session,
    );
    expect(session.detach).toHaveBeenCalledOnce();
    expect(session.stop).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows live missing-part guidance and accepts low-confidence full-body frames", async () => {
    vi.useFakeTimers();
    let currentTime = 0;
    const cameraStarter = vi.fn(async () => createCameraSession());
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
