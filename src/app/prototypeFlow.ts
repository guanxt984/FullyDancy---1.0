import type { BeatPoint } from "../domain/types";

export type PrototypeScreen =
  | "home"
  | "level-select"
  | "analysis"
  | "calibration"
  | "countdown"
  | "challenge";

export interface PrototypeSession {
  chart: BeatPoint[];
}
