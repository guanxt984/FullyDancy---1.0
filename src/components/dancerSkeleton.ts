export type Point = { x: number; y: number };

export type JointName =
  | "head"
  | "neck"
  | "shoulderL"
  | "shoulderR"
  | "elbowL"
  | "elbowR"
  | "wristL"
  | "wristR"
  | "spine"
  | "hipL"
  | "hipR"
  | "kneeL"
  | "kneeR"
  | "ankleL"
  | "ankleR";

export type SkeletonRole = "head" | "core" | "arm" | "wrist" | "leg";

export type SkeletonJoint = Point & {
  name: JointName;
  role: SkeletonRole;
};

export type SkeletonParticleTarget = Point & {
  role: SkeletonRole;
};

export type AnimatedDancerSkeleton = {
  joints: Record<JointName, SkeletonJoint>;
  beat: number;
  phase: number;
};

export const DANCE_PRESETS = ["openArms", "sideReach", "bounceStep", "crossHit"] as const;
export type DancePreset = (typeof DANCE_PRESETS)[number];

export const SKELETON_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;

export const SKELETON_BONES: Array<[JointName, JointName]> = [
  ["head", "neck"],
  ["neck", "shoulderL"],
  ["neck", "shoulderR"],
  ["shoulderL", "elbowL"],
  ["elbowL", "wristL"],
  ["shoulderR", "elbowR"],
  ["elbowR", "wristR"],
  ["neck", "spine"],
  ["spine", "hipL"],
  ["spine", "hipR"],
  ["hipL", "hipR"],
  ["hipL", "kneeL"],
  ["kneeL", "ankleL"],
  ["hipR", "kneeR"],
  ["kneeR", "ankleR"],
];

const TAU = Math.PI * 2;

function smoothPulse(value: number) {
  return (Math.sin(value) + 1) / 2;
}

function joint(name: JointName, x: number, y: number, role: SkeletonRole): SkeletonJoint {
  return { name, x, y, role };
}

function lineTargets(from: Point, to: Point, count: number, role: SkeletonRole): SkeletonParticleTarget[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const ease = t * t * (3 - 2 * t);
    return {
      x: from.x + (to.x - from.x) * ease,
      y: from.y + (to.y - from.y) * ease,
      role,
    };
  });
}

function circleTargets(center: Point, radius: number, count: number, role: SkeletonRole): SkeletonParticleTarget[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (TAU * index) / count;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      role,
    };
  });
}

