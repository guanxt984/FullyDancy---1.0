import type { PoseFrame } from "../domain/types";
import { MediaPipePoseProvider } from "../pose/mediaPipePoseProvider";
import type { PoseProvider } from "../pose/types";

export type DemoPoseCache = PoseFrame[];

export interface ExtractDemoPoseCacheOptions {
  provider?: PoseProvider;
  video?: HTMLVideoElement;
  sampleIntervalSec?: number;
  settleMs?: number;
  seekTimeoutMs?: number;
  waitForSeek?: (video: HTMLVideoElement, timeSec: number, timeoutMs: number) => Promise<void>;
}

function wait(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForVideoFrame(video: HTMLVideoElement, _timeSec: number, timeoutMs: number): Promise<void> {
  if (timeoutMs <= 0) return Promise.resolve();
  if (!video.seeking && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let timer = 0;
    const cleanup = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("canplay", done);
      video.removeEventListener("loadeddata", done);
      window.clearTimeout(timer);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("canplay", done, { once: true });
    video.addEventListener("loadeddata", done, { once: true });
    timer = window.setTimeout(done, timeoutMs);
  });
}

export async function extractDemoPoseCache(
  videoUrl: string,
  durationSec: number,
  options: ExtractDemoPoseCacheOptions = {},
): Promise<DemoPoseCache> {
  const provider = options.provider ?? new MediaPipePoseProvider();
  const video = options.video ?? document.createElement("video");
  const sampleIntervalSec = options.sampleIntervalSec ?? 0.08;
  const settleMs = options.settleMs ?? 0;
  const seekTimeoutMs = options.seekTimeoutMs ?? 900;
  const waitForSeek = options.waitForSeek ?? waitForVideoFrame;
  const lastTime = Math.max(0, durationSec);
  const frames: DemoPoseCache = [];

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (!video.src) video.src = videoUrl;

  try {
    await provider.start();
    for (let timeSec = 0; timeSec <= lastTime + 0.001; timeSec += sampleIntervalSec) {
      const sampleTime = Math.min(lastTime, Number(timeSec.toFixed(2)));
      video.currentTime = sampleTime;
      await waitForSeek(video, sampleTime, seekTimeoutMs);
      await wait(settleMs);
      const frame = provider.detect(video, sampleTime);
      if (frame) frames.push(frame);
      if (sampleTime === lastTime) break;
    }
  } catch {
    return frames;
  } finally {
    provider.stop();
    if (!options.video) {
      video.removeAttribute("src");
      video.load();
    }
  }

  return frames;
}

export function nearestPoseFrame(cache: DemoPoseCache, timeSec: number, maxDistanceSec = 0.18): PoseFrame | null {
  let nearest: PoseFrame | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const frame of cache) {
    const distance = Math.abs(frame.captureTimeSec - timeSec);
    if (distance < nearestDistance) {
      nearest = frame;
      nearestDistance = distance;
    }
  }
  return nearest && nearestDistance <= maxDistanceSec ? nearest : null;
}

export function keyframesFromPoseCache<T extends { id: string; timeSec: number }>(beats: T[], cache: DemoPoseCache): Record<string, PoseFrame> {
  return Object.fromEntries(
    beats.map((beat) => [beat.id, nearestPoseFrame(cache, beat.timeSec)]).filter((entry): entry is [string, PoseFrame] => Boolean(entry[1])),
  );
}

