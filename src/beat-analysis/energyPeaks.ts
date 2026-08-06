import type { BeatPoint } from "../domain/types";
import type { PcmAudio } from "../media/decodeAudio";

interface PeakConfig {
  windowMs?: number;
  thresholdRatio?: number;
  minSpacingSec?: number;
  edgePaddingSec?: number;
  maxPeaks?: number;
}

interface WindowEnergy {
  energy: number;
  peakSampleIndex: number;
}

interface Candidate {
  timeSec: number;
  salience: number;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function detectEnergyPeaks(audio: PcmAudio, config: PeakConfig = {}): BeatPoint[] {
  const windowMs = config.windowMs ?? 80;
  const thresholdRatio = config.thresholdRatio ?? 1.35;
  const minSpacingSec = config.minSpacingSec ?? 0.45;
  const edgePaddingSec = config.edgePaddingSec ?? 0.25;
  const maxPeaks = config.maxPeaks ?? 12;
  const windowSize = Math.max(1, Math.round((audio.sampleRate * windowMs) / 1_000));
  const windows: WindowEnergy[] = [];

  for (let start = 0; start < audio.samples.length; start += windowSize) {
    let sum = 0;
    let peakSampleIndex = start;
    let peakAbs = 0;
    const end = Math.min(audio.samples.length, start + windowSize);
    for (let index = start; index < end; index += 1) {
      const sample = audio.samples[index];
      const abs = Math.abs(sample);
      if (abs > peakAbs) {
        peakAbs = abs;
        peakSampleIndex = index;
      }
      sum += sample ** 2;
    }
    windows.push({ energy: Math.sqrt(sum / Math.max(1, end - start)), peakSampleIndex });
  }

  const energies = windows.map((window) => window.energy);
  const threshold = median(energies) * thresholdRatio;
  const candidates: Candidate[] = [];
  for (let index = 1; index < windows.length - 1; index += 1) {
    const energy = windows[index].energy;
    const timeSec = windows[index].peakSampleIndex / audio.sampleRate;
    if (timeSec < edgePaddingSec || timeSec > audio.durationSec - edgePaddingSec) continue;
    if (energy <= threshold || energy < windows[index - 1].energy || energy < windows[index + 1].energy) continue;
    candidates.push({ timeSec: Number(timeSec.toFixed(2)), salience: energy });
  }

  const spaced: Candidate[] = [];
  for (const candidate of candidates) {
    const previous = spaced[spaced.length - 1];
    if (!previous || candidate.timeSec - previous.timeSec >= minSpacingSec) {
      spaced.push(candidate);
    } else if (candidate.salience > previous.salience) {
      spaced[spaced.length - 1] = candidate;
    }
  }

  return spaced
    .sort((a, b) => a.timeSec - b.timeSec)
    .slice(0, maxPeaks)
    .map((peak, index) => ({
      id: `beat-${index + 1}`,
      beatIndex: index + 1,
      timeSec: peak.timeSec,
      salience: peak.salience,
      enabled: true,
      action: "rhythm",
    }));
}