export function createAnimatedDancerSkeleton(elapsedSeconds: number, preset: DancePreset = "openArms"): AnimatedDancerSkeleton {
  const safeElapsedSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const phase = safeElapsedSeconds * 2.55;
  const beat = smoothPulse(phase * 1.9);
  const open = smoothPulse(phase);
  const counterOpen = smoothPulse(phase + Math.PI * 0.82);
  const sway = Math.sin(phase * 0.72) * 0.055;
  const bounce = Math.sin(phase * 1.9) * 0.035;
  const lean = Math.sin(phase * 0.62) * 0.035;
  const shoulderWave = Math.sin(phase * 1.3) * 0.035;
  const hipWave = Math.sin(phase * 0.9 + 0.6) * 0.045;
  const legPulse = Math.sin(phase + Math.PI * 0.35);

  const neck = { x: sway * 0.34 + lean * 0.12, y: -0.31 + bounce * 0.2 };
  const spine = { x: sway * 0.58, y: 0.085 + bounce * 0.46 };
  const shoulderL = { x: neck.x - 0.16 - lean * 0.72, y: neck.y + 0.08 + shoulderWave * 0.3 };
  const shoulderR = { x: neck.x + 0.16 - lean * 0.72, y: neck.y + 0.07 - shoulderWave * 0.28 };
  let hipL = { x: spine.x - 0.1 + hipWave * 0.35, y: spine.y + 0.18 - bounce * 0.16 };
  let hipR = { x: spine.x + 0.1 + hipWave * 0.35, y: spine.y + 0.18 + bounce * 0.1 };

  const wristLiftL = -0.21 - open * 0.21 + Math.sin(phase * 2.1) * 0.035;
  const wristLiftR = -0.19 - counterOpen * 0.18 + Math.cos(phase * 1.85) * 0.045;

  let elbowL = {
    x: shoulderL.x - 0.135 - open * 0.045,
    y: shoulderL.y - 0.055 - open * 0.085 + Math.sin(phase + 0.7) * 0.03,
  };
  let elbowR = {
    x: shoulderR.x + 0.135 + counterOpen * 0.045,
    y: shoulderR.y - 0.02 - counterOpen * 0.085 + Math.cos(phase + 0.4) * 0.03,
  };
  let wristL = {
    x: shoulderL.x - 0.245 - open * 0.065 + (Math.cos(phase * 1.15) - 1) * 0.018,
    y: shoulderL.y + wristLiftL * 0.92,
  };
  let wristR = {
    x: shoulderR.x + 0.245 + counterOpen * 0.065 + Math.cos(phase * 1.2) * 0.02,
    y: shoulderR.y + wristLiftR * 0.92,
  };

  let kneeL = {
    x: hipL.x - 0.1 - legPulse * 0.075,
    y: hipL.y + 0.22 + Math.max(0, legPulse) * 0.065,
  };
  let kneeR = {
    x: hipR.x + 0.1 - legPulse * 0.055,
    y: hipR.y + 0.21 + Math.max(0, -legPulse) * 0.055,
  };
  let ankleL = {
    x: kneeL.x - 0.11 - Math.cos(phase) * 0.035,
    y: kneeL.y + 0.23,
  };
  let ankleR = {
    x: kneeR.x + 0.12 + Math.sin(phase * 0.85) * 0.04,
    y: kneeR.y + 0.21,
  };

  if (preset === "sideReach") {
    const hit = Math.sin(phase * 2.15);
    elbowL = { x: shoulderL.x - 0.15 - Math.max(0, hit) * 0.055, y: shoulderL.y - 0.11 + hit * 0.07 };
    elbowR = { x: shoulderR.x + 0.09, y: shoulderR.y + 0.14 - hit * 0.025 };
    wristL = { x: shoulderL.x - 0.39 - Math.max(0, hit) * 0.065, y: shoulderL.y - 0.19 + hit * 0.1 };
    wristR = { x: shoulderR.x + 0.13, y: shoulderR.y + 0.31 - hit * 0.04 };
  }

  if (preset === "bounceStep") {
    const squat = (Math.sin(phase * 1.9 - 0.35) + 1) / 2;
    hipL = { x: hipL.x - 0.025 * Math.sin(phase), y: hipL.y + 0.09 * squat };
    hipR = { x: hipR.x - 0.025 * Math.sin(phase), y: hipR.y + 0.09 * squat };
    elbowL = { x: shoulderL.x - 0.145, y: shoulderL.y + 0.035 + squat * 0.08 };
    elbowR = { x: shoulderR.x + 0.145, y: shoulderR.y + 0.035 + squat * 0.08 };
    wristL = { x: shoulderL.x - 0.23, y: shoulderL.y + 0.08 + squat * 0.12 };
    wristR = { x: shoulderR.x + 0.23, y: shoulderR.y + 0.08 + squat * 0.12 };
    kneeL = { x: hipL.x - 0.14 - squat * 0.05, y: hipL.y + 0.2 + squat * 0.1 };
    kneeR = { x: hipR.x + 0.14 + squat * 0.05, y: hipR.y + 0.2 + squat * 0.1 };
    ankleL = { x: kneeL.x - 0.08, y: kneeL.y + 0.22 };
    ankleR = { x: kneeR.x + 0.08, y: kneeR.y + 0.22 };
  }

  if (preset === "crossHit") {
    const hit = smoothPulse(phase * 2.25);
    const openSnap = Math.sin(phase * 2.25) > 0 ? 1 : 0;
    elbowL = { x: shoulderL.x + 0.08 + openSnap * -0.16, y: shoulderL.y + 0.045 - hit * 0.04 };
    elbowR = { x: shoulderR.x - 0.08 + openSnap * 0.16, y: shoulderR.y + 0.045 - hit * 0.04 };
    wristL = { x: spine.x + 0.12 - openSnap * 0.36, y: spine.y - 0.12 - hit * 0.055 };
    wristR = { x: spine.x - 0.12 + openSnap * 0.36, y: spine.y - 0.12 - hit * 0.055 };
    hipL = { x: hipL.x - 0.015 * Math.sin(phase * 1.4), y: hipL.y + 0.025 * hit };
    hipR = { x: hipR.x - 0.015 * Math.sin(phase * 1.4), y: hipR.y - 0.015 * hit };
  }

  return {
    beat,
    phase,
    joints: {
      head: joint("head", neck.x + Math.sin(phase * 0.95) * 0.018, neck.y - 0.14 + bounce * 0.2, "head"),
      neck: joint("neck", neck.x, neck.y, "core"),
      shoulderL: joint("shoulderL", shoulderL.x, shoulderL.y, "arm"),
      shoulderR: joint("shoulderR", shoulderR.x, shoulderR.y, "arm"),
      elbowL: joint("elbowL", elbowL.x, elbowL.y, "arm"),
      elbowR: joint("elbowR", elbowR.x, elbowR.y, "arm"),
      wristL: joint("wristL", wristL.x, wristL.y, "wrist"),
      wristR: joint("wristR", wristR.x, wristR.y, "wrist"),
      spine: joint("spine", spine.x, spine.y, "core"),
      hipL: joint("hipL", hipL.x, hipL.y, "core"),
      hipR: joint("hipR", hipR.x, hipR.y, "core"),
      kneeL: joint("kneeL", kneeL.x, kneeL.y, "leg"),
      kneeR: joint("kneeR", kneeR.x, kneeR.y, "leg"),
      ankleL: joint("ankleL", ankleL.x, ankleL.y, "leg"),
      ankleR: joint("ankleR", ankleR.x, ankleR.y, "leg"),
    },
  };
}

