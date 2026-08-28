# Built-in Pose and Camera Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the built-in dance skeleton as a static product asset and reuse the camera session acquired during calibration without a second permission request in challenge.

**Architecture:** A generated, validated pose JSON is imported by the built-in level and is the only demonstration-pose source at runtime. Camera acquisition returns a DOM-independent shared session; `App` owns that session after calibration and passes it to challenge, which attaches the existing stream instead of calling `getUserMedia()`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, MediaPipe Tasks Vision, Playwright generation script.

**Spec:** `docs/superpowers/specs/2026-08-28-built-in-pose-and-camera-handoff-design.md`

## Global Constraints

- Built-in level runtime must never call `extractDemoPoseCache`.
- The built-in pose asset is statically imported and validated; invalid data fails tests/build instead of falling back to runtime extraction.
- `getUserMedia()` is called only by calibration; challenge never requests camera permission.
- A transferred camera session has one owner at a time and remains safe under StrictMode, late promises, skip, back, retry, and unmount.
- Existing gesture definitions, music transport, beat analysis, calibration judgement, transparent status copy, safe-area layout, and `100dvh` layers remain unchanged.
- No new runtime dependency.

---

### Task 1: Generate and Validate the Built-in Pose Asset

**Files:**
- Create: `scripts/generate-built-in-pose.mjs`
- Create: `src/levels/assets/level-1.pose.json`
- Create: `src/levels/builtInPose.ts`
- Create: `src/levels/builtInPose.test.ts`
- Modify: `package.json`
- Modify: `src/levels/builtInLevel.ts`
- Modify: `src/levels/builtInLevel.test.ts`

**Interfaces:**
- Produces: `BUILT_IN_LEVEL.poseCache: DemoPoseCache`.
- Produces: `validateBuiltInPoseCache(value: unknown, durationSec: number): DemoPoseCache`.
- Produces: `npm.cmd run generate:built-in-pose` for reproducible one-time asset generation.

- [ ] **Step 1: Write failing asset-contract tests**

```ts
it("ships a validated pose cache with the built-in level", () => {
  expect(BUILT_IN_LEVEL.poseCache.length).toBeGreaterThan(100);
  expect(BUILT_IN_LEVEL.poseCache[0].captureTimeSec).toBe(0);
  expect(BUILT_IN_LEVEL.poseCache.at(-1)!.captureTimeSec).toBeGreaterThanOrEqual(BUILT_IN_LEVEL.durationSec - 0.1);
  expect(BUILT_IN_LEVEL.poseCache.every((frame) => frame.landmarks.length === 33)).toBe(true);
});

it("rejects unordered or malformed pose data", () => {
  expect(() => validateBuiltInPoseCache([{ captureTimeSec: 1, landmarks: [] }], 13)).toThrow(/33/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- src/levels/builtInPose.test.ts src/levels/builtInLevel.test.ts`

Expected: FAIL because the validator, JSON asset, and `poseCache` field do not exist.

- [ ] **Step 3: Add the typed validator and static import**

```ts
import rawPoseCache from "./assets/level-1.pose.json";
import type { DemoPoseCache } from "../analysis/demoPoseCache";

export function validateBuiltInPoseCache(value: unknown, durationSec: number): DemoPoseCache {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Built-in pose cache is empty");
  let previous = -1;
  for (const frame of value) {
    if (typeof frame !== "object" || frame === null) throw new Error("Invalid built-in pose frame");
    const candidate = frame as { captureTimeSec?: unknown; landmarks?: unknown };
    if (typeof candidate.captureTimeSec !== "number" || candidate.captureTimeSec < previous) throw new Error("Built-in pose frames must be ordered");
    if (!Array.isArray(candidate.landmarks) || candidate.landmarks.length !== 33) throw new Error("Built-in pose frame must contain 33 landmarks");
    previous = candidate.captureTimeSec;
  }
  if (previous < durationSec - 0.1) throw new Error("Built-in pose cache does not cover the level duration");
  return value as DemoPoseCache;
}

export const LEVEL_1_POSE_CACHE = validateBuiltInPoseCache(rawPoseCache, 13);
```

- [ ] **Step 4: Add the one-time Playwright generator and create the JSON**

`scripts/generate-built-in-pose.mjs` must start an in-process Vite server, open Chromium, dynamically import `/src/analysis/demoPoseCache.ts`, call `extractDemoPoseCache("/levels/level-1.mp4", 13)`, validate at least 100 ordered 33-landmark frames, and write formatted JSON to `src/levels/assets/level-1.pose.json`. It must close browser and server in `finally`.

Add:

```json
"generate:built-in-pose": "node scripts/generate-built-in-pose.mjs"
```

Run: `npm.cmd run generate:built-in-pose`

Expected: the committed JSON is generated once; subsequent application visits do not execute the generator.

- [ ] **Step 5: Run asset tests and build**

Run: `npm.cmd test -- src/levels/builtInPose.test.ts src/levels/builtInLevel.test.ts`

