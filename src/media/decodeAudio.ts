export interface PcmAudio {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsArrayBuffer(blob);
  });
}

export async function decodeMonoPcm(
  blob: Blob,
  context: Pick<BaseAudioContext, "decodeAudioData">,
): Promise<PcmAudio> {
  const decoded = await context.decodeAudioData(await readBlob(blob));

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
