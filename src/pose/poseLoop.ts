import { GAME_CONFIG } from "../config/gameConfig";
import type { PoseFrame } from "../domain/types";
import type { PoseProvider } from "./types";

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};
export interface PoseLoopOptions {
  video: HTMLVideoElement;
  provider: PoseProvider;
  onFrame?: (frame: PoseFrame) => void;
  frameIntervalMs?: number;
}

export function runPoseLoop({ video, provider, onFrame, frameIntervalMs = 1000 / GAME_CONFIG.poseFps }: PoseLoopOptions): () => void {
  const frameVideo = video as FrameVideo;
  let stopped = false;
  let inferring = false;
  let lastInferenceAt = -Infinity;
  let videoHandle: number | undefined;
  let animationHandle: number | undefined;
  const run = (now: number) => {
    if (stopped) return;
    schedule();
    if (inferring || now - lastInferenceAt < frameIntervalMs) return;
    inferring = true;
    const captureTimeSec = video.currentTime;
    try {
      const frame = provider.detect(video, captureTimeSec);
      lastInferenceAt = now;
      if (frame) onFrame?.(frame);
    } finally { inferring = false; }
  };
  const schedule = () => {
    if (stopped) return;
    if (frameVideo.requestVideoFrameCallback) videoHandle = frameVideo.requestVideoFrameCallback(run);
    else animationHandle = requestAnimationFrame(run);
  };
  schedule();
  return () => {
    stopped = true;
    if (videoHandle !== undefined) frameVideo.cancelVideoFrameCallback?.(videoHandle);
    if (animationHandle !== undefined) cancelAnimationFrame(animationHandle);
  };
}
