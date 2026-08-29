// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node type declarations.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node type declarations.
import { cwd } from "node:process";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import type { BeatPoint } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import type { SharedCameraSession } from "../pose/camera";
import type { PoseLoopOptions } from "../pose/poseLoop";

const dependencyMocks = vi.hoisted(() => ({
  extractDemoPoseCache: vi.fn(),
  startCamera: vi.fn(),
}));

vi.mock("../analysis/demoPoseCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../analysis/demoPoseCache")>()),
  extractDemoPoseCache: dependencyMocks.extractDemoPoseCache,
}));

vi.mock("../pose/camera", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pose/camera")>()),
  startCamera: dependencyMocks.startCamera,
}));

import { ChallengeScreen } from "./ChallengeScreen";

const styles = readFileSync(`${cwd()}/src/styles.css`, "utf8");
const returnToCalibrationLabel = "返回校准开启摄像头";

interface CssRuleContract {
  selectors: string[];
  declarations: Array<{ property: string; value: string }>;
}

function matchingBraceIndex(source: string, openIndex: number) {
  let depth = 1;
  let quote = "";
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function collectTransportRules(source: string): CssRuleContract[] {
  const target = ".challenge-transport--floating";
  const rules: CssRuleContract[] = [];
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");

  function visit(block: string) {
    let cursor = 0;
    while (cursor < block.length) {
      const openIndex = block.indexOf("{", cursor);
      if (openIndex < 0) return;
      const closeIndex = matchingBraceIndex(block, openIndex);
      if (closeIndex < 0) return;
      const prelude = block.slice(cursor, openIndex).trim();
      const body = block.slice(openIndex + 1, closeIndex);

      if (prelude.startsWith("@")) {
        visit(body);
      } else {
        const selectors = prelude.split(",").map((selector) => selector.trim()).filter(Boolean);
        if (selectors.includes(target)) {
          const declarations = body.split(";").flatMap((declaration) => {
            const colonIndex = declaration.indexOf(":");
            if (colonIndex < 0) return [];
            return [{
              property: declaration.slice(0, colonIndex).trim().toLowerCase(),
              value: declaration.slice(colonIndex + 1).trim(),
            }];
          });
          rules.push({ selectors, declarations });
        }
      }
      cursor = closeIndex + 1;
    }
  }

  visit(withoutComments);
  return rules;
}

const chart: BeatPoint[] = [{ id: "beat-1", beatIndex: 1, timeSec: 0.68, salience: 1, enabled: true, action: "rhythm" }];
const poseCache: DemoPoseCache = [{ captureTimeSec: 0, landmarks: Array.from({ length: 33 }, (_, index) => ({ x: 0.35 + (index % 4) * 0.08, y: 0.18 + Math.floor(index / 4) * 0.07, z: 0, visibility: 0.95 })) }];
const level: BuiltInLevel = { id: "level-1", title: "8月3日舞蹈挑战", videoUrl: "/levels/level-1.mp4", durationSec: 13, poseCache };

function createCameraSession(options: {
  live?: boolean;
  attach?: SharedCameraSession["attach"];
} = {}): SharedCameraSession {
  return {
    stream: {} as MediaStream,
    attach: options.attach ?? vi.fn(async () => undefined),
    detach: vi.fn(),
    stop: vi.fn(),
    isLive: vi.fn(() => options.live ?? true),
  };
}

function createProvider() {
  return { start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() };
}

function gestureFrame(kind: "open-palm" | "neutral") {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.7, z: 0, visibility: 0.95 }));
  landmarks[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  landmarks[11] = { x: 0.42, y: 0.4, z: 0, visibility: 0.95 };
  landmarks[12] = { x: 0.58, y: 0.4, z: 0, visibility: 0.95 };
  if (kind === "open-palm") {
    landmarks[15] = { x: 0.25, y: 0.45, z: 0, visibility: 0.95 };
    landmarks[17] = { x: 0.19, y: 0.4, z: 0, visibility: 0.95 };
    landmarks[19] = { x: 0.25, y: 0.34, z: 0, visibility: 0.95 };
    landmarks[21] = { x: 0.31, y: 0.4, z: 0, visibility: 0.95 };
  }
  return { captureTimeSec: 0, landmarks };
}

function renderChallenge(overrides: Partial<React.ComponentProps<typeof ChallengeScreen>> & {
  cameraSession?: SharedCameraSession | null;
} = {}) {
  const cameraSession = overrides.cameraSession === undefined ? createCameraSession() : overrides.cameraSession;
  const onBack = overrides.onBack ?? vi.fn();
  const providerFactory = overrides.providerFactory ?? (() => createProvider());
  const poseLoop = overrides.poseLoop ?? vi.fn(() => vi.fn());
  return {
    ...render(
      <ChallengeScreen
        level={overrides.level ?? level}
        chart={overrides.chart ?? chart}
        cameraSession={cameraSession}
        onBack={onBack}
        providerFactory={providerFactory}
        poseLoop={poseLoop}
      />,
    ),
    cameraSession,
    onBack,
  };
}