Run: `npm.cmd run build`

Expected: PASS; JSON is included in the bundle and has no runtime MediaPipe dependency.

- [ ] **Step 6: Commit**

```powershell
git add package.json scripts/generate-built-in-pose.mjs src/levels/assets/level-1.pose.json src/levels/builtInPose.ts src/levels/builtInPose.test.ts src/levels/builtInLevel.ts src/levels/builtInLevel.test.ts
git commit -m "feat: ship built-in dance pose asset"
```

---

### Task 2: Decouple Camera Session Ownership from Video Elements

**Files:**
- Modify: `src/pose/camera.ts`
- Modify: `src/pose/camera.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SharedCameraSession {
  stream: MediaStream;
  attach(video: HTMLVideoElement): Promise<void>;
  detach(video: HTMLVideoElement): void;
  stop(): void;
  isLive(): boolean;
}
```

- `startCamera(video, options): Promise<SharedCameraSession>` remains the only `getUserMedia()` entry point.

- [ ] **Step 1: Write failing session-transfer tests**

```ts
it("moves one stream between video elements without stopping tracks", async () => {
  const session = await startCamera(calibrationVideo, { mediaDevices });
  session.detach(calibrationVideo);
  await session.attach(challengeVideo);
  expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  expect(track.stop).not.toHaveBeenCalled();
  expect(calibrationVideo.srcObject).toBeNull();
  expect(challengeVideo.srcObject).toBe(stream);
});

it("stops tracks only when the shared session is stopped", async () => {
  const session = await startCamera(calibrationVideo, { mediaDevices });
  session.stop();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(session.isLive()).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- src/pose/camera.test.ts`

Expected: FAIL because detach/attach/isLive do not exist and stop is bound to the first video.

- [ ] **Step 3: Implement shared attachment state**

Keep a `Set<HTMLVideoElement>` of attached elements. `attach()` sets muted, playsInline, `srcObject`, and awaits `play()`. `detach()` pauses and clears only that element. `stop()` detaches every element and stops tracks once. `isLive()` returns true when at least one video track has `readyState === "live"`.

- [ ] **Step 4: Run camera tests**

Run: `npm.cmd test -- src/pose/camera.test.ts`

Expected: PASS, including existing permission/error cleanup tests.

- [ ] **Step 5: Commit**

```powershell
git add src/pose/camera.ts src/pose/camera.test.ts
git commit -m "refactor: make camera sessions transferable"
```

---

### Task 3: Remove Runtime Demonstration Extraction from Analysis

**Files:**
- Modify: `src/components/AnalysisScreen.tsx`
- Modify: `src/components/AnalysisScreen.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `level.poseCache` from Task 1.
- Preserves: `AnalysisResult { chart: BeatPoint[]; poseCache: DemoPoseCache }`.
- App skip fallback always sets `demoPoseCache` to `BUILT_IN_LEVEL.poseCache`.

- [ ] **Step 1: Write failing no-extraction tests**

```ts
it("uses the built-in pose asset without extracting the video", async () => {
  render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={onConfirm} onSkip={vi.fn()} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "分析卡点" }));
  await screen.findByRole("group", { name: "卡点时间轴" });
  expect(extractDemoPoseCache).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "进入下一步" }));
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ poseCache: BUILT_IN_LEVEL.poseCache }));
});
```

Add an App skip-flow assertion that challenge receives `BUILT_IN_LEVEL.poseCache.length` frames instead of zero.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- src/components/AnalysisScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because analysis still invokes `extractDemoPoseCache` and skip stores an empty cache.

- [ ] **Step 3: Replace extraction state with static cache**

Remove `poseCache` loading/error/retry state, the extraction callback, and runtime extraction copy. Use `level.poseCache` in action inference, `onConfirm`, and completed-analysis `onSkip`. In `skipAnalysis`, always use `result?.poseCache.length ? result.poseCache : BUILT_IN_LEVEL.poseCache`.

- [ ] **Step 4: Run focused tests and build**

Run: `npm.cmd test -- src/components/AnalysisScreen.test.tsx src/app/App.test.tsx`

Run: `npm.cmd run build`

Expected: PASS; no analysis screen path imports or calls `extractDemoPoseCache`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/AnalysisScreen.tsx src/components/AnalysisScreen.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "refactor: use built-in demonstration poses"
```

---

### Task 4: Transfer the Calibration Camera Session into App

**Files:**
- Modify: `src/components/CalibrationScreen.tsx`
- Modify: `src/components/CalibrationScreen.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `SharedCameraSession` from Task 2.
- Produces:

```ts
onComplete?(profile: CalibrationProfile, camera: SharedCameraSession): void;
onSkip(camera: SharedCameraSession | null): void;
cameraSession?: SharedCameraSession | null;
```

- App owns `cameraSession: SharedCameraSession | null` after callback return.

- [ ] **Step 1: Write failing ownership-transfer tests**

Add Calibration tests proving completed and skipped calibration pass the acquired session and do not call `session.stop()`. Add a rerender test proving an App-owned session passed back into calibration attaches without calling `cameraStarter` again. Add an App test proving the same session reaches challenge.

```ts
expect(onSkip).toHaveBeenCalledWith(session);
expect(session.stop).not.toHaveBeenCalled();
expect(cameraStarter).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- src/components/CalibrationScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because callbacks do not pass a session and App does not own one.

