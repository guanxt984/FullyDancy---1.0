export const GAME_CONFIG = {
  timingWindowsMs: {
    perfect: 100,
    great: 200,
    miss: 350,
  },
  poseFps: 20,
  minimumVisibility: 0.6,
  openAngleToleranceDeg: 10,
  squatRatio: 0.85,
  fullCalibrationMs: 6000,
  retryVerificationMs: 2000,
} as const;
