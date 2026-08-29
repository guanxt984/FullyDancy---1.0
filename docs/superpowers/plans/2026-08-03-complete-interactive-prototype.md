# FullyDancy Complete Interactive Prototype Implementation Plan

> 2026-08-17 更新说明：本文件保留为实施计划记录。当前原型已进一步调整为：Canvas 荧光粒子首页、内置单关卡、单时间轴卡点分析、示范视频骨架缓存、身体校准和极简挑战页壳子。最新产品设计以 `docs/superpowers/specs/2026-08-03-complete-interactive-prototype-design.md` 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, clickable FullyDancy prototype that moves from the game introduction through built-in level selection, local beat setup, automatic body calibration, and a playable dance challenge.

**Architecture:** A small React screen state in `App` owns the linear flow and session-only data. Focused screen components render each stage, pure functions handle energy-peak analysis, chart editing, geometry, calibration, and action checks, and one reusable camera hook owns MediaPipe/browser resources. The design reuses the established immersive cold-black stage with fluorescent yellow-green HUD styling.

**Tech Stack:** React 18, TypeScript 5, Vite 5, native CSS, Web Audio API, MediaPipe Tasks Vision, HTML video, Vitest, Testing Library.

## Global Constraints

- Formal flow is `home → level-select → analysis → calibration → countdown → challenge`.
- MVP has exactly one playable level: `BUILT_IN_LEVEL` at `/levels/level-1.mp4`.
- Show `上传自己的舞蹈` only as a disabled `即将开放` choice; never render a file input or add upload logic.
- Candidate beats come from local audio energy analysis, not a preset per-level chart.
- Beat actions are exactly `rhythm`, `open`, or `squat`; removing a beat disables it, and one beat never has two actions.
- `open` succeeds when either reliable arm is straight at the beat window; an arm already straight and held at the beat counts.
- Camera permission is requested only when calibration begins.
- Calibration is automatic: the user never types measurements or clicks a button to record a pose.
- Keep all video, decoded audio, pose frames, measurements, and session state local to the browser.
- No router, state library, backend, database, account, upload endpoint, generic level system, Worker, strict BPM engine, or complex time-series model.
- Use the reference visual language: cold-black full-screen media stage, near-white text, fluorescent yellow-green primary accent, edge HUD, large distant-readable controls, short state motion.
- Use CSS OKLCH variables; support mobile safe areas, visible focus, `prefers-reduced-motion`, and 44px minimum touch targets.
- Write a failing behavior test before the minimum implementation for every change.
- After every task, run tests/build, start `127.0.0.1:5174`, and pause for user inspection before the next task.

---

## File Structure

- `src/app/prototypeFlow.ts`: screen names and session types.
- `src/app/App.tsx`: linear screen orchestration only.
- `src/styles.css`: shared immersive stage tokens, layouts, controls, and responsive states.
- `src/components/HomeScreen.tsx`: game introduction and start action.
- `src/components/LevelSelectScreen.tsx`: one playable level plus disabled upload roadmap choice.
- `src/components/AnalysisScreen.tsx`: video, loading/error state, beat editor, and confirmation.
- `src/beat-analysis/energyPeaks.ts`: small dependency-free PCM energy peak detector.
- `src/chart/chart.ts`: immutable chart creation and updates.
- `src/media/loadBuiltInLevelAudio.ts`: fetch and decode the same-origin built-in video.
- `src/pose/geometry.ts`: reusable angle, distance, visibility, and body-scale helpers.
- `src/pose/drawSkeleton.ts`: shared canvas skeleton renderer.
- `src/pose/usePoseCamera.ts`: one browser camera/MediaPipe lifecycle hook.
- `src/calibration/calibration.ts`: automatic three-step sampling and profile creation.
- `src/components/CalibrationScreen.tsx`: full-screen camera calibration HUD.
- `src/components/ChallengeScreen.tsx`: demonstration/camera stage and beat feedback.

---

### Task 1: Immersive Home and Level Selection

**Files:**
- Create: `src/app/prototypeFlow.ts`
- Create: `src/components/HomeScreen.tsx`
- Test: `src/components/HomeScreen.test.tsx`
- Create: `src/components/LevelSelectScreen.tsx`
- Test: `src/components/LevelSelectScreen.test.tsx`
- Create: `src/styles.css`
- Modify: `src/main.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Delete: `src/app/App.technicalSlice.test.tsx`

**Interfaces:**
- Consumes: `BuiltInLevel`, `BUILT_IN_LEVEL` from `src/levels/builtInLevel.ts`.
- Produces: `PrototypeScreen`.
- Produces: `HomeScreen({ onStart }): JSX.Element`.
- Produces: `LevelSelectScreen({ level, onSelect, onBack }): JSX.Element`.

- [ ] **Step 1: Write failing flow and component tests**

```tsx
it("moves from the game introduction to level selection", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "把动作跳开" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "开始游戏" }));
  expect(screen.getByRole("heading", { name: "选择你的挑战" })).toBeInTheDocument();
});

