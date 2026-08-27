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

  it("starts the camera and media after the instruction action", async () => {
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" })));
    expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
    expect(cameraStarter).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });

  it("offers retry after camera startup fails without reopening instructions", async () => {
    const cameraStarter = vi.fn().mockRejectedValueOnce(new DOMException("denied", "NotAllowedError")).mockResolvedValueOnce({ stream: {} as MediaStream, stop: vi.fn() });
    renderChallenge({ cameraStarter });
    vi.spyOn(screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement, "play").mockResolvedValue();
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    expect(await screen.findByRole("button", { name: "重试摄像头" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试摄像头" }));
    await waitFor(() => expect(cameraStarter).toHaveBeenCalledTimes(2));
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
