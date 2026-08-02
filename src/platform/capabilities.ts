export type MissingCapability =
  | "camera"
  | "webAudio"
  | "worker"
  | "htmlVideo"
  | "animationFrame";

export interface CapabilityEnvironment {
  mediaDevices?: { getUserMedia?: unknown } | null;
  AudioContext?: unknown;
  Worker?: unknown;
  HTMLVideoElement?: unknown;
  requestAnimationFrame?: unknown;
  requestVideoFrameCallback?: unknown;
}

export interface CapabilityReport {
  supported: boolean;
  missing: MissingCapability[];
  videoFrameCallbackSupported: boolean;
}

function browserEnvironment(): CapabilityEnvironment {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: unknown;
  };
  const videoElement = scope.HTMLVideoElement as
    | { prototype?: { requestVideoFrameCallback?: unknown } }
    | undefined;

  return {
    mediaDevices: scope.navigator?.mediaDevices,
    AudioContext: scope.AudioContext ?? scope.webkitAudioContext,
    Worker: scope.Worker,
    HTMLVideoElement: scope.HTMLVideoElement,
    requestAnimationFrame: scope.requestAnimationFrame,
    requestVideoFrameCallback: videoElement?.prototype?.requestVideoFrameCallback,
  };
}

export function detectCapabilities(
  environment: CapabilityEnvironment = browserEnvironment(),
): CapabilityReport {
  const checks: Array<[MissingCapability, boolean]> = [
    ["camera", typeof environment.mediaDevices?.getUserMedia === "function"],
    ["webAudio", typeof environment.AudioContext === "function"],
    ["worker", typeof environment.Worker === "function"],
    ["htmlVideo", typeof environment.HTMLVideoElement === "function"],
    ["animationFrame", typeof environment.requestAnimationFrame === "function"],
  ];
  const missing = checks
    .filter(([, available]) => !available)
    .map(([capability]) => capability);

  return {
    supported: missing.length === 0,
    missing,
    videoFrameCallbackSupported:
      typeof environment.requestVideoFrameCallback === "function",
  };
}