it("offers one playable built-in level and a disabled upload roadmap choice", () => {
  render(<LevelSelectScreen level={BUILT_IN_LEVEL} onSelect={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByRole("button", { name: "选择 8月3日舞蹈挑战" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "上传自己的舞蹈 即将开放" })).toBeDisabled();
  expect(document.querySelector('input[type="file"]')).toBeNull();
});

it("keeps the camera technical slice out of the formal home flow", () => {
  render(<App />);
  expect(screen.queryByRole("heading", { name: "摄像头与姿态性能验证" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/components/HomeScreen.test.tsx src/components/LevelSelectScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because the new screen components do not exist and `App` still renders the unstyled level/technical stack.

- [ ] **Step 3: Add the screen type and minimal components**

```ts
export type PrototypeScreen =
  | "home"
  | "level-select"
  | "analysis"
  | "calibration"
  | "countdown"
  | "challenge";
```

`HomeScreen` renders a muted looping background video using `/levels/level-1.mp4`, the heading `把动作跳开`, short copy `跟着音乐，把每一个动作做到更舒展。`, and `开始游戏`.

`LevelSelectScreen` renders the built-in level as the only enabled choice and a real disabled button whose accessible name is `上传自己的舞蹈 即将开放`. Do not hide a functional input beneath it.

- [ ] **Step 4: Connect the first transitions in App**

Use `useState<PrototypeScreen>("home")`. `开始游戏` switches to `level-select`. Selecting the built-in level switches to `analysis` and temporarily renders the existing `BuiltInLevelStep`; Task 2 replaces that temporary analysis surface. Remove `TechnicalSlice` from `App` but keep its component and focused tests for reuse.

- [ ] **Step 5: Build the reference visual system in native CSS**

Import `../styles.css` from `src/main.tsx`. Define at least:

```css
:root {
  --stage-bg: oklch(0.10 0 0);
  --stage-surface: oklch(0.16 0 0);
  --stage-text: oklch(0.96 0.01 110);
  --stage-muted: oklch(0.76 0.01 110);
  --accent: oklch(0.91 0.16 115);
  --warning: oklch(0.84 0.12 75);
  --line: oklch(1 0 0 / 0.16);
}
```

Use a `100dvh` stage, real video media background, dark scrims, edge header/footer HUD, a single large pill primary button, maximum 16px panel radius, visible focus outline, mobile layout, and reduced-motion fallback. Avoid decorative grids, gradient text, nested cards, and wide decorative shadows.

- [ ] **Step 6: Run focused tests, full suite, and build**

Run: `npm.cmd test -- src/components/HomeScreen.test.tsx src/components/LevelSelectScreen.test.tsx src/app/App.test.tsx`

Then: `npm.cmd test`

Then: `npm.cmd run build`

Expected: all commands exit 0; the built-in video remains at `dist/levels/level-1.mp4` with size `12063040` bytes.

- [ ] **Step 7: Commit and pause for inspection**

```powershell
git add src/app src/components src/main.tsx src/styles.css
git commit -m "feat: add immersive prototype entry flow"
```

Start `http://127.0.0.1:5174/` and pause. The user checks the home background, distant readability, start transition, built-in choice, disabled upload choice, desktop/mobile layout, and resemblance to the reference page.

---

### Task 2: Local Beat Analysis and Action Setup

**Files:**
- Modify: `src/media/decodeAudio.ts`
- Modify: `src/media/decodeAudio.test.ts`
- Create: `src/media/loadBuiltInLevelAudio.ts`
- Test: `src/media/loadBuiltInLevelAudio.test.ts`
- Create: `src/beat-analysis/energyPeaks.ts`
- Test: `src/beat-analysis/energyPeaks.test.ts`
- Create: `src/chart/chart.ts`
- Test: `src/chart/chart.test.ts`
- Modify: `src/components/BuiltInLevelStep.tsx`
- Modify: `src/components/BuiltInLevelStep.test.tsx`
- Create: `src/components/AnalysisScreen.tsx`
- Test: `src/components/AnalysisScreen.test.tsx`
- Modify: `src/app/prototypeFlow.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `BuiltInLevel`, `BUILT_IN_LEVEL`, `PcmAudio`, `BeatPoint`, `ActionRequirement`.
- Produces: `loadBuiltInLevelAudio(level, context, fetcher?): Promise<PcmAudio>`.
- Produces: `detectEnergyPeaks(audio, config?): BeatPoint[]`.
- Produces: `updateBeat(chart, beatId, patch): BeatPoint[]`.
- Produces: `AnalysisScreen({ level, onConfirm, onBack }): JSX.Element`.
- Extends the App session with `chart: BeatPoint[]`.

- [ ] **Step 1: Write failing loader and real-analysis tests**

```ts
it("fetches and decodes the configured built-in video", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Blob([new Uint8Array([1])] )));
  await loadBuiltInLevelAudio(BUILT_IN_LEVEL, fakeContext(), fetcher);
  expect(fetcher).toHaveBeenCalledWith("/levels/level-1.mp4");
});

it("keeps separated local energy peaks instead of using a preset chart", () => {
  const audio = impulsePcm([1, 2, 2.1, 4]);
  expect(detectEnergyPeaks(audio).map((beat) => beat.timeSec)).toEqual([1, 2, 4]);
});
```

- [ ] **Step 2: Run loader/analyzer tests and verify RED**

Run: `npm.cmd test -- src/media/loadBuiltInLevelAudio.test.ts src/beat-analysis/energyPeaks.test.ts`

Expected: FAIL because the loader and analyzer do not exist.

- [ ] **Step 3: Simplify decoding for the fixed same-origin Blob**

Change `decodeMonoPcm` to accept `Blob`, call `arrayBuffer()` and `decodeAudioData()`, and average channels into one `Float32Array`. Remove the upload-only object-URL/capture-stream preflight and specialized upload errors. The public loader wraps every fetch/decode failure as `关卡加载失败，请重试`.

```ts
export async function loadBuiltInLevelAudio(
  level: BuiltInLevel,
  context: Pick<BaseAudioContext, "decodeAudioData">,
  fetcher: typeof fetch = fetch,
): Promise<PcmAudio> {
  try {
    const response = await fetcher(level.videoUrl);
    if (!response.ok) throw new Error("load failed");
    return await decodeMonoPcm(await response.blob(), context);
  } catch {
    throw new Error("关卡加载失败，请重试");
  }
}
```

- [ ] **Step 4: Implement the small dependency-free peak detector**

Split PCM into 80ms windows, calculate RMS energy, keep local maxima above `medianEnergy * 1.35`, enforce `0.45s` minimum spacing by retaining the stronger neighbor, discard points within the first/last `0.25s`, sort by time, and cap at 12 candidates. Return `BeatPoint` entries with stable ids `beat-1`, `beat-2`, default `enabled: true`, and default `action: "rhythm"`. If no peak survives, return an empty list rather than inventing beats.

- [ ] **Step 5: Write failing immutable chart and analysis-screen tests**

```tsx
it("allows only one action on each candidate beat", () => {
  const opened = updateBeat(chart, "beat-2", { action: "open" });
  expect(updateBeat(opened, "beat-2", { action: "squat" })[1].action).toBe("squat");
});

it("confirms the user's edited chart", async () => {
  const onConfirm = vi.fn();
  render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={onConfirm} onBack={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "分析卡点" }));
  await screen.findByText("卡点设置");
  await userEvent.click(screen.getByRole("radio", { name: "打开" }));
  await userEvent.click(screen.getByRole("button", { name: "确认卡点" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
```

- [ ] **Step 6: Implement the analysis stage and App transition**

`AnalysisScreen` owns `idle | loading | editing | error`, creates/closes one `AudioContext`, loads and detects candidates, and renders the video with a compact timeline/list. Each enabled beat exposes `只卡节奏`, `打开`, `蹲低`, and `删除`. Confirmation is disabled for an empty chart. `App` stores the confirmed chart and moves to `calibration`.

- [ ] **Step 7: Verify and commit**

Run: `npm.cmd test -- src/media src/beat-analysis src/chart src/components/AnalysisScreen.test.tsx src/app/App.test.tsx`

Then: `npm.cmd test`

Then: `npm.cmd run build`

Expected: all commands exit 0 with no upload input or preset beat chart.

```powershell
git add src/media src/beat-analysis src/chart src/components src/app src/styles.css
git commit -m "feat: analyze and edit built-in level beats"
```

Start the page and pause. The user checks playback, analysis feedback, candidate density, action switching, deletion, confirmation, error copy, and visual consistency.

---

### Task 3: Automatic Three-Step Body Calibration

**Files:**
- Create: `src/pose/geometry.ts`
- Test: `src/pose/geometry.test.ts`
- Create: `src/pose/drawSkeleton.ts`
- Test: `src/pose/drawSkeleton.test.ts`
- Create: `src/pose/usePoseCamera.ts`
- Test: `src/pose/usePoseCamera.test.tsx`
- Create: `src/calibration/calibration.ts`
- Test: `src/calibration/calibration.test.ts`
- Create: `src/components/CalibrationScreen.tsx`
- Test: `src/components/CalibrationScreen.test.tsx`
- Modify: `src/components/TechnicalSlice.tsx`
- Modify: `src/components/TechnicalSlice.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `PoseFrame`, `PoseLandmark`, `MediaPipePoseProvider`, `startCamera`, `runPoseLoop`.
- Produces: `jointAngleDegrees`, `pointDistance`, `bodyScale`, `hasFullBody`.
- Produces: `UsePoseCameraResult` with `videoRef`, `canvasRef`, `status`, `start`, and `stop`.
- Produces: `CalibrationSession`, `CalibrationProfile`, `createCalibrationSession`, `addCalibrationFrame`.
- Produces: `CalibrationScreen({ onComplete, onBack }): JSX.Element`.

- [ ] **Step 1: Write failing geometry and calibration tests**

```ts
it("measures a straight arm as 180 degrees", () => {
  expect(jointAngleDegrees(point(0), point(1), point(2))).toBeCloseTo(180);
});

it("advances automatically through valid standing, arms, and squat samples", () => {
  let session = createCalibrationSession();
  session = feed(session, standingFrames(12));
  expect(session.step).toBe("arms-open");
  session = feed(session, armsOpenFrames(12));
  expect(session.step).toBe("squat");
  session = feed(session, squatFrames(12));
  expect(session.step).toBe("complete");
  expect(session.profile).not.toBeNull();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- src/pose/geometry.test.ts src/calibration/calibration.test.ts`

Expected: FAIL because geometry and calibration modules do not exist.

- [ ] **Step 3: Implement minimal pure calibration**

Require the full-body landmarks `0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28` at visibility `>= 0.6`. Use 12 valid samples per step and reset only the current step's samples after an invalid frame.

- Standing accepts a full visible body and records median shoulder width, hip height, and body scale.
- Arms-open accepts when both elbow angles are `>= 150°` and records median left/right shoulder-to-wrist reach.
- Squat accepts when both knee angles are `<= 110°` and records median knee angle and hip height.

No text fields or manual pose-confirm button may exist.

- [ ] **Step 4: Extract one reusable pose camera lifecycle**

Move skeleton drawing out of `TechnicalSlice` into `drawSkeleton.ts`. Implement `usePoseCamera(onFrame)` by reusing the existing `startCamera`, `MediaPipePoseProvider`, and `runPoseLoop` cleanup sequence. Adapt `TechnicalSlice` to consume the shared hook so there is still only one browser lifecycle implementation.

- [ ] **Step 5: Write failing automatic-screen behavior tests**

```tsx
it("asks for camera access only after the calibration screen starts", async () => {
  render(<App />);
  expect(openCamera).not.toHaveBeenCalled();
  await reachCalibration();
  expect(openCamera).toHaveBeenCalledOnce();
});

it("advances without a manual record button", () => {
  render(<CalibrationScreen onComplete={vi.fn()} onBack={vi.fn()} poseSource={poseSource} />);
  expect(screen.getByText("自然站立")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "完成当前姿势" })).not.toBeInTheDocument();
  emitFrames(standingFrames(12));
  expect(screen.getByText("双臂打开" )).toBeInTheDocument();
});
```

- [ ] **Step 6: Implement CalibrationScreen and countdown**

Render the mirrored camera and canvas as the full stage. Display `校准 1/3`, `2/3`, `3/3`, one large instruction, short cue, and a progress indicator. Start automatically on mount and release resources on exit. When the profile completes, show `校准完成` and invoke `onComplete(profile)`; `App` renders a minimal `3 → 2 → 1` countdown and switches to `challenge`.

- [ ] **Step 7: Verify and commit**

Run: `npm.cmd test -- src/pose src/calibration src/components/CalibrationScreen.test.tsx src/components/TechnicalSlice.test.tsx src/app/App.test.tsx`

Then: `npm.cmd test`

Then: `npm.cmd run build`

Expected: all commands exit 0; permission is not requested before calibration; unmount cleanup tests remain green.

```powershell
git add src/pose src/calibration src/components src/app src/styles.css
git commit -m "feat: add automatic body calibration flow"
```

Start the page and pause. The user grants camera permission and verifies skeleton alignment, automatic step progression, distant readability, and countdown transition.

---

### Task 4: Playable Demonstration and Camera Challenge

**Files:**
- Create: `src/challenge/judgement.ts`
- Test: `src/challenge/judgement.test.ts`
- Create: `src/components/ChallengeScreen.tsx`
- Test: `src/components/ChallengeScreen.test.tsx`
- Modify: `src/app/prototypeFlow.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `BuiltInLevel`, `BeatPoint[]`, `CalibrationProfile`, live `PoseFrame`.
- Produces: `judgeActionAtBeat(action, frame, profile): "hit" | "miss" | "rhythm"`.
- Produces: `ChallengeScreen({ level, chart, profile, onExit }): JSX.Element`.

- [ ] **Step 1: Write failing action judgement tests**

```ts
it("hits open when either arm is straight at the beat", () => {
  const frame = poseWithElbows({ left: 165, right: 120 });
  expect(judgeActionAtBeat("open", frame, profile)).toBe("hit");
});

it("accepts a held straight arm without requiring motion", () => {
  const heldFrame = poseWithElbows({ left: 170, right: 90 });
  expect(judgeActionAtBeat("open", heldFrame, profile)).toBe("hit");
});

it("hits squat when both knees are low enough", () => {
  expect(judgeActionAtBeat("squat", poseWithKnees(100, 105), profile)).toBe("hit");
});
```

- [ ] **Step 2: Run judgement tests and verify RED**

Run: `npm.cmd test -- src/challenge/judgement.test.ts`

Expected: FAIL because the challenge judgement module does not exist.

- [ ] **Step 3: Implement the minimum beat-window judgement**

Use landmark visibility `>= 0.6`. `open` returns hit when the left or right shoulder-elbow-wrist angle is `>= 160°`; no movement prerequisite exists. `squat` returns hit when both hip-knee-ankle angles are `<= 110°`. `rhythm` returns the separate `rhythm` value because this prototype only displays that beat.

- [ ] **Step 4: Write failing challenge-screen tests**

```tsx
it("renders the demonstration and mirrored local camera together", () => {
  render(<ChallengeScreen level={BUILT_IN_LEVEL} chart={chart} profile={profile} onExit={vi.fn()} />);
  expect(screen.getByLabelText("舞蹈示范")).toHaveAttribute("src", "/levels/level-1.mp4");
  expect(screen.getByLabelText("我的动作")).toBeInTheDocument();
});

it("shows short feedback when a marked beat is crossed", () => {
  renderChallengeAtTime(2.0, openChart, straightArmFrame);
  expect(screen.getByText("打开了")).toBeInTheDocument();
});
```

- [ ] **Step 5: Implement the responsive two-stage challenge**

Render the demonstration video and mirrored camera in a wide-screen two-column composition and a narrow-screen vertical composition. On play, start at zero and monitor `timeupdate`; for each enabled chart point, judge once inside `±0.18s`. Display `打开`, `蹲低`, or a beat pulse before the point; show `打开了`, `蹲到了`, or `再来一次` briefly after judgement. Do not add score, Combo, ranking, recording, or gesture controls.

- [ ] **Step 6: Connect App and resource cleanup**

Pass the confirmed chart and calibration profile from `App`. Starting the challenge begins the video and pose session; exiting stops the video, camera tracks, pose loop, and provider. A simple `返回关卡` action returns to `level-select` and clears the current calibration profile.

- [ ] **Step 7: Verify the complete prototype and commit**

Run: `npm.cmd test -- src/challenge src/components/ChallengeScreen.test.tsx src/app/App.test.tsx`

Then: `npm.cmd test`

Then: `npm.cmd run build`

Then verify `dist/levels/level-1.mp4` is exactly `12063040` bytes.

Expected: all commands exit 0 and the formal flow contains no upload input or technical metrics page.

```powershell
git add src/challenge src/components src/app src/styles.css
git commit -m "feat: add playable dance challenge prototype"
```

Start the page and pause for end-to-end inspection: home, level selection, beat setup, camera permission timing, three-step calibration, countdown, demonstration/camera layout, open/squat feedback, mobile layout, and resource shutdown.
