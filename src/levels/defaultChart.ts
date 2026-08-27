import type { BeatPoint } from "../domain/types";

const FALLBACK_BEAT_TIMES = [0.68, 1.61, 2.2, 3.18, 4.46, 4.94, 5.7, 6.65, 8.49, 9.31, 10.74, 11.72];

export const DEFAULT_BUILT_IN_CHART: BeatPoint[] = FALLBACK_BEAT_TIMES.map((timeSec, index) => ({
  id: `fallback-${index + 1}`,
  beatIndex: index + 1,
  timeSec,
  salience: 1,
  enabled: true,
  action: "rhythm",
  actions: ["rhythm"],
}));
