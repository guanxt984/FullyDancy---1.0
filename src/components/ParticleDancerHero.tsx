import { useEffect, useMemo, useRef } from "react";
import {
  createAnimatedDancerSkeleton,
  createSkeletonParticleTargets,
  DANCE_PRESETS,
  SKELETON_BONES,
  SKELETON_JOINTS,
  updateSkeletonParticleTargets,
  type AnimatedDancerSkeleton,
  type DancePreset,
  type Point,
  type SkeletonParticleTarget,
} from "./dancerSkeleton";

export { createAnimatedDancerSkeleton, DANCE_PRESETS, SKELETON_JOINTS } from "./dancerSkeleton";

const particleLabel = "荧光骨架舞者动效";
const TAU = Math.PI * 2;

export const RHYTHM_BEATS = [0.08, 0.18, 0.31, 0.43, 0.55, 0.68, 0.79, 0.91] as const;

export const PARTICLE_MOTION_CONFIG = {
  flowForce: 0.000015,
  dancerPull: 0.000043,
  pointerPull: 0.000038,
  pointerSwirl: 0.00001,
  burstMin: 0.00062,
  burstRandom: 0.00034,
  damping: 0.972,
} as const;

export const PARTICLE_DANCER_CONFIG = {
  particleCount: 1180,
  reducedMotionParticleCount: 320,
  densityRadius: 0.19,
  densityThreshold: 62,
  densityHoldSeconds: 0.48,
  danceDurationSeconds: 1,
  cooldownSeconds: 1.2,
  localDancerScale: 0.16,
  localDancerPull: 0.00046,
  gradientEvery: 3,
} as const;

export const TIMELINE_VISUAL_CONFIG = {
  railEnabled: false,
  beatDotsEnabled: false,
} as const;

export const PARTICLE_VISUAL_CONFIG = {
  coreAlpha: 0.78,
  glowAlpha: 0.56,
  dancerGlowBoost: 0.34,
  centerSkeletonEnabled: false,
  hasMainStageParticles: false,
  rhythmPulseEnabled: false,
} as const;

export const POINTER_TRAIL_CONFIG = {
  maxPoints: 12,
  lifetimeSeconds: 0.95,
  radius: 0.15,
  pull: 0.000055,
} as const;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  drift: number;
  depth: number;
  burstAt: number;
  nearPointer: boolean;
  target: Point;
};

type PointerState = Point & { active: boolean };

type PointerDancerState = {
  denseSince: number | null;
  activeUntil: number;
  lastStartedAt: number;
  center: Point;
  preset: DancePreset;
};

type PointerDancerInput = {
  nearbyCount: number;
  heldSeconds: number;
  secondsSinceLastDance: number;
};

type PointerTrailPoint = Point & {
  createdAt: number;
};

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getParticleFlowVector(x: number, y: number, elapsed: number): Point {
  const slowTime = elapsed * 0.032;
  const ribbon = Math.sin((x * 1.1 + y * 0.28 + slowTime) * TAU) * 0.55;
  const wave = Math.cos((y * 0.96 - slowTime * 0.72) * TAU) * 0.34;
  const diagonal = Math.sin((x * 0.62 + y * 0.86 + slowTime * 0.44) * TAU) * 0.22;
  const angle = -0.1 + ribbon + wave + diagonal + (x - 0.5) * 0.22;

  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function shouldStartPointerDancer({ nearbyCount, heldSeconds, secondsSinceLastDance }: PointerDancerInput): boolean {
  return (
    nearbyCount >= PARTICLE_DANCER_CONFIG.densityThreshold &&
    heldSeconds >= PARTICLE_DANCER_CONFIG.densityHoldSeconds &&
    secondsSinceLastDance >= PARTICLE_DANCER_CONFIG.cooldownSeconds
  );
}

function createLine(from: Point, to: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

function createCircle(center: Point, radius: number, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (TAU * index) / count;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function ambientFlowTargets(): Point[] {
  const targets: Point[] = [];
  const rows = [0.24, 0.38, 0.52, 0.68, 0.82];

  rows.forEach((baseY, rowIndex) => {
    for (let index = 0; index < 34; index += 1) {
      const t = index / 33;
      targets.push({
        x: 0.05 + t * 0.9,
        y: baseY + Math.sin(t * TAU * 1.35 + rowIndex * 0.82) * (0.035 + rowIndex * 0.004),
      });
    }
  });

  return targets;
}

function createParticles(count: number, targets: Point[]): Particle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00022,
    vy: (Math.random() - 0.5) * 0.00022,
    size: Math.random() < 0.1 ? 1.8 + Math.random() * 1.25 : 0.95 + Math.random() * 1.15,
    drift: Math.random() * TAU,
    depth: 0.55 + Math.random() * 0.95,
    burstAt: -1,
    nearPointer: false,
    target: targets[index % targets.length],
  }));
}

