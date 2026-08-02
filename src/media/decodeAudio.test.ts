import { describe, expect, it, vi } from "vitest";
import "../test/urlObjectUrl";
import { decodeMonoPcm } from "./decodeAudio";

function fakeFile(): File {
  return {
    arrayBuffer: async () => new ArrayBuffer(4),
    name: "practice.mp4",
    type: "video/mp4",
  } as File;
}

function fakeContext(result: AudioBuffer | Error): Pick<AudioContext, "decodeAudioData"> {
  return {
    decodeAudioData: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("decodeMonoPcm", () => {
  it("averages every channel at each sample into mono PCM", async () => {
    const buffer = {
      numberOfChannels: 2,
      length: 3,
      sampleRate: 48_000,
      duration: 3 / 48_000,
      getChannelData: (channel: number) => channel === 0
        ? new Float32Array([1, 0.5, -1])
        : new Float32Array([-1, 0.5, 1]),
    } as AudioBuffer;

    await expect(decodeMonoPcm(fakeFile(), fakeContext(buffer)))
      .resolves.toMatchObject({
        samples: new Float32Array([0, 0.5, 0]),
        sampleRate: 48_000,
        durationSec: 3 / 48_000,
      });
  });

  it("reports an unsupported audio format when decoding fails", async () => {
    await expect(decodeMonoPcm(fakeFile(), fakeContext(new Error("decode failed"))))
      .rejects.toThrow("不支持该视频的音频格式");
  });

  it("reports a missing audio track from the local media preflight", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "captureStream", {
      value: () => ({ getAudioTracks: () => [] }),
    });
    const createElement = vi.spyOn(document, "createElement").mockImplementation((tagName) => (
      tagName === "video" ? video : document.createElement(tagName)
    ));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:no-audio");
    const decodeAudioData = vi.fn();

    const result = decodeMonoPcm(fakeFile(), { decodeAudioData });
    video.dispatchEvent(new Event("loadedmetadata"));

    await expect(result).rejects.toThrow("视频没有可用音轨");
    expect(decodeAudioData).not.toHaveBeenCalled();
    createElement.mockRestore();
  });
});
