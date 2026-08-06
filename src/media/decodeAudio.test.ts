import { describe, expect, it } from "vitest";
import { decodeMonoPcm } from "./decodeAudio";

function fakeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/mp4" });
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

    await expect(decodeMonoPcm(fakeBlob(), fakeContext(buffer)))
      .resolves.toMatchObject({
        samples: new Float32Array([0, 0.5, 0]),
        sampleRate: 48_000,
        durationSec: 3 / 48_000,
      });
  });

  it("lets the fixed same-origin loader own public decode errors", async () => {
    await expect(decodeMonoPcm(fakeBlob(), fakeContext(new Error("decode failed"))))
      .rejects.toThrow("decode failed");
  });
});
