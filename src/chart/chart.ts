import type { BeatPoint } from "../domain/types";

export function updateBeat(chart: BeatPoint[], beatId: string, patch: Partial<Pick<BeatPoint, "enabled" | "action">>): BeatPoint[] {
  return chart.map((beat) => (beat.id === beatId ? { ...beat, ...patch } : beat));
}
