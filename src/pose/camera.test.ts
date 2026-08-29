import { describe, expect, it, vi } from "vitest";
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
    const stream = {
      getTracks: () => [
        { readyState: "live", stop: () => { stopped += 1; } },
        { readyState: "live", stop: () => { stopped += 1; } },
      ],
      getVideoTracks: () => [{ readyState: "live" }],
    } as unknown as MediaStream;
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
    const stream = {
      getTracks: () => [{ readyState: "live", stop: () => { stopped += 1; } }],
      getVideoTracks: () => [{ readyState: "live" }],
    } as unknown as MediaStream;
    const video = fakeVideo({ play: async () => { throw new Error("autoplay blocked"); } });

    await expect(startCamera(video, { mediaDevices: { getUserMedia: async () => stream } })).rejects.toThrow("autoplay blocked");

    expect(stopped).toBe(1);
    expect(video.srcObject).toBeNull();
  });

  it("passes an explicit 960 by 540 retest constraint to getUserMedia", async () => {
    let requested: MediaStreamConstraints | undefined;
    const stream = { getTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream;
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

  it("moves one stream between video elements without stopping tracks", async () => {
    const track = { readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const mediaDevices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
    const calibrationVideo = fakeVideo();
    const challengeVideo = fakeVideo();

    const session = await startCamera(calibrationVideo, { mediaDevices });
    session.detach(calibrationVideo);
    await session.attach(challengeVideo);

    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
    expect(calibrationVideo.srcObject).toBeNull();
    expect(challengeVideo.srcObject).toBe(stream);
  });

  it("stops tracks only when the shared session is stopped", async () => {
    let readyState: MediaStreamTrackState = "live";
    const track = {
      get readyState() { return readyState; },
      stop: vi.fn(() => { readyState = "ended"; }),
    } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const session = await startCamera(fakeVideo(), {
      mediaDevices: { getUserMedia: async () => stream },
    });

    expect(session.isLive()).toBe(true);
    session.stop();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(session.isLive()).toBe(false);
  });

  it("cleans up every attached video and stops each track only once", async () => {
    let readyState: MediaStreamTrackState = "live";
    const track = {
      get readyState() { return readyState; },
      stop: vi.fn(() => { readyState = "ended"; }),
    } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const calibrationVideo = fakeVideo({ pause: vi.fn() });
    const challengeVideo = fakeVideo({ pause: vi.fn() });
    const session = await startCamera(calibrationVideo, {
      mediaDevices: { getUserMedia: async () => stream },
    });
    await session.attach(challengeVideo);

    session.stop();
    session.stop();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(calibrationVideo.pause).toHaveBeenCalledOnce();
    expect(challengeVideo.pause).toHaveBeenCalledOnce();
    expect(calibrationVideo.srcObject).toBeNull();
    expect(challengeVideo.srcObject).toBeNull();
  });

  it("cleans up a failed attachment without stopping a stream still attached elsewhere", async () => {
    const track = { readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const calibrationVideo = fakeVideo();
    const challengeVideo = fakeVideo({
      pause: vi.fn(),
      play: async () => { throw new Error("autoplay blocked"); },
    });
    const session = await startCamera(calibrationVideo, {
      mediaDevices: { getUserMedia: async () => stream },
    });

    await expect(session.attach(challengeVideo)).rejects.toThrow("autoplay blocked");

    expect(track.stop).not.toHaveBeenCalled();
    expect(calibrationVideo.srcObject).toBe(stream);
    expect(challengeVideo.srcObject).toBeNull();
    expect(challengeVideo.pause).toHaveBeenCalledOnce();
    expect(session.isLive()).toBe(true);
  });
});
