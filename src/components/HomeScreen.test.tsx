import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";
import {
  getDancePresetForTrigger,
  getParticleFlowVector,
  PARTICLE_DANCER_CONFIG,
  PARTICLE_MOTION_CONFIG,
  PARTICLE_VISUAL_CONFIG,
  POINTER_TRAIL_CONFIG,
  SKELETON_JOINTS,
  TIMELINE_VISUAL_CONFIG,
  shouldStartPointerDancer,
} from "./ParticleDancerHero";

const productName = "FullyDancy";
const productIntro = "AI 居家练舞助手，帮你看见身体舒展、手臂打开和每一次卡点。";
const startLabel = "开始游戏";
const particleLabel = "荧光骨架舞者动效";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HomeScreen", () => {
  it("skips from this page through the shared bottom-right action", () => {
    const onSkip = vi.fn();
    render(<HomeScreen onStart={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("uses the product name as the biggest homepage heading", () => {
    const onStart = vi.fn();
    render(<HomeScreen onStart={onStart} onSkip={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: productName })).toHaveClass("home-product-name");
    expect(screen.getByText(productIntro)).toHaveClass("home-product-intro");
    expect(screen.getByLabelText(particleLabel)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: startLabel }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("marks the particle dancer as reduced motion when motion is limited", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<HomeScreen onStart={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByLabelText(particleLabel)).toHaveAttribute("data-reduced-motion", "true");
  });

  it("lets the particle dancer react to pointer movement", () => {
    const addListener = vi.spyOn(HTMLCanvasElement.prototype, "addEventListener");

    try {
      render(<HomeScreen onStart={vi.fn()} onSkip={vi.fn()} />);

      expect(addListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
      expect(addListener).toHaveBeenCalledWith("pointerleave", expect.any(Function));
    } finally {
      addListener.mockRestore();
    }
  });

  it("drives particles with a position-based flow field", () => {
    const first = getParticleFlowVector(0.2, 0.3, 1);
    const second = getParticleFlowVector(0.7, 0.3, 1);
    const firstMagnitude = Math.hypot(first.x, first.y);

    expect(firstMagnitude).toBeGreaterThan(0.9);
    expect(firstMagnitude).toBeLessThan(1.1);
    expect(Math.abs(first.x - second.x) + Math.abs(first.y - second.y)).toBeGreaterThan(0.1);
  });

  it("slows particle motion and lowers pointer sensitivity for a calmer hero", () => {
    expect(PARTICLE_MOTION_CONFIG.flowForce).toBeLessThanOrEqual(0.000016);
    expect(PARTICLE_MOTION_CONFIG.dancerPull).toBeLessThanOrEqual(0.000045);
    expect(PARTICLE_MOTION_CONFIG.pointerPull).toBeLessThanOrEqual(0.00004);
    expect(PARTICLE_MOTION_CONFIG.pointerSwirl).toBeLessThanOrEqual(0.000012);
    expect(PARTICLE_MOTION_CONFIG.damping).toBeGreaterThanOrEqual(0.97);
  });

  it("uses a dense but bounded particle field for the hero canvas", () => {
    expect(PARTICLE_DANCER_CONFIG.particleCount).toBeGreaterThanOrEqual(1100);
    expect(PARTICLE_DANCER_CONFIG.particleCount).toBeLessThanOrEqual(1300);
    expect(PARTICLE_DANCER_CONFIG.reducedMotionParticleCount).toBeGreaterThanOrEqual(260);
  });

  it("keeps pointer dancer bursts short while cycling through distinct dance presets", () => {
    expect(PARTICLE_DANCER_CONFIG.danceDurationSeconds).toBe(1);
    expect(PARTICLE_DANCER_CONFIG.cooldownSeconds).toBeLessThanOrEqual(1.4);
    expect(getDancePresetForTrigger(0)).toBe("openArms");
    expect(getDancePresetForTrigger(1)).toBe("sideReach");
    expect(getDancePresetForTrigger(2)).toBe("bounceStep");
    expect(getDancePresetForTrigger(3)).toBe("crossHit");
    expect(getDancePresetForTrigger(4)).toBe("openArms");
  });

  it("removes the lower timeline rail from the home hero", () => {
    expect(TIMELINE_VISUAL_CONFIG.railEnabled).toBe(false);
    expect(TIMELINE_VISUAL_CONFIG.beatDotsEnabled).toBe(false);
  });

  it("brightens aggregation without adding a permanent center skeleton", () => {
    expect(PARTICLE_VISUAL_CONFIG.coreAlpha).toBeGreaterThanOrEqual(0.76);
    expect(PARTICLE_VISUAL_CONFIG.glowAlpha).toBeGreaterThanOrEqual(0.5);
    expect(PARTICLE_VISUAL_CONFIG.dancerGlowBoost).toBeGreaterThanOrEqual(0.3);
    expect(PARTICLE_VISUAL_CONFIG.centerSkeletonEnabled).toBe(false);
    expect(PARTICLE_VISUAL_CONFIG.hasMainStageParticles).toBe(false);
    expect(PARTICLE_VISUAL_CONFIG.rhythmPulseEnabled).toBe(false);
  });

  it("uses a slower pointer trail to guide nearby particles gently", () => {
    expect(POINTER_TRAIL_CONFIG.maxPoints).toBeGreaterThanOrEqual(10);
    expect(POINTER_TRAIL_CONFIG.lifetimeSeconds).toBeGreaterThanOrEqual(0.85);
    expect(POINTER_TRAIL_CONFIG.lifetimeSeconds).toBeLessThanOrEqual(1.2);
    expect(POINTER_TRAIL_CONFIG.pull).toBeGreaterThan(0);
    expect(POINTER_TRAIL_CONFIG.pull).toBeLessThanOrEqual(0.00006);
  });

  it("starts the pointer dancer only after sustained local density", () => {
    const ready = shouldStartPointerDancer({
      nearbyCount: PARTICLE_DANCER_CONFIG.densityThreshold,
      heldSeconds: PARTICLE_DANCER_CONFIG.densityHoldSeconds,
      secondsSinceLastDance: PARTICLE_DANCER_CONFIG.cooldownSeconds,
    });
    const tooSparse = shouldStartPointerDancer({
      nearbyCount: PARTICLE_DANCER_CONFIG.densityThreshold - 1,
      heldSeconds: PARTICLE_DANCER_CONFIG.densityHoldSeconds,
      secondsSinceLastDance: PARTICLE_DANCER_CONFIG.cooldownSeconds,
    });
    const tooSoon = shouldStartPointerDancer({
      nearbyCount: PARTICLE_DANCER_CONFIG.densityThreshold,
      heldSeconds: PARTICLE_DANCER_CONFIG.densityHoldSeconds - 0.01,
      secondsSinceLastDance: PARTICLE_DANCER_CONFIG.cooldownSeconds,
    });

    expect(ready).toBe(true);
    expect(tooSparse).toBe(false);
    expect(tooSoon).toBe(false);
  });

  it("makes the hero animation read as dance-assistance software", () => {
    expect(SKELETON_JOINTS).toEqual(expect.arrayContaining(["shoulder", "elbow", "wrist", "hip", "knee", "ankle"]));
  });
});