- [ ] **Step 3: Separate transfer from disposal**

Calibration keeps the current session in an owner-tagged ref. A transfer function detaches the calibration video, clears the local owner without stopping tracks, and invokes the callback. Ordinary unmount stops only sessions that were not transferred. If `cameraSession` is supplied, attach it instead of calling `cameraStarter`.

App stores the transferred session, stops a replaced session, and stops the current session on App unmount. Back navigation retains the same session.

- [ ] **Step 4: Add late-promise and StrictMode cases**

Verify an old camera promise resolving after a transfer/restart stops only its own session. Verify pending permission followed by skip passes `null` and late resolution is stopped. Verify no callback manufactures a calibration profile.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- src/components/CalibrationScreen.test.tsx src/app/App.test.tsx src/pose/camera.test.ts`

Expected: PASS with no duplicate `cameraStarter` call.

- [ ] **Step 6: Commit**

```powershell
git add src/components/CalibrationScreen.tsx src/components/CalibrationScreen.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: transfer calibration camera to challenge"
```

---

### Task 5: Make Challenge Consume Only Built-in Poses and the Existing Camera

**Files:**
- Modify: `src/components/ChallengeScreen.tsx`
- Modify: `src/components/ChallengeScreen.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `level.poseCache` and `cameraSession: SharedCameraSession | null`.
- Removes: `initialPoseCache`, `poseExtractor`, and `cameraStarter` props from `ChallengeScreen`.
- Preserves: `providerFactory`, `poseLoop`, gesture control, playback fallback, and `onBack`.

- [ ] **Step 1: Write failing challenge tests**

```ts
it("shows the built-in skeleton immediately without pose extraction", () => {
  renderChallenge({ cameraSession: session });
  expect(screen.getByLabelText("示范骨架运动")).toBeVisible();
  expect(screen.queryByText(/正在提取示范骨架/)).not.toBeInTheDocument();
});

it("attaches the calibration camera without requesting permission", async () => {
  renderChallenge({ cameraSession: session });
  fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
  await waitFor(() => expect(session.attach).toHaveBeenCalledOnce());
  expect(startCamera).not.toHaveBeenCalled();
});

it("does not request camera when calibration supplied no session", () => {
  renderChallenge({ cameraSession: null });
  expect(screen.getByRole("button", { name: "返回校准开启摄像头" })).toBeVisible();
  expect(startCamera).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because Challenge still extracts poses and starts a new camera.

- [ ] **Step 3: Remove runtime extraction and camera acquisition**

Initialize pose rendering directly from `level.poseCache`. Delete extraction effects, retry state, and loading/error copy. During start, synchronously play the media clock, attach the supplied session to the challenge video, then start provider/pose loop. On back/unmount, cancel loop, stop provider, pause media, and detach the challenge video without stopping the App-owned tracks.

When `cameraSession` is null or not live, keep instructions visible and replace the primary start action with `返回校准开启摄像头`, invoking `onBack`.

- [ ] **Step 4: Run focused, full, and build verification**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx src/app/App.test.tsx`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: all tests pass; grep confirms runtime screens no longer import `extractDemoPoseCache`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ChallengeScreen.tsx src/components/ChallengeScreen.test.tsx src/app/App.tsx src/app/App.test.tsx src/styles.css
git commit -m "fix: reuse calibrated camera in challenge"
```

---

### Task 6: Browser Verification and Final Regression Gate

**Files:**
- Modify only if browser verification reveals a tested product defect.

**Interfaces:**
- Consumes the complete flow from Tasks 1–5.

- [ ] **Step 1: Run fresh automated verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Run: `git diff --check 76d132c..HEAD`

Expected: zero failures and no whitespace errors.

- [ ] **Step 2: Open the product at port 5175**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5175`

- [ ] **Step 3: Verify the normal flow in the in-app browser**

1. Analysis screen shows no skeleton extraction/loading state.
2. Calibration is the first and only camera permission request.
3. Complete or skip calibration after the camera opens.
4. Challenge instruction card already shows the skeleton.
5. Starting challenge uses the existing live camera and does not request permission again.
6. Playback, pause, restart gesture/fallback controls still work.
7. Camera and skeleton remain full-height on desktop and 390×844 viewport.

- [ ] **Step 4: Verify the no-camera path**

Enter challenge before calibration has a live session. Confirm it shows `返回校准开启摄像头` and never calls or prompts `getUserMedia()`.

- [ ] **Step 5: Commit any browser-found fix after RED/GREEN tests**

If no fix is required, do not create an empty commit.

