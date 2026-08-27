import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import type { BeatPoint } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import { ChallengeScreen } from "./ChallengeScreen";

const level: BuiltInLevel = { id: "level-1", title: "8月3日舞蹈挑战", videoUrl: "/levels/level-1.mp4", durationSec: 13 };
const chart: BeatPoint[] = [{ id: "beat-1", beatIndex: 1, timeSec: 0.68, salience: 1, enabled: true, action: "rhythm" }];
const poseCache: DemoPoseCache = [{ captureTimeSec: 0, landmarks: Array.from({ length: 33 }, (_, index) => ({ x: 0.35 + (index % 4) * 0.08, y: 0.18 + Math.floor(index / 4) * 0.07, z: 0, visibility: 0.95 })) }];
const providerFactory = () => ({ start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() });
const poseLoop = vi.fn(() => vi.fn());

function renderChallenge(overrides: Partial<React.ComponentProps<typeof ChallengeScreen>> = {}) {
  return render(<ChallengeScreen level={level} chart={chart} initialPoseCache={poseCache} onBack={vi.fn()} providerFactory={providerFactory} poseLoop={poseLoop} {...overrides} />);
}

describe("ChallengeScreen", () => {
  it("shows instructions without requesting camera access or playing media", () => {
    const cameraStarter = vi.fn();
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    expect(screen.getByRole("dialog", { name: "舞蹈玩法" })).toBeVisible();
    expect(screen.getByText("跟随绿色骨架完成动作")).toBeVisible();
    expect(screen.getByText("单手张开保持 0.6 秒：播放或暂停")).toBeVisible();
    expect(screen.getByText("双手举过头顶保持 1 秒：重新开始")).toBeVisible();
    expect(cameraStarter).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("uses the supplied cache without extracting the demonstration again", async () => {
    const poseExtractor = vi.fn();
    renderChallenge({ poseExtractor });
    expect(await screen.findByLabelText("示范骨架运动")).toBeVisible();
    expect(poseExtractor).not.toHaveBeenCalled();
  });

  it("extracts the demonstration once when no cache was supplied", async () => {
    const poseExtractor = vi.fn(async () => poseCache);
    renderChallenge({ initialPoseCache: [], poseExtractor });
    await screen.findByLabelText("示范骨架运动");
    expect(poseExtractor).toHaveBeenCalledOnce();
  });

  it("extracts the demonstration only once in StrictMode", async () => {
    const poseExtractor = vi.fn(async () => poseCache);
    render(
      <StrictMode>
        <ChallengeScreen level={level} chart={chart} initialPoseCache={[]} onBack={vi.fn()} poseExtractor={poseExtractor} providerFactory={providerFactory} poseLoop={poseLoop} />
      </StrictMode>,
    );
    await screen.findByLabelText("示范骨架运动");
    expect(poseExtractor).toHaveBeenCalledOnce();
  });

  it.each([
    ["empty result", () => Promise.resolve([] as DemoPoseCache)],
    ["rejection", () => Promise.reject(new Error("extract failed"))],
  ])("allows retry after an extraction %s", async (_label, firstResult) => {
    const poseExtractor = vi.fn().mockImplementationOnce(firstResult).mockResolvedValueOnce(poseCache);
    renderChallenge({ initialPoseCache: [], poseExtractor });
    fireEvent.click(await screen.findByRole("button", { name: "重试示范骨架" }));
    expect(await screen.findByLabelText("示范骨架运动")).toBeVisible();
    expect(poseExtractor).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["video URL", { level: { ...level, videoUrl: "/levels/level-2.mp4" } }],
    ["duration", { level: { ...level, durationSec: 18 } }],
  ])("starts a fresh extraction when the %s changes", async (_dependency, next) => {
    const poseExtractor = vi.fn()
      .mockImplementationOnce(() => new Promise<DemoPoseCache>(() => undefined))
      .mockResolvedValueOnce(poseCache);
    const view = renderChallenge({ initialPoseCache: [], poseExtractor });
    view.rerender(<ChallengeScreen level={next.level} chart={chart} initialPoseCache={[]} onBack={vi.fn()} poseExtractor={poseExtractor} providerFactory={providerFactory} poseLoop={poseLoop} />);
    expect(await screen.findByLabelText("示范骨架运动")).toBeVisible();
    expect(poseExtractor).toHaveBeenCalledTimes(2);
  });

  it("starts a fresh extraction when the extractor changes", async () => {
    const firstExtractor = vi.fn(() => new Promise<DemoPoseCache>(() => undefined));
    const secondExtractor = vi.fn(async () => poseCache);
    const view = renderChallenge({ initialPoseCache: [], poseExtractor: firstExtractor });
    view.rerender(<ChallengeScreen level={level} chart={chart} initialPoseCache={[]} onBack={vi.fn()} poseExtractor={secondExtractor} providerFactory={providerFactory} poseLoop={poseLoop} />);
    expect(await screen.findByLabelText("示范骨架运动")).toBeVisible();
    expect(firstExtractor).toHaveBeenCalledOnce();
    expect(secondExtractor).toHaveBeenCalledOnce();
  });

  it("starts the camera and media after the instruction action", async () => {
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" })));
    expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
    expect(cameraStarter).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });

  it("offers retry after camera startup fails without reopening instructions", async () => {
    const cameraStarter = vi.fn().mockRejectedValueOnce(new DOMException("denied", "NotAllowedError")).mockResolvedValueOnce({ stream: {} as MediaStream, stop: vi.fn() });
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    expect(await screen.findByRole("button", { name: "重试摄像头" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试摄像头" }));
    await waitFor(() => expect(cameraStarter).toHaveBeenCalledTimes(2));
  });

  it("stops a delayed camera session when unmounted during startup", async () => {
    let resolveCamera!: (session: { stream: MediaStream; stop: () => void }) => void;
    const cameraStop = vi.fn();
    const cameraStarter = vi.fn(() => new Promise<{ stream: MediaStream; stop: () => void }>((resolve) => { resolveCamera = resolve; }));
    const localProviderFactory = vi.fn(providerFactory);
    const localPoseLoop = vi.fn(() => vi.fn());
    const view = renderChallenge({ cameraStarter, providerFactory: localProviderFactory, poseLoop: localPoseLoop });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    view.unmount();
    await act(async () => resolveCamera({ stream: {} as MediaStream, stop: cameraStop }));
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localProviderFactory).not.toHaveBeenCalled();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("immediately releases camera and provider when unmounted during pending provider startup", async () => {
    let resolveProvider!: () => void;
    const cameraStop = vi.fn();
    const providerStop = vi.fn();
    const provider = { start: vi.fn(() => new Promise<void>((resolve) => { resolveProvider = resolve; })), detect: vi.fn(() => null), stop: providerStop };
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: cameraStop }));
    const localPoseLoop = vi.fn(() => vi.fn());
    const view = renderChallenge({ cameraStarter, providerFactory: () => provider, poseLoop: localPoseLoop });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await waitFor(() => expect(provider.start).toHaveBeenCalledOnce());
    view.unmount();
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    await act(async () => resolveProvider());
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("immediately releases resources and pauses media when unmounted during pending playback", async () => {
    let resolvePlay!: () => void;
    const cameraStop = vi.fn();
    const providerStop = vi.fn();
    const cancelLoop = vi.fn();
    const localPoseLoop = vi.fn(() => cancelLoop);
    const provider = { start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: providerStop };
    const view = renderChallenge({
      cameraStarter: vi.fn(async () => ({ stream: {} as MediaStream, stop: cameraStop })),
      providerFactory: () => provider,
      poseLoop: localPoseLoop,
    });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockImplementation(() => new Promise<void>((resolve) => { resolvePlay = resolve; }));
    const pause = vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(localPoseLoop).toHaveBeenCalledOnce();
    view.unmount();
    expect(cancelLoop).toHaveBeenCalledOnce();
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalled();
    await act(async () => resolvePlay());
    expect(localPoseLoop).toHaveBeenCalledOnce();
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
  });

  it("uses the source video time and retains pause and restart fallbacks", async () => {
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    const pause = vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await screen.findByRole("button", { name: "暂停" });
    media.currentTime = 0.68;
    fireEvent.timeUpdate(media);
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(pause).toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "重新开始" })));
    expect(media.currentTime).toBe(0);
  });

  it("uses the live camera and reference skeleton as full-height layers", () => {
    renderChallenge();
    expect(screen.getByRole("main")).toHaveClass("challenge-stage--camera-fullscreen");
    expect(screen.getByRole("region", { name: "你的实时舞蹈画面" })).toHaveClass("challenge-user-camera-card--background");
    expect(screen.getByRole("region", { name: "示范骨架舞者" })).toHaveClass("challenge-reference-overlay--full-height");
  });
});