function drawRhythmLane(context: CanvasRenderingContext2D, width: number, height: number) {
  const y = height * 0.78;
  const startX = width * 0.1;
  const endX = width * 0.9;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = "oklch(0.88 0.13 118 / 0.2)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(startX, y);
  context.lineTo(endX, y);
  context.stroke();

  RHYTHM_BEATS.forEach((beat, index) => {
    const x = startX + (endX - startX) * beat;
    const radius = 2.8 + (index % 3) * 0.35;
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 5.4);
    glow.addColorStop(0, "oklch(0.96 0.22 112 / 0.42)");
    glow.addColorStop(1, "oklch(0.75 0.15 135 / 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius * 5.4, 0, TAU);
    context.fill();
    context.fillStyle = "oklch(0.96 0.2 114 / 0.82)";
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  });

  context.restore();
}

function drawPointerTrail(context: CanvasRenderingContext2D, trail: PointerTrailPoint[], width: number, height: number, elapsed: number) {
  if (trail.length < 2) return;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineWidth = 1.15;
  context.strokeStyle = "oklch(0.93 0.22 116 / 0.32)";
  context.beginPath();
  trail.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  trail.forEach((point) => {
    const age = elapsed - point.createdAt;
    const alpha = Math.max(0, 1 - age / POINTER_TRAIL_CONFIG.lifetimeSeconds);
    context.fillStyle = `oklch(0.96 0.22 112 / ${alpha * 0.34})`;
    context.beginPath();
    context.arc(point.x * width, point.y * height, 2.2 + alpha * 1.5, 0, TAU);
    context.fill();
  });
  context.restore();
}

function toCanvas(point: Point, center: Point, scale: number, width: number, height: number): Point {
  return {
    x: (center.x + point.x * scale) * width,
    y: (center.y + point.y * scale) * height,
  };
}

function drawSkeletonSignal(
  context: CanvasRenderingContext2D,
  skeleton: AnimatedDancerSkeleton,
  center: Point,
  scale: number,
  width: number,
  height: number,
  alpha: number,
) {
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `oklch(0.94 0.2 116 / ${alpha * 0.68})`;
  context.lineWidth = 1.35 + skeleton.beat * 0.8;
  context.beginPath();
  SKELETON_BONES.forEach(([fromName, toName]) => {
    const from = toCanvas(skeleton.joints[fromName], center, scale, width, height);
    const to = toCanvas(skeleton.joints[toName], center, scale, width, height);
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  });
  context.stroke();

  Object.values(skeleton.joints).forEach((joint) => {
    const point = toCanvas(joint, center, scale, width, height);
    const important = joint.role === "wrist" || joint.name.startsWith("elbow") || joint.name.startsWith("shoulder");
    const radius = important ? 3.2 + skeleton.beat * 1.6 : 2 + skeleton.beat * 0.5;
    context.fillStyle = important ? `oklch(0.99 0.25 112 / ${alpha})` : `oklch(0.9 0.16 130 / ${alpha * 0.78})`;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, TAU);
    context.fill();
  });

  context.restore();
}

