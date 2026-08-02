import { describe, expect, it } from "vitest";
import { startCamera } from "./camera";

function fakeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    play: async () => {},
    pause: () => {},
    ...overrides,
  } as HTMLVideoElement;
}

describe("startCamera", () => {
  it("attaches a local stream and stops every track when released", async () => {
    let stopped = 0;
    const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] } as unknown as MediaStream;
    const video = fakeVideo();
    const camera = await startCamera(video, { mediaDevices: { getUserMedia: async () => stream } });

    expect(video.srcObject).toBe(stream);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    camera.stop();

    expect(stopped).toBe(2);
    expect(video.srcObject).toBeNull();
  });

  it("stops acquired tracks when preview playback is rejected", async () => {
    let stopped = 0;
    const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }] } as unknown as MediaStream;
    const video = fakeVideo({ play: async () => { throw new Error("autoplay blocked"); } });

    await expect(startCamera(video, { mediaDevices: { getUserMedia: async () => stream } })).rejects.toThrow("autoplay blocked");

    expect(stopped).toBe(1);
    expect(video.srcObject).toBeNull();
  });

  it("passes an explicit 960 by 540 retest constraint to getUserMedia", async () => {
    let requested: MediaStreamConstraints | undefined;
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const videoConstraints: MediaTrackConstraints = {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 540 },
    };

    await startCamera(fakeVideo(), {
      mediaDevices: { getUserMedia: async (constraints) => { requested = constraints; return stream; } },
      videoConstraints,
    });

    expect(requested).toEqual({ video: videoConstraints, audio: false });
  });
});
