import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import { loadBuiltInLevelAudio } from "./loadBuiltInLevelAudio";

function fakeContext(): Pick<BaseAudioContext, "decodeAudioData"> {
  return {
    decodeAudioData: async () => ({
      numberOfChannels: 1,
      length: 1,
      sampleRate: 48_000,
      duration: 1 / 48_000,
      getChannelData: () => new Float32Array([0.5]),
    }) as unknown as AudioBuffer,
  };
}

describe("loadBuiltInLevelAudio", () => {
  it("fetches and decodes the configured built-in video", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Blob([new Uint8Array([1])] )));

    await expect(loadBuiltInLevelAudio(BUILT_IN_LEVEL, fakeContext(), fetcher))
      .resolves.toMatchObject({ samples: new Float32Array([0.5]), sampleRate: 48_000 });
    expect(fetcher).toHaveBeenCalledWith("/levels/level-1.mp4");
  });

  it("uses the public load error when fetching or decoding fails", async () => {
    await expect(loadBuiltInLevelAudio(BUILT_IN_LEVEL, fakeContext(), async () => new Response(null, { status: 500 })))
      .rejects.toThrow("\u5173\u5361\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
  });
});


