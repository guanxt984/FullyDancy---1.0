export interface PcmAudio {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

export class UnsupportedAudioFormatError extends Error {
  constructor() {
    super("不支持该视频的音频格式");
    this.name = "UnsupportedAudioFormatError";
  }
}

export class MissingAudioTrackError extends Error {
  constructor() {
    super("视频没有可用音轨");
    this.name = "MissingAudioTrackError";
  }
}

export async function decodeMonoPcm(
  file: File,
  context: Pick<BaseAudioContext, "decodeAudioData">,
): Promise<PcmAudio> {
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new UnsupportedAudioFormatError();
  }

  if (decoded.numberOfChannels === 0) throw new MissingAudioTrackError();

  const samples = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const channelData = decoded.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] += channelData[index] / decoded.numberOfChannels;
    }
  }

  return {
    samples,
    sampleRate: decoded.sampleRate,
    durationSec: decoded.duration,
  };
}