export function createSkeletonParticleTargets(skeleton: AnimatedDancerSkeleton): SkeletonParticleTarget[] {
  return updateSkeletonParticleTargets([], skeleton);
}

function writeTarget(targets: SkeletonParticleTarget[], index: number, x: number, y: number, role: SkeletonRole) {
  if (targets[index]) {
    targets[index].x = x;
    targets[index].y = y;
    targets[index].role = role;
  } else {
    targets[index] = { x, y, role };
  }
}

function writeLineTargets(targets: SkeletonParticleTarget[], startIndex: number, from: Point, to: Point, count: number, role: SkeletonRole) {
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    const ease = t * t * (3 - 2 * t);
    writeTarget(targets, startIndex + index, from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease, role);
  }
  return startIndex + count;
}

function writeCircleTargets(targets: SkeletonParticleTarget[], startIndex: number, center: Point, radius: number, count: number, role: SkeletonRole) {
  for (let index = 0; index < count; index += 1) {
    const angle = (TAU * index) / count;
    writeTarget(targets, startIndex + index, center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, role);
  }
  return startIndex + count;
}

export function updateSkeletonParticleTargets(
  targets: SkeletonParticleTarget[],
  skeleton: AnimatedDancerSkeleton,
): SkeletonParticleTarget[] {
  let nextIndex = 0;

  SKELETON_BONES.forEach(([fromName, toName]) => {
    const from = skeleton.joints[fromName];
    const to = skeleton.joints[toName];
    const isArm = from.role === "arm" || to.role === "arm" || from.role === "wrist" || to.role === "wrist";
    const isLeg = from.role === "leg" || to.role === "leg";
    nextIndex = writeLineTargets(
      targets,
      nextIndex,
      from,
      to,
      isArm ? 18 : isLeg ? 16 : 14,
      to.role === "wrist" ? "wrist" : isArm ? "arm" : isLeg ? "leg" : "core",
    );
  });

  nextIndex = writeCircleTargets(targets, nextIndex, skeleton.joints.head, 0.047, 22, "head");
  nextIndex = writeCircleTargets(targets, nextIndex, skeleton.joints.wristL, 0.03 + skeleton.beat * 0.008, 18, "wrist");
  nextIndex = writeCircleTargets(targets, nextIndex, skeleton.joints.wristR, 0.03 + skeleton.beat * 0.008, 18, "wrist");
  nextIndex = writeCircleTargets(targets, nextIndex, skeleton.joints.spine, 0.04, 12, "core");
  targets.length = nextIndex;

  return targets;
}
