import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseLoopOptions } from "../pose/poseLoop";
import { TechnicalSlice } from "./TechnicalSlice";

const fakes = vi.hoisted(() => ({
  cameraStop: vi.fn(),
  startCamera: vi.fn(),
  providerStart: vi.fn<() => Promise<void>>(),
  providerStop: vi.fn(),
  runPoseLoop: vi.fn(),
  loopStop: vi.fn(),
  loopOptions: null as unknown,
  modelTier: "full" as "full" | "lite",
  performanceStats: { sampleCount: 0, meanMs: null as number | null, p95Ms: null as number | null },
  downgradeError: null as string | null,
}));

vi.mock("../pose/camera", () => ({ startCamera: fakes.startCamera }));

vi.mock("../pose/mediaPipePoseProvider", () => ({
  MediaPipePoseProvider: class {
    start = fakes.providerStart;
    stop = fakes.providerStop;
    detect() { return null; }
    getModelTier() { return fakes.modelTier; }
    getPerformanceStats() { return fakes.performanceStats; }
    getDowngradeError() { return fakes.downgradeError; }
  },
}));

vi.mock("../pose/poseLoop", () => ({ runPoseLoop: fakes.runPoseLoop }));

beforeEach(() => {
  fakes.cameraStop.mockReset();
  fakes.startCamera.mockReset();
  fakes.startCamera.mockResolvedValue({ stream: {} as MediaStream, stop: fakes.cameraStop });
  fakes.providerStart.mockReset();
  fakes.providerStart.mockResolvedValue(undefined);
  fakes.providerStop.mockReset();
  fakes.loopStop.mockReset();
  fakes.runPoseLoop.mockReset();
  fakes.runPoseLoop.mockImplementation((options) => {
    fakes.loopOptions = options;
    return fakes.loopStop;
  });
  fakes.loopOptions = null;
  fakes.modelTier = "full";
  fakes.performanceStats = { sampleCount: 0, meanMs: null, p95Ms: null };
  fakes.downgradeError = null;
});

afterEach(() => vi.restoreAllMocks());

async function startTechnicalSlice(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "启动本地摄像头" }));
  await waitFor(() => expect(fakes.providerStart).toHaveBeenCalledOnce());
}

describe("TechnicalSlice", () => {
  it("uses readable Chinese labels for every camera control and preview", () => {
    const view = render(<TechnicalSlice />);

    expect(screen.getByRole("heading", { name: "摄像头与姿态性能验证" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启动本地摄像头" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "960 × 540 复测" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止摄像头" })).toBeInTheDocument();
    expect(screen.getByLabelText("本地摄像头镜像预览")).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent("?");
  });

  it("releases camera and provider immediately when unmounted during provider startup", async () => {
    let finishStartup: (() => void) | undefined;
    fakes.providerStart.mockReturnValue(new Promise<void>((resolve) => { finishStartup = resolve; }));
    const view = render(<TechnicalSlice />);

    await startTechnicalSlice();
    view.unmount();

    expect(fakes.providerStop).toHaveBeenCalledOnce();
    expect(fakes.cameraStop).toHaveBeenCalledOnce();
    await act(async () => finishStartup?.());
  });

  it("releases camera and the created provider when provider startup fails", async () => {
    fakes.providerStart.mockRejectedValue(new Error("模型初始化失败"));
    render(<TechnicalSlice />);

    await startTechnicalSlice();

    await waitFor(() => expect(screen.getByText(/模型初始化失败/)).toBeInTheDocument());
    expect(fakes.providerStop).toHaveBeenCalledOnce();
    expect(fakes.cameraStop).toHaveBeenCalledOnce();
  });

  it("mirrors the preview, draws a PoseFrame skeleton, and shows active model mean and P95", async () => {
    const context = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    fakes.modelTier = "lite";
    fakes.performanceStats = { sampleCount: 20, meanMs: 12.5, p95Ms: 20 };
    render(<TechnicalSlice />);

    await startTechnicalSlice();
    const preview = screen.getByTestId("camera-preview");
    expect(preview).toHaveStyle({ transform: "scaleX(-1)" });
    expect(screen.getByTestId("pose-skeleton")).toBeInTheDocument();

    const options = fakes.loopOptions as PoseLoopOptions;
    const landmarks = Array.from({ length: 33 }, (_, index) => ({
      x: 0.2 + index * 0.01,
      y: 0.2 + index * 0.005,
      z: 0,
      visibility: 1,
    }));
    act(() => options.onFrame?.({ captureTimeSec: 1.25, landmarks }));

    await waitFor(() => expect(context.lineTo).toHaveBeenCalled());
    expect(screen.getByText("Lite")).toBeInTheDocument();
    expect(screen.getByText("12.5 ms")).toBeInTheDocument();
    expect(screen.getByText("20.0 ms")).toBeInTheDocument();
  });

  it("starts a 960 by 540 camera retest from the dedicated control", async () => {
    render(<TechnicalSlice />);

    fireEvent.click(screen.getByRole("button", { name: "960 × 540 复测" }));
    await waitFor(() => expect(fakes.startCamera).toHaveBeenCalledOnce());

    expect(fakes.startCamera).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      expect.objectContaining({
        videoConstraints: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
      }),
    );
  });
});
