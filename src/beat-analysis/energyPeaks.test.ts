import { describe, expect, it } from "vitest";
import type { PcmAudio } from "../media/decodeAudio";
import { detectEnergyPeaks } from "./energyPeaks";

function impulsePcm(timesSec: number[]): PcmAudio {
  const sampleRate = 1_000;
  const samples = new Float32Array(4_500);
  for (const timeSec of timesSec) samples[Math.round(timeSec * sampleRate)] = 1;
  return { samples, sampleRate, durationSec: samples.length / sampleRate };
}

describe("detectEnergyPeaks", () => {
  it("keeps separated local energy peaks instead of using a preset chart", () => {
    const audio = impulsePcm([1, 2, 2.1, 4]);

    expect(detectEnergyPeaks(audio).map((beat) => beat.timeSec)).toEqual([1, 2, 4]);
  });

  it("does not invent candidates when the audio has no local peaks", () => {
    const samples = new Float32Array(2_000).fill(0.25);

    expect(detectEnergyPeaks({ samples, sampleRate: 1_000, durationSec: 2 })).toEqual([]);
  });
});