function localTarget(target: SkeletonParticleTarget, center: Point, scale: number): Point {
  return {
    x: center.x + target.x * scale,
    y: center.y + target.y * scale,
  };
}

export function getDancePresetForTrigger(triggerIndex: number): DancePreset {
  return DANCE_PRESETS[Math.abs(Math.floor(triggerIndex)) % DANCE_PRESETS.length];
}

export function ParticleDancerHero() {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const ambientTargets = ambientFlowTargets();
    const particles = createParticles(reducedMotion ? PARTICLE_DANCER_CONFIG.reducedMotionParticleCount : PARTICLE_DANCER_CONFIG.particleCount, ambientTargets);
    const pointerTargets = createSkeletonParticleTargets(createAnimatedDancerSkeleton(0));
    const pointerTrail: PointerTrailPoint[] = [];
    const pointer: PointerState = { x: 0.5, y: 0.5, active: false };
    const pointerDancer: PointerDancerState = {
      denseSince: null,
      activeUntil: 0,
      lastStartedAt: -Infinity,
      center: { x: 0.5, y: 0.5 },
      preset: "openArms",
    };
    let frameId = 0;
    let lastElapsed = 0;
    let triggerIndex = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointer.active = true;
      pointerTrail.push({ x: pointer.x, y: pointer.y, createdAt: lastElapsed });
      if (pointerTrail.length > POINTER_TRAIL_CONFIG.maxPoints) pointerTrail.splice(0, pointerTrail.length - POINTER_TRAIL_CONFIG.maxPoints);
    };
    const releasePointer = () => {
      pointer.active = false;
    };

    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerleave", releasePointer);

    const render = (now: number) => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const elapsed = now / 1000;
      lastElapsed = elapsed;
      const gatherPulse = reducedMotion ? 0.35 : Math.max(0, Math.sin(elapsed * 0.2 - 0.6));
      const gather = reducedMotion ? 0.28 : gatherPulse ** 3.2;
      while (pointerTrail.length > 0 && elapsed - pointerTrail[0].createdAt > POINTER_TRAIL_CONFIG.lifetimeSeconds) {
        pointerTrail.shift();
      }

      context.fillStyle = `oklch(0.045 0.02 140 / ${reducedMotion ? 0.92 : 0.29})`;
      context.fillRect(0, 0, width, height);
      drawPointerTrail(context, pointerTrail, width, height, elapsed);
      context.globalCompositeOperation = "lighter";

      let nearbyCount = 0;
      if (pointer.active && !reducedMotion) {
        particles.forEach((particle) => {
          const distance = Math.hypot(pointer.x - particle.x, pointer.y - particle.y);
          if (distance < PARTICLE_DANCER_CONFIG.densityRadius) nearbyCount += 1;
        });

        if (nearbyCount >= PARTICLE_DANCER_CONFIG.densityThreshold) pointerDancer.denseSince ??= elapsed;
        else pointerDancer.denseSince = null;

        const heldSeconds = pointerDancer.denseSince == null ? 0 : elapsed - pointerDancer.denseSince;
        if (
          shouldStartPointerDancer({
            nearbyCount,
            heldSeconds,
            secondsSinceLastDance: elapsed - pointerDancer.lastStartedAt,
          })
        ) {
          pointerDancer.activeUntil = elapsed + PARTICLE_DANCER_CONFIG.danceDurationSeconds;
          pointerDancer.lastStartedAt = elapsed;
          pointerDancer.center = { x: pointer.x, y: pointer.y };
          pointerDancer.preset = getDancePresetForTrigger(triggerIndex);
          triggerIndex += 1;
          pointerDancer.denseSince = null;
        }
      } else {
        pointerDancer.denseSince = null;
      }

      const dancerActive = elapsed < pointerDancer.activeUntil;
      const dancerAge = PARTICLE_DANCER_CONFIG.danceDurationSeconds - (pointerDancer.activeUntil - elapsed);
      const dancerFade = dancerActive
        ? Math.min(1, (pointerDancer.activeUntil - elapsed) / 0.55, dancerAge / 0.42)
        : 0;
      const pointerDanceTime = dancerActive && Number.isFinite(pointerDancer.lastStartedAt) ? Math.max(0, elapsed - pointerDancer.lastStartedAt) : 0;
      const pointerSkeleton = createAnimatedDancerSkeleton(pointerDanceTime * 1.25, pointerDancer.preset);
      updateSkeletonParticleTargets(pointerTargets, pointerSkeleton);

      particles.forEach((particle, index) => {
        const flow = getParticleFlowVector(particle.x, particle.y, elapsed + particle.drift * 0.16);
        const targetX = particle.target.x + Math.sin(elapsed * 0.18 + particle.drift) * 0.012;
        const targetY = particle.target.y + Math.cos(elapsed * 0.16 + particle.drift) * 0.01;
        const flowForce = PARTICLE_MOTION_CONFIG.flowForce * particle.depth;
        particle.vx += flow.x * flowForce;
        particle.vy += flow.y * flowForce;
        particle.vx += (targetX - particle.x) * PARTICLE_MOTION_CONFIG.dancerPull * gather;
        particle.vy += (targetY - particle.y) * PARTICLE_MOTION_CONFIG.dancerPull * gather;

        pointerTrail.forEach((trailPoint) => {
          const age = elapsed - trailPoint.createdAt;
          const trailAlpha = Math.max(0, 1 - age / POINTER_TRAIL_CONFIG.lifetimeSeconds);
          const trailDx = trailPoint.x - particle.x;
          const trailDy = trailPoint.y - particle.y;
          const trailDistance = Math.hypot(trailDx, trailDy) || 0.0001;
          if (trailDistance < POINTER_TRAIL_CONFIG.radius) {
            const pull = ((POINTER_TRAIL_CONFIG.radius - trailDistance) / POINTER_TRAIL_CONFIG.radius) * trailAlpha * POINTER_TRAIL_CONFIG.pull;
            particle.vx += (trailDx / trailDistance) * pull;
            particle.vy += (trailDy / trailDistance) * pull;
          }
        });

        if (dancerActive) {
          const rawTarget = pointerTargets[index % pointerTargets.length];
          const dancerTarget = localTarget(rawTarget, pointerDancer.center, PARTICLE_DANCER_CONFIG.localDancerScale);
          const dancerDistance = Math.hypot(pointerDancer.center.x - particle.x, pointerDancer.center.y - particle.y);
          if (dancerDistance < PARTICLE_DANCER_CONFIG.densityRadius * 1.75) {
            const roleBoost = rawTarget.role === "wrist" ? 1.55 : rawTarget.role === "arm" ? 1.25 : 1;
            const pull = PARTICLE_DANCER_CONFIG.localDancerPull * dancerFade * roleBoost * (1 - Math.min(1, dancerDistance / (PARTICLE_DANCER_CONFIG.densityRadius * 1.75)));
            particle.vx += (dancerTarget.x - particle.x) * pull;
            particle.vy += (dancerTarget.y - particle.y) * pull;
          }
        }

        let pointerGlow = 0;
        if (pointer.active && !reducedMotion) {
          const pointerDx = pointer.x - particle.x;
          const pointerDy = pointer.y - particle.y;
          const pointerDistance = Math.hypot(pointerDx, pointerDy) || 0.0001;
          const reach = 0.34;
          const burstDistance = 0.032;
          const resetDistance = 0.078;
          const tangentX = -pointerDy / pointerDistance;
          const tangentY = pointerDx / pointerDistance;

          if (pointerDistance < reach) {
            const pull = ((reach - pointerDistance) / reach) ** 1.7;
            particle.vx += (pointerDx / pointerDistance) * PARTICLE_MOTION_CONFIG.pointerPull * pull;
            particle.vy += (pointerDy / pointerDistance) * PARTICLE_MOTION_CONFIG.pointerPull * pull;
            particle.vx += tangentX * PARTICLE_MOTION_CONFIG.pointerSwirl * pull;
            particle.vy += tangentY * PARTICLE_MOTION_CONFIG.pointerSwirl * pull;
            pointerGlow = pull;
          }

          if (pointerDistance < burstDistance && !particle.nearPointer) {
            const burst = PARTICLE_MOTION_CONFIG.burstMin + Math.random() * PARTICLE_MOTION_CONFIG.burstRandom;
            particle.vx -= (pointerDx / pointerDistance) * burst;
            particle.vy -= (pointerDy / pointerDistance) * burst;
            particle.burstAt = elapsed;
            particle.nearPointer = true;
            pointerGlow = 1;
          }

          if (pointerDistance > resetDistance) particle.nearPointer = false;
        } else {
          particle.nearPointer = false;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= PARTICLE_MOTION_CONFIG.damping;
        particle.vy *= PARTICLE_MOTION_CONFIG.damping;

        if (particle.x < -0.08 || particle.x > 1.08 || particle.y < -0.08 || particle.y > 1.08) {
          particle.x = particle.x < -0.08 ? 1.04 : particle.x > 1.08 ? -0.04 : Math.random();
          particle.y = Math.random();
          particle.vx = (Math.random() - 0.5) * 0.00022;
          particle.vy = (Math.random() - 0.5) * 0.00022;
          particle.nearPointer = false;
        }

        const beat = 0.58 + Math.sin(elapsed * 1.05 + index * 0.17) * 0.12;
        const burstGlow = Math.max(0, 1 - (elapsed - particle.burstAt) * 4.8);
        const dancerGlow = dancerFade * PARTICLE_VISUAL_CONFIG.dancerGlowBoost;
        const alpha = PARTICLE_VISUAL_CONFIG.coreAlpha * 0.44 + gather * 0.12 + beat * 0.12 + pointerGlow * 0.12 + burstGlow * 0.23 + dancerGlow;
        const x = particle.x * width;
        const y = particle.y * height;
        const radius = particle.size * particle.depth + gather * 0.12 + pointerGlow * 0.14 + burstGlow * 0.3 + dancerFade * 0.18;
        if (index % PARTICLE_DANCER_CONFIG.gradientEvery === 0 || burstGlow > 0.15 || pointerGlow > 0.5 || (dancerFade > 0.18 && index % 2 === 0)) {
          const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.1);
          glow.addColorStop(0, `oklch(0.99 0.25 112 / ${Math.min(0.98, alpha + PARTICLE_VISUAL_CONFIG.glowAlpha * 0.26 + dancerGlow * 0.18)})`);
          glow.addColorStop(0.4, `oklch(0.9 0.21 132 / ${alpha * 0.48 + dancerGlow * 0.12})`);
          glow.addColorStop(1, "oklch(0.72 0.14 160 / 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(x, y, radius * 2.1, 0, TAU);
          context.fill();
        }

        context.fillStyle = `oklch(0.995 0.25 112 / ${Math.min(0.99, alpha + PARTICLE_VISUAL_CONFIG.coreAlpha * 0.22 + dancerGlow * 0.14)})`;
        context.beginPath();
        context.arc(x, y, radius * 0.78, 0, TAU);
        context.fill();
      });

      if (dancerFade > 0) {
        drawSkeletonSignal(context, pointerSkeleton, pointerDancer.center, PARTICLE_DANCER_CONFIG.localDancerScale, width, height, Math.min(1, dancerFade * 1.12));
      }

      context.globalCompositeOperation = "source-over";
      if (!reducedMotion) frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", updatePointer);
      canvas.removeEventListener("pointerleave", releasePointer);
      window.cancelAnimationFrame(frameId);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="particle-dancer" aria-label={particleLabel} data-reduced-motion={String(reducedMotion)} />;
}
