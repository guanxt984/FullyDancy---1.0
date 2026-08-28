import { StrictMode } from "react";
// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node type declarations.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node type declarations.
import { cwd } from "node:process";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoPoseCache } from "../analysis/demoPoseCache";
import type { BeatPoint } from "../domain/types";
import type { BuiltInLevel } from "../levels/builtInLevel";
import type { PoseLoopOptions } from "../pose/poseLoop";
import { ChallengeScreen } from "./ChallengeScreen";

const styles = readFileSync(`${cwd()}/src/styles.css`, "utf8");

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

const level: BuiltInLevel = { id: "level-1", title: "8月3日舞蹈挑战", videoUrl: "/levels/level-1.mp4", durationSec: 13 };
const chart: BeatPoint[] = [{ id: "beat-1", beatIndex: 1, timeSec: 0.68, salience: 1, enabled: true, action: "rhythm" }];
const poseCache: DemoPoseCache = [{ captureTimeSec: 0, landmarks: Array.from({ length: 33 }, (_, index) => ({ x: 0.35 + (index % 4) * 0.08, y: 0.18 + Math.floor(index / 4) * 0.07, z: 0, visibility: 0.95 })) }];
const providerFactory = () => ({ start: vi.fn(async () => undefined), detect: vi.fn(() => null), stop: vi.fn() });
const poseLoop = vi.fn(() => vi.fn());

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

function renderChallenge(overrides: Partial<React.ComponentProps<typeof ChallengeScreen>> = {}) {
  return render(<ChallengeScreen level={level} chart={chart} initialPoseCache={poseCache} onBack={vi.fn()} providerFactory={providerFactory} poseLoop={poseLoop} {...overrides} />);
}

describe("ChallengeScreen", () => {
  it("shows instructions without requesting camera access or playing media", () => {
    const cameraStarter = vi.fn();
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
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

  it("attempts media playback before delayed camera startup resolves", async () => {
    let resolveCamera!: (session: { stream: MediaStream; stop: () => void }) => void;
    const cameraStarter = vi.fn(() => new Promise<{ stream: MediaStream; stop: () => void }>((resolve) => { resolveCamera = resolve; }));
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    const play = vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));

    expect(play).toHaveBeenCalledOnce();
    expect(cameraStarter).toHaveBeenCalledOnce();
    await act(async () => resolveCamera({ stream: {} as MediaStream, stop: vi.fn() }));
  });

  it("keeps playback recoverable and does not report a camera permission error when media playback fails", async () => {
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    renderChallenge({ cameraStarter });
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
    renderChallenge({
      cameraStarter: vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() })),
      poseLoop: localPoseLoop,
    });
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

  it("focuses the modal action and prevents background interaction until startup", async () => {
    renderChallenge({ cameraStarter: vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() })) });
    const start = screen.getByRole("button", { name: "开始舞蹈" });
    expect(start).toHaveFocus();
    expect(screen.getByRole("button", { name: "返回", hidden: true })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("region", { name: "舞蹈挑战" })).toHaveProperty("inert", true);
  });

  it("focuses camera retry after startup failure", async () => {
    renderChallenge({ cameraStarter: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    expect(await screen.findByRole("button", { name: "重试摄像头" })).toHaveFocus();
  });

  it("shows only the essential controls in the active challenge HUD", async () => {
    const cameraStarter = vi.fn(async () => ({ stream: {} as MediaStream, stop: vi.fn() }));
    renderChallenge({ cameraStarter });
    const media = screen.getByLabelText("舞蹈音乐与统一时间轴") as HTMLVideoElement;
    vi.spyOn(media, "play").mockResolvedValue();
    vi.spyOn(media, "pause").mockImplementation(() => undefined);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" })));

    expect(screen.queryByRole("heading", { name: "开始舞蹈" })).not.toBeInTheDocument();
    expect(screen.queryByText(/个卡点/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已提取 .* 帧骨架/)).not.toBeInTheDocument();
    expect(screen.queryByText("Dance challenge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeVisible();
    expect(screen.getByLabelText("播放控制")).toBeVisible();
    expect(screen.getByRole("region", { name: "示范骨架舞者" })).toHaveClass("challenge-reference-overlay--full-height");
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
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    view.unmount();
    await act(async () => resolveCamera({ stream: {} as MediaStream, stop: cameraStop }));
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localProviderFactory).not.toHaveBeenCalled();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
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
    vi.spyOn(media, "pause").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
    await waitFor(() => expect(provider.start).toHaveBeenCalledOnce());
    view.unmount();
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
    await act(async () => resolveProvider());
    expect(providerStop).toHaveBeenCalledOnce();
    expect(cameraStop).toHaveBeenCalledOnce();
    expect(localPoseLoop).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
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
