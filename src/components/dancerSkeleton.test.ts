import { describe, expect, it } from "vitest";
import {
  createAnimatedDancerSkeleton,
  createSkeletonParticleTargets,
  DANCE_PRESETS,
  SKELETON_BONES,
  SKELETON_JOINTS,
  updateSkeletonParticleTargets,
} from "./dancerSkeleton";

describe("animated dancer skeleton", () => {
  it("moves arms, hips, and knees across the dance loop", () => {
    const first = createAnimatedDancerSkeleton(0);
    const later = createAnimatedDancerSkeleton(0.72);

    expect(Math.abs(first.joints.wristL.x - later.joints.wristL.x)).toBeGreaterThan(0.03);
    expect(Math.abs(first.joints.wristR.y - later.joints.wristR.y)).toBeGreaterThan(0.03);
    expect(Math.abs(first.joints.hipL.x - later.joints.hipL.x)).toBeGreaterThan(0.01);
    expect(Math.abs(first.joints.kneeR.x - later.joints.kneeR.x)).toBeGreaterThan(0.02);
  });

  it("keeps the readable dance-assistance body parts explicit", () => {
    expect(SKELETON_JOINTS).toEqual(expect.arrayContaining(["shoulder", "elbow", "wrist", "hip", "knee", "ankle"]));
    expect(SKELETON_BONES.flat()).toEqual(
      expect.arrayContaining(["shoulderL", "elbowL", "wristL", "shoulderR", "elbowR", "wristR", "hipL", "kneeL", "ankleL"]),
    );
  });

  it("creates enough particle targets to make the dancer feel continuous", () => {
    const skeleton = createAnimatedDancerSkeleton(0.25);
    const targets = createSkeletonParticleTargets(skeleton);

    expect(targets.length).toBeGreaterThanOrEqual(180);
    expect(targets.filter((target) => target.role === "wrist").length).toBeGreaterThanOrEqual(24);
  });

  it("can update particle targets in place for animation frames", () => {
    const firstSkeleton = createAnimatedDancerSkeleton(0.1);
    const laterSkeleton = createAnimatedDancerSkeleton(0.8);
    const targets = createSkeletonParticleTargets(firstSkeleton);
    const firstTarget = targets[0];

    updateSkeletonParticleTargets(targets, laterSkeleton);

    expect(targets[0]).toBe(firstTarget);
    expect(targets[0].x).not.toBeCloseTo(createSkeletonParticleTargets(firstSkeleton)[0].x);
    expect(targets.filter((target) => target.role === "wrist").length).toBeGreaterThanOrEqual(24);
  });

  it("keeps skeleton coordinates finite when animation time is not ready yet", () => {
    const skeleton = createAnimatedDancerSkeleton(Infinity);
    const targets = createSkeletonParticleTargets(skeleton);

    expect(Number.isFinite(skeleton.phase)).toBe(true);
    expect(Number.isFinite(skeleton.beat)).toBe(true);
    expect(Object.values(skeleton.joints).every((joint) => Number.isFinite(joint.x) && Number.isFinite(joint.y))).toBe(true);
    expect(targets.every((target) => Number.isFinite(target.x) && Number.isFinite(target.y))).toBe(true);
  });

  it("offers multiple built-in dance loops with visibly different body emphasis", () => {
    expect(DANCE_PRESETS).toEqual(["openArms", "sideReach", "bounceStep", "crossHit"]);

    const openArms = createAnimatedDancerSkeleton(0.55, "openArms");
    const sideReach = createAnimatedDancerSkeleton(0.55, "sideReach");
    const bounceStep = createAnimatedDancerSkeleton(0.55, "bounceStep");
    const crossHit = createAnimatedDancerSkeleton(0.55, "crossHit");

    expect(Math.abs(openArms.joints.wristL.x - sideReach.joints.wristL.x)).toBeGreaterThan(0.05);
    expect(Math.abs(sideReach.joints.wristR.y - bounceStep.joints.wristR.y)).toBeGreaterThan(0.05);
    expect(Math.abs(bounceStep.joints.hipL.y - openArms.joints.hipL.y)).toBeGreaterThan(0.03);
    expect(Math.abs(crossHit.joints.wristL.x - openArms.joints.wristL.x)).toBeGreaterThan(0.12);
    expect(Math.abs(crossHit.joints.wristR.x - openArms.joints.wristR.x)).toBeGreaterThan(0.12);
  });

  it("keeps the abstract dancer proportion elegant rather than over-stretched", () => {
    const skeleton = createAnimatedDancerSkeleton(0.35, "openArms");
    const shoulderWidth = Math.abs(skeleton.joints.shoulderR.x - skeleton.joints.shoulderL.x);
    const torsoHeight = Math.abs(skeleton.joints.spine.y - skeleton.joints.neck.y);
    const leftArmReach = Math.hypot(skeleton.joints.wristL.x - skeleton.joints.shoulderL.x, skeleton.joints.wristL.y - skeleton.joints.shoulderL.y);
    const leftUpperArm = Math.hypot(skeleton.joints.elbowL.x - skeleton.joints.shoulderL.x, skeleton.joints.elbowL.y - skeleton.joints.shoulderL.y);
    const leftLowerArm = Math.hypot(skeleton.joints.wristL.x - skeleton.joints.elbowL.x, skeleton.joints.wristL.y - skeleton.joints.elbowL.y);
    const leftLegLength = Math.hypot(skeleton.joints.ankleL.x - skeleton.joints.hipL.x, skeleton.joints.ankleL.y - skeleton.joints.hipL.y);

    expect(shoulderWidth).toBeGreaterThanOrEqual(0.3);
    expect(shoulderWidth).toBeLessThanOrEqual(0.4);
    expect(torsoHeight).toBeGreaterThanOrEqual(0.28);
    expect(leftArmReach / torsoHeight).toBeLessThanOrEqual(1.28);
    expect(leftUpperArm / leftLowerArm).toBeGreaterThan(0.7);
    expect(leftUpperArm / leftLowerArm).toBeLessThan(1.35);
    expect(leftLegLength / torsoHeight).toBeLessThanOrEqual(1.65);
  });
});
