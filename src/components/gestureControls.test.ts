import { describe, expect, it } from "vitest";
import type { PoseFrame } from "../domain/types";
import { DanceGestureController } from "./gestureControls";

function gestureFrame(kind: "open-palm" | "hands-up" | "neutral"): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.7, z: 0, visibility: 0.95 }));
  landmarks[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  landmarks[11] = { x: 0.42, y: 0.4, z: 0, visibility: 0.95 };
  landmarks[12] = { x: 0.58, y: 0.4, z: 0, visibility: 0.95 };
  if (kind === "hands-up") {
    landmarks[15].y = 0.1;
    landmarks[16].y = 0.1;
  }
  if (kind === "open-palm") {
    landmarks[15] = { x: 0.25, y: 0.45, z: 0, visibility: 0.95 };
    landmarks[17] = { x: 0.19, y: 0.4, z: 0, visibility: 0.95 };
    landmarks[19] = { x: 0.25, y: 0.34, z: 0, visibility: 0.95 };
    landmarks[21] = { x: 0.31, y: 0.4, z: 0, visibility: 0.95 };
  }
  return { captureTimeSec: 0, landmarks };
}

describe("DanceGestureController", () => {
  it("toggles playback only after an open palm is held for 600ms", () => {
    const controller = new DanceGestureController();
    expect(controller.update(gestureFrame("open-palm"), 0)).toBeNull();
    expect(controller.update(gestureFrame("open-palm"), 599)).toBeNull();
    expect(controller.update(gestureFrame("open-palm"), 600)).toBe("toggle-playback");
  });

  it("restarts only after both hands are held overhead for 1000ms", () => {
    const controller = new DanceGestureController();
    expect(controller.update(gestureFrame("hands-up"), 0)).toBeNull();
    expect(controller.update(gestureFrame("hands-up"), 999)).toBeNull();
    expect(controller.update(gestureFrame("hands-up"), 1000)).toBe("restart");
  });

  it("requires a neutral pose before the same gesture can fire again", () => {
    const controller = new DanceGestureController();
    controller.update(gestureFrame("open-palm"), 0);
    expect(controller.update(gestureFrame("open-palm"), 600)).toBe("toggle-playback");
    expect(controller.update(gestureFrame("open-palm"), 2000)).toBeNull();
    controller.update(gestureFrame("neutral"), 2100);
    controller.update(gestureFrame("open-palm"), 2200);
    expect(controller.update(gestureFrame("open-palm"), 2800)).toBe("toggle-playback");
  });
});