describe("ChallengeScreen", () => {
  beforeEach(() => {
    dependencyMocks.extractDemoPoseCache.mockReset().mockImplementation(() => new Promise(() => undefined));
    dependencyMocks.startCamera.mockReset().mockImplementation(async () => createCameraSession());
  });

  it("shows the built-in skeleton and the three instruction lines immediately without pose extraction", () => {
    renderChallenge();

    expect(screen.getByLabelText("示范骨架运动")).toBeVisible();
    expect(screen.getByText("跟随绿色骨架完成动作")).toBeVisible();
    expect(screen.getByText("单手张开保持 0.6 秒：播放或暂停")).toBeVisible();
    expect(screen.getByText("双手举过头顶保持 1 秒：重新开始")).toBeVisible();
    expect(screen.queryByText(/正在提取示范骨架/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试示范骨架" })).not.toBeInTheDocument();
    expect(dependencyMocks.extractDemoPoseCache).not.toHaveBeenCalled();
  });

  it("does not attach the camera or play media before the instruction action", () => {
    const session = createCameraSession();
    renderChallenge({ cameraSession: session });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();

    expect(screen.getByRole("dialog", { name: "舞蹈玩法" })).toBeVisible();
    expect(session.attach).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(dependencyMocks.startCamera).not.toHaveBeenCalled();
  });

  it("plays media, attaches the calibrated camera, then starts pose recognition without requesting permission", async () => {
    const order: string[] = [];
    const session = createCameraSession({ attach: vi.fn(async () => { order.push("attach"); }) });
    const provider = createProvider();
    provider.start.mockImplementation(async () => { order.push("provider"); });
    const localPoseLoop = vi.fn(() => {
      order.push("loop");
      return vi.fn();
    });
    renderChallenge({ cameraSession: session, providerFactory: () => provider, poseLoop: localPoseLoop });
    const cameraVideo = screen.getByLabelText("用户摄像头预览");
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockImplementation(() => {
      order.push("media");
      return Promise.resolve();
    });
    vi.spyOn(media, "pause").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));

    await waitFor(() => expect(localPoseLoop).toHaveBeenCalledOnce());
    expect(order).toEqual(["media", "attach", "provider", "loop"]);
    expect(session.attach).toHaveBeenCalledWith(cameraVideo);
    expect(dependencyMocks.startCamera).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["ended", createCameraSession({ live: false })],
  ])("returns to calibration without requesting a camera for a %s session", (_case, cameraSession) => {
    const onBack = vi.fn();
    renderChallenge({ cameraSession, onBack });

    const returnAction = screen.getByRole("button", { name: returnToCalibrationLabel });
    expect(returnAction).toBeVisible();
    expect(screen.queryByRole("button", { name: "开始舞蹈" })).not.toBeInTheDocument();
    fireEvent.click(returnAction);

    expect(onBack).toHaveBeenCalledOnce();
    expect(dependencyMocks.startCamera).not.toHaveBeenCalled();
  });

  it("focuses the modal action and makes background layers inert", () => {
    renderChallenge();

    expect(screen.getByRole("button", { name: "开始舞蹈" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "返回", hidden: true })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("region", { name: "舞蹈挑战" })).toHaveProperty("inert", true);
  });

  it("keeps playback recoverable when media autoplay fails", async () => {
    renderChallenge();
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError")).mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));

    expect(await screen.findByRole("button", { name: "继续" })).toBeVisible();
    expect(screen.queryByText(/摄像头权限被拒绝/)).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "继续" })));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("uses current playback state when an open-palm gesture toggles pause and resume", async () => {
    let onFrame!: (frame: ReturnType<typeof gestureFrame>) => void;
    const localPoseLoop = vi.fn((options: PoseLoopOptions) => {
      onFrame = options.onFrame!;
      return vi.fn();
    });
    renderChallenge({ poseLoop: localPoseLoop });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    const pause = vi.spyOn(media, "pause").mockImplementation(() => undefined);
    const now = vi.spyOn(performance, "now");
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await screen.findByRole("button", { name: "暂停" });

    now.mockReturnValueOnce(0).mockReturnValueOnce(600);
    act(() => { onFrame(gestureFrame("open-palm")); onFrame(gestureFrame("open-palm")); });
    expect(pause).toHaveBeenCalledOnce();
    act(() => onFrame(gestureFrame("neutral")));
    now.mockReturnValueOnce(1000).mockReturnValueOnce(1600);
    act(() => { onFrame(gestureFrame("open-palm")); onFrame(gestureFrame("open-palm")); });
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  });

  it("keeps only the transparent essential controls in the active challenge HUD", async () => {
    renderChallenge();
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await screen.findByRole("button", { name: "暂停" });

    expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
    expect(screen.queryByText(/个卡点/)).not.toBeInTheDocument();
    expect(screen.queryByText(/帧骨架/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeVisible();
    expect(screen.getByLabelText("播放控制")).toBeVisible();
    expect(screen.getByRole("region", { name: "示范骨架舞者" })).toHaveClass("challenge-reference-overlay--full-height");
  });

  it("detaches but never stops the App-owned camera on back", async () => {
    const session = createCameraSession();
    const onBack = vi.fn();
    renderChallenge({ cameraSession: session, onBack });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await screen.findByRole("button", { name: "暂停" });

    const cameraVideo = screen.getByLabelText("用户摄像头预览");
    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(session.detach).toHaveBeenCalledWith(cameraVideo);
    expect(session.stop).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("detaches without stopping tracks when unmounted during a pending camera attachment", async () => {
    let resolveAttach!: () => void;
    const session = createCameraSession({ attach: vi.fn(() => new Promise<void>((resolve) => { resolveAttach = resolve; })) });
    const providerFactory = vi.fn(() => createProvider());
    const localPoseLoop = vi.fn(() => vi.fn());
    const view = renderChallenge({ cameraSession: session, providerFactory, poseLoop: localPoseLoop });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await waitFor(() => expect(session.attach).toHaveBeenCalledOnce());

    view.unmount();
    expect(session.detach).toHaveBeenCalledOnce();
    expect(session.stop).not.toHaveBeenCalled();
    expect(providerFactory).not.toHaveBeenCalled();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
    await act(async () => resolveAttach());
    expect(session.detach).toHaveBeenCalledOnce();
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it("releases provider, loop, media, and attachment during pending playback", async () => {
    let resolvePlay!: () => void;
    const session = createCameraSession();
    const provider = createProvider();
    const cancelLoop = vi.fn();
    const localPoseLoop = vi.fn(() => cancelLoop);
    const view = renderChallenge({ cameraSession: session, providerFactory: () => provider, poseLoop: localPoseLoop });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockImplementation(() => new Promise<void>((resolve) => { resolvePlay = resolve; }));
    const pause = vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await waitFor(() => expect(localPoseLoop).toHaveBeenCalledOnce());

    view.unmount();
    expect(cancelLoop).toHaveBeenCalledOnce();
    expect(provider.stop).toHaveBeenCalledOnce();
    expect(session.detach).toHaveBeenCalledOnce();
    expect(session.stop).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalledOnce();
    await act(async () => resolvePlay());
    expect(localPoseLoop).toHaveBeenCalledOnce();
    expect(session.detach).toHaveBeenCalledOnce();
  });

  it("uses the media time for the built-in skeleton and retains pause and restart fallbacks", async () => {
    const laterPoseCache: DemoPoseCache = [
      poseCache[0],
      { ...poseCache[0], captureTimeSec: 0.68, landmarks: poseCache[0].landmarks.map((landmark) => ({ ...landmark, x: landmark.x + 0.1 })) },
    ];
    renderChallenge({ level: { ...level, poseCache: laterPoseCache } });
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

  it("uses the live camera and reference skeleton as full-height 100dvh layers", () => {
    renderChallenge();
    expect(screen.getByRole("main")).toHaveClass("challenge-stage--camera-fullscreen");
    expect(screen.getByRole("region", { name: "你的实时舞蹈画面" })).toHaveClass("challenge-user-camera-card--background");
    expect(screen.getByRole("region", { name: "示范骨架舞者" })).toHaveClass("challenge-reference-overlay--full-height");
  });

  it("lets safe-area insets define the floating transport width without mobile overflow", () => {
    const transportRules = collectTransportRules(styles);
    const declarations = transportRules.flatMap((rule) => rule.declarations);
    const safeAreaRule = transportRules.find((rule) => {
      const valueFor = (property: string) => rule.declarations.find((declaration) => declaration.property === property)?.value ?? "";
      return valueFor("width") === "auto"
        && valueFor("left").includes("--challenge-edge")
        && valueFor("left").includes("safe-area-inset-left")
        && valueFor("right").includes("--challenge-edge")
        && valueFor("right").includes("safe-area-inset-right");
    });

    expect.soft(safeAreaRule).toBeDefined();
    expect.soft(declarations).not.toContainEqual({ property: "width", value: "100%" });
  });

  it("ignores commented fake rules and finds the exact selector inside grouped media rules", () => {
    const fixture = `
      /* .challenge-transport--floating { width: auto; } */
      @media (max-width: 800px) {
        .other-control, .challenge-transport--floating { width: 100%; }
      }
    `;

    expect(collectTransportRules(fixture)).toEqual([
      {
        selectors: [".other-control", ".challenge-transport--floating"],
        declarations: [{ property: "width", value: "100%" }],
      },
    ]);
  });
});
