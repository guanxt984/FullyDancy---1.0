import type { BuiltInLevel } from "../levels/builtInLevel";
import { decodeMonoPcm, type PcmAudio } from "./decodeAudio";

const loadError = "\u5173\u5361\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";

export async function loadBuiltInLevelAudio(
  level: BuiltInLevel,
  context: Pick<BaseAudioContext, "decodeAudioData">,
  fetcher: typeof fetch = fetch,
): Promise<PcmAudio> {
  try {
    const response = await fetcher(level.videoUrl);
    if (!response.ok) throw new Error("load failed");
    return await decodeMonoPcm(await response.blob(), context);
  } catch {
    throw new Error(loadError);
  }
}
