import { describe, expect, it } from "vitest";
import { startCamera } from "./camera";

describe("startCamera", () => {
  it("attaches a local stream and stops every track when released", async () => {
    let stopped = 0;
    const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] } as unknown as MediaStream;
    const video = {
      srcObject: null,
      muted: false,
      playsInline: false,
      play: async () => {},
      pause: () => {},
    } as unknown as HTMLVideoElement;
    const camera = await startCamera(video, { mediaDevices: { getUserMedia: async () => stream } });

    expect(video.srcObject).toBe(stream);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    camera.stop();

    expect(stopped).toBe(2);
    expect(video.srcObject).toBeNull();
  });
});
