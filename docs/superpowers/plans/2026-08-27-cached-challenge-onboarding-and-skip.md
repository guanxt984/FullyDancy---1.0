# Cached Challenge Onboarding And Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the demonstration pose cache across the prototype flow, teach the challenge controls before camera activation, and add a consistent skip action to every pre-challenge page.

**Architecture:** `App` remains the single in-memory session owner for the confirmed chart and `DemoPoseCache`. `AnalysisScreen` emits both values, `ChallengeScreen` consumes the cache and only falls back to extraction when it is empty, and a shared `SkipAction` provides one consistent test-navigation affordance. Challenge onboarding gates the existing user-initiated camera/media startup without adding persistent storage.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, Testing Library, MediaPipe Tasks Vision, CSS with existing OKLCH theme tokens.

**Spec:** `docs/superpowers/specs/2026-08-27-cached-challenge-onboarding-and-skip-design.md`

## Global Constraints

- Keep video frames, pose landmarks, calibration data, and the demonstration pose cache local to the current browser session.
- Do not add IndexedDB, localStorage, backend APIs, accounts, or new dependencies.
- Do not request camera access or play media until the user presses `开始舞蹈` on the challenge instruction card.
- Show exactly one `跳过` action on home, level selection, analysis, and calibration; show none on challenge.
- Analysis skip preserves a valid current chart/cache, otherwise uses the built-in fallback chart and an empty cache.
- Calibration skip enters challenge without fabricating a `CalibrationProfile`.
- Challenge receives an existing pose cache without re-extracting it; an empty cache may trigger exactly one fallback extraction.
- The active challenge HUD keeps only camera/gesture status, playback fallbacks, and back navigation.
- Floating challenge text uses the existing theme color and has no text background.
- All behavior changes follow red-green-refactor and each task ends with focused tests plus a commit.

---

## File Structure

- Create `src/components/SkipAction.tsx`: shared, presentation-only skip button.
- Create `src/components/SkipAction.test.tsx`: shared action behavior and accessible-name contract.
- Create `src/levels/defaultChart.ts`: deterministic fallback chart for skipping analysis.
- Create `src/levels/defaultChart.test.ts`: validates enabled, ordered, in-range fallback beats.
- Modify `src/components/HomeScreen.tsx`: render `SkipAction` and expose `onSkip`.
- Modify `src/components/LevelSelectScreen.tsx`: render `SkipAction` and expose `onSkip`.
- Modify `src/components/AnalysisScreen.tsx`: emit `{ chart, poseCache }` and expose `onSkip`.
- Modify `src/components/CalibrationScreen.tsx`: render `SkipAction` and expose `onSkip`.
- Modify `src/components/ChallengeScreen.tsx`: consume initial cache, gate startup behind onboarding, simplify active HUD, and retain one-shot fallback extraction.
- Modify `src/app/App.tsx`: own session cache and route normal/skip transitions.
- Modify colocated component tests and `src/app/App.test.tsx`: verify interfaces and end-to-end state flow.
- Modify `src/styles.css`: shared skip position, onboarding card, and simplified active challenge HUD.

---

### Task 1: Shared Skip Action And Built-In Fallback Chart

**Files:**
- Create: `src/components/SkipAction.tsx`
- Create: `src/components/SkipAction.test.tsx`
- Create: `src/levels/defaultChart.ts`
- Create: `src/levels/defaultChart.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `SkipAction(props: { onSkip(): void }): JSX.Element`
- Produces: `DEFAULT_BUILT_IN_CHART: BeatPoint[]`
- Consumes: `BeatPoint` from `src/domain/types.ts` and `BUILT_IN_LEVEL.durationSec`.

- [ ] **Step 1: Write failing tests for the shared action and fallback chart**

```tsx
// src/components/SkipAction.test.tsx
it("calls the supplied transition from one consistently named button", () => {
  const onSkip = vi.fn();
  render(<SkipAction onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "跳过" }));
  expect(onSkip).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("button", { name: "跳过" })).toHaveLength(1);
});

// src/levels/defaultChart.test.ts
it("provides ordered enabled beats inside the built-in level", () => {
  expect(DEFAULT_BUILT_IN_CHART.length).toBeGreaterThan(0);
  expect(DEFAULT_BUILT_IN_CHART.every((beat) => beat.enabled && beat.timeSec >= 0 && beat.timeSec <= BUILT_IN_LEVEL.durationSec)).toBe(true);
  expect(DEFAULT_BUILT_IN_CHART.map((beat) => beat.timeSec)).toEqual(
    [...DEFAULT_BUILT_IN_CHART].map((beat) => beat.timeSec).sort((a, b) => a - b),
  );
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/components/SkipAction.test.tsx src/levels/defaultChart.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the minimal shared component and deterministic chart**

```tsx
// src/components/SkipAction.tsx
export function SkipAction({ onSkip }: { onSkip(): void }) {
  return <button className="skip-action" type="button" onClick={onSkip}>跳过</button>;
}
```

```ts
// src/levels/defaultChart.ts
import type { BeatPoint } from "../domain/types";

const times = [0.68, 1.61, 2.2, 3.18, 4.46, 4.94, 5.7, 6.65, 8.49, 9.31, 10.74, 11.72];

export const DEFAULT_BUILT_IN_CHART: BeatPoint[] = times.map((timeSec, index) => ({
  id: `fallback-${index + 1}`,
  beatIndex: index + 1,
  timeSec,
  salience: 1,
  enabled: true,
  action: "rhythm",
  actions: ["rhythm"],
}));
```

Add `.skip-action` as `position: fixed` at `right: var(--safe-x)` and `bottom: var(--safe-y)`, with a 44px minimum hit target, theme-color text/border, transparent background, visible hover and `:focus-visible` states, and the existing semantic z-index tier used by page controls.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- src/components/SkipAction.test.tsx src/levels/defaultChart.test.ts`

Expected: 2 test files pass with no warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/components/SkipAction.tsx src/components/SkipAction.test.tsx src/levels/defaultChart.ts src/levels/defaultChart.test.ts src/styles.css
git commit -m "feat: add shared prototype skip action"
```

---

### Task 2: Add Skip To Every Pre-Challenge Screen

**Files:**
- Modify: `src/components/HomeScreen.tsx`
- Modify: `src/components/HomeScreen.test.tsx`
- Modify: `src/components/LevelSelectScreen.tsx`
- Modify: `src/components/LevelSelectScreen.test.tsx`
- Modify: `src/components/AnalysisScreen.tsx`
- Modify: `src/components/AnalysisScreen.test.tsx`
- Modify: `src/components/CalibrationScreen.tsx`
- Modify: `src/components/CalibrationScreen.test.tsx`

**Interfaces:**
- Consumes: `SkipAction(props: { onSkip(): void })` from Task 1.
- Produces: `HomeScreenProps.onSkip(): void`.
- Produces: `LevelSelectScreenProps.onSkip(): void`.
- Produces: `AnalysisScreenProps.onSkip(result: AnalysisResult | null): void`.
- Produces: `CalibrationScreenProps.onSkip(): void`.

- [ ] **Step 1: Add failing component tests for one skip button per page**

```tsx
it("skips from this page through the shared bottom-right action", () => {
  const onSkip = vi.fn();
  render(<HomeScreen onStart={vi.fn()} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "跳过" }));
  expect(onSkip).toHaveBeenCalledOnce();
});
```

Add the corresponding explicit contracts to the other page tests:

```tsx
// src/components/LevelSelectScreen.test.tsx
it("skips to analysis", () => {
  const onSkip = vi.fn();
  render(<LevelSelectScreen level={BUILT_IN_LEVEL} onSelect={vi.fn()} onBack={vi.fn()} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "跳过" }));
  expect(onSkip).toHaveBeenCalledOnce();
});

// src/components/CalibrationScreen.test.tsx
it("skips calibration without manufacturing a profile", () => {
  const onSkip = vi.fn();
  render(<CalibrationScreen chartCount={3} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "跳过" }));
  expect(onSkip).toHaveBeenCalledOnce();
});
```

In `AnalysisScreen.test.tsx`, analyze successfully first, then assert skip emits the current result:

```tsx
const onSkip = vi.fn();
render(<AnalysisScreen level={BUILT_IN_LEVEL} onConfirm={vi.fn()} onBack={vi.fn()} onSkip={onSkip} />);
fireEvent.click(screen.getByRole("button", { name: "分析卡点" }));
await screen.findByRole("group", { name: "卡点时间轴" });
fireEvent.click(screen.getByRole("button", { name: "跳过" }));
expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ chart: expect.any(Array), poseCache: expect.any(Array) }));
```

- [ ] **Step 2: Run the four component test files and verify RED**

Run: `npm.cmd test -- src/components/HomeScreen.test.tsx src/components/LevelSelectScreen.test.tsx src/components/AnalysisScreen.test.tsx src/components/CalibrationScreen.test.tsx`

Expected: FAIL because the new props and buttons do not exist.

- [ ] **Step 3: Add the new props and render `SkipAction` once in each page root**

Define the shared analysis result in `AnalysisScreen.tsx`:

```ts
export interface AnalysisResult {
  chart: BeatPoint[];
  poseCache: DemoPoseCache;
}

interface AnalysisScreenProps {
  level: BuiltInLevel;
  onConfirm(result: AnalysisResult): void;
  onSkip(result: AnalysisResult | null): void;
  onBack(): void;
}
```

Use `onSkip(chart.length > 0 ? { chart: enabledChart, poseCache } : null)` so a completed analysis is preserved and an untouched analysis delegates fallback selection to `App`. Do not stop or restart media as a side effect of rendering `SkipAction`.

- [ ] **Step 4: Run the four component test files and verify GREEN**

Run: `npm.cmd test -- src/components/HomeScreen.test.tsx src/components/LevelSelectScreen.test.tsx src/components/AnalysisScreen.test.tsx src/components/CalibrationScreen.test.tsx`

Expected: all focused tests pass with no duplicate `跳过` buttons.

- [ ] **Step 5: Commit**

```powershell
git add src/components/HomeScreen.tsx src/components/HomeScreen.test.tsx src/components/LevelSelectScreen.tsx src/components/LevelSelectScreen.test.tsx src/components/AnalysisScreen.tsx src/components/AnalysisScreen.test.tsx src/components/CalibrationScreen.tsx src/components/CalibrationScreen.test.tsx
git commit -m "feat: add skip navigation to prototype setup"
```

---

### Task 3: Lift The Pose Cache Into App Session State

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `AnalysisResult` from Task 2.
- Consumes: `DEFAULT_BUILT_IN_CHART` from Task 1.
- Produces: `demoPoseCache: DemoPoseCache` stored for the current `App` lifetime.
- Passes: `ChallengeScreen initialPoseCache={demoPoseCache}`.

- [ ] **Step 1: Write failing App tests for normal cache handoff and every skip transition**

Mock `ChallengeScreen` so the test can inspect props without initializing media:

```tsx
vi.mock("../components/ChallengeScreen", () => ({
  ChallengeScreen: ({ chart, initialPoseCache }: { chart: BeatPoint[]; initialPoseCache: DemoPoseCache }) => (
    <main>
      <h1>挑战测试页</h1>
      <span>缓存 {initialPoseCache.length} 帧</span>
      <span>卡点 {chart.length} 个</span>
    </main>
  ),
}));
```

Add one test for the normal flow asserting `缓存 1 帧`. Add one test that clicks `跳过` on home, selection, analysis, and calibration in sequence and asserts challenge receives `DEFAULT_BUILT_IN_CHART.length` beats and `缓存 0 帧`.

- [ ] **Step 2: Run the App test and verify RED**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: FAIL because `App` does not own or forward `demoPoseCache`, and skip props are not wired.

- [ ] **Step 3: Implement session ownership and explicit transition helpers**

```tsx
const [demoPoseCache, setDemoPoseCache] = useState<DemoPoseCache>([]);

function acceptAnalysis(result: AnalysisResult) {
  setChart(result.chart);
  setDemoPoseCache(result.poseCache);
  setScreen("calibration");
}

function skipAnalysis(result: AnalysisResult | null) {
  setChart(result?.chart.length ? result.chart : DEFAULT_BUILT_IN_CHART);
  setDemoPoseCache(result?.poseCache ?? []);
  setScreen("calibration");
}
```

Wire home skip to `level-select`, selection skip to `analysis`, calibration skip to `challenge`, and pass `initialPoseCache={demoPoseCache}` into `ChallengeScreen`. Do not construct a fake calibration profile.

- [ ] **Step 4: Run App and component integration tests and verify GREEN**

Run: `npm.cmd test -- src/app/App.test.tsx src/components/AnalysisScreen.test.tsx src/components/CalibrationScreen.test.tsx`

Expected: normal and skip flows pass, and normal analysis hands off one cached frame.

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: retain demonstration poses across the flow"
```

---

### Task 4: Gate Challenge Startup Behind The Instruction Card

**Files:**
- Modify: `src/components/ChallengeScreen.tsx`
- Modify: `src/components/ChallengeScreen.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `initialPoseCache: DemoPoseCache` from Task 3.
- Preserves: injected `poseExtractor`, `cameraStarter`, `providerFactory`, and `poseLoop` test boundaries.
- Produces: onboarding state `"instructions" | "starting" | "active" | "camera-error"`.

- [ ] **Step 1: Replace existing startup tests with failing onboarding and cache tests**

```tsx
it("shows instructions without requesting camera access or playing media", () => {
  const cameraStarter = vi.fn();
  renderChallenge({ initialPoseCache: poseCache, cameraStarter });
  expect(screen.getByRole("dialog", { name: "舞蹈玩法" })).toBeVisible();
  expect(screen.getByText("单手张开保持 0.6 秒：播放或暂停")).toBeVisible();
  expect(screen.getByText("双手举过头顶保持 1 秒：重新开始")).toBeVisible();
  expect(cameraStarter).not.toHaveBeenCalled();
});

it("uses the supplied cache without extracting the demonstration again", async () => {
  const poseExtractor = vi.fn();
  renderChallenge({ initialPoseCache: poseCache, poseExtractor });
  expect(await screen.findByLabelText("示范骨架运动")).toBeVisible();
  expect(poseExtractor).not.toHaveBeenCalled();
});

it("extracts the demonstration once when no cache was supplied", async () => {
  const poseExtractor = vi.fn(async () => poseCache);
  renderChallenge({ initialPoseCache: [], poseExtractor });
  await screen.findByLabelText("示范骨架运动");
  expect(poseExtractor).toHaveBeenCalledOnce();
});
```

Add a fourth test that spies on media `play()`, clicks `开始舞蹈`, and asserts the dialog disappears, `cameraStarter` is called once, and `play()` is called once.

Add an explicit camera failure recovery test:

```tsx
it("offers retry after camera startup fails without reopening instructions", async () => {
  const cameraStarter = vi.fn()
    .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
    .mockResolvedValueOnce({ stream: {} as MediaStream, stop: vi.fn() });
  renderChallenge({ initialPoseCache: poseCache, cameraStarter });
  fireEvent.click(screen.getByRole("button", { name: "开始舞蹈" }));
  expect(await screen.findByRole("button", { name: "重试摄像头" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "舞蹈玩法" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重试摄像头" }));
  await waitFor(() => expect(cameraStarter).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run the challenge test and verify RED**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx`

Expected: FAIL because `initialPoseCache`, the dialog, and the onboarding state do not exist.

- [ ] **Step 3: Implement cache-first initialization and the four-state onboarding flow**

Initialize local cache from the prop:

```tsx
const [poseCache, setPoseCache] = useState<DemoPoseCache>(initialPoseCache);
const [phase, setPhase] = useState<"instructions" | "starting" | "active" | "camera-error">("instructions");
```

Run the fallback effect only when `initialPoseCache.length === 0`. The `开始舞蹈` handler sets `starting`, calls the existing camera/provider/loop setup, then sets `active`; on failure it sets `camera-error`. Keep the error retry button wired to the same handler without reopening the instruction dialog.

Render a semantic `<section role="dialog" aria-modal="true" aria-labelledby="challenge-instructions-title">` containing exactly the three approved instruction lines and one `开始舞蹈` primary action. Use an opaque card surface with a maximum width of 460px, 16px maximum corner radius, and clear focus styling; do not add decorative metrics or extra copy.

- [ ] **Step 4: Run the challenge test and verify GREEN**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx`

Expected: all cache, onboarding, permission-gating, playback, and gesture fallback tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ChallengeScreen.tsx src/components/ChallengeScreen.test.tsx src/styles.css
git commit -m "feat: teach controls before starting a challenge"
```

---

### Task 5: Remove Nonessential Challenge HUD And Verify The Complete Flow

**Files:**
- Modify: `src/components/ChallengeScreen.tsx`
- Modify: `src/components/ChallengeScreen.test.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: challenge phase and cache behavior from Task 4.
- Produces: active challenge DOM containing only back navigation, full-screen camera, full-height skeleton, camera/gesture status, and playback fallback controls.

- [ ] **Step 1: Write failing assertions for the reduced active HUD**

After clicking `开始舞蹈`, assert:

```tsx
expect(screen.queryByRole("heading", { name: "开始舞蹈" })).not.toBeInTheDocument();
expect(screen.queryByText(/个卡点/)).not.toBeInTheDocument();
expect(screen.queryByText(/已提取 .* 帧骨架/)).not.toBeInTheDocument();
expect(screen.queryByText("Dance challenge")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "返回" })).toBeVisible();
expect(screen.getByLabelText("播放控制")).toBeVisible();
expect(screen.getByRole("region", { name: "示范骨架舞者" })).toHaveClass("challenge-reference-overlay--full-height");
```

In `App.test.tsx`, complete the normal flow and assert no second `extractDemoPoseCache` call occurs after entering challenge.

- [ ] **Step 2: Run challenge and App tests and verify RED**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because the old title/metrics HUD is still rendered.

- [ ] **Step 3: Remove the obsolete HUD markup and align the remaining controls**

Delete `challenge-hud__identity`, card-count, extraction-count, and step-mode markup. Keep status text directly on the camera surface in `var(--accent)` with no background. Align back navigation to the top safe-area axis and playback controls to the bottom safe-area axis using the same `--challenge-edge` token. Preserve `100dvh` on `.challenge-reference-overlay--full-height` and `.challenge-reference-skeleton`.

- [ ] **Step 4: Run focused, full, and production verification**

Run: `npm.cmd test -- src/components/ChallengeScreen.test.tsx src/app/App.test.tsx`

Expected: focused tests pass with no React `act(...)` warnings.

Run: `npm.cmd test`

Expected: all test files pass with zero failed tests.

Run: `npm.cmd run build`

Expected: TypeScript and Vite production build exit 0.

- [ ] **Step 5: Perform browser verification**

Start: `npm.cmd run dev -- --host 127.0.0.1 --port 5175`

Verify at `http://127.0.0.1:5175/`:

1. Each pre-challenge page has one bottom-right `跳过` button in the same position.
2. Repeated skip clicks reach challenge without requiring analysis or calibration completion.
3. Challenge initially shows only the approved instruction card over a stationary background.
4. Pressing `开始舞蹈` is the first camera permission request and starts the media clock.
5. A normal analyzed flow enters challenge without a visible pose-extraction delay.
6. Active challenge contains no title, card count, extracted-frame count, or step number.
7. Camera and skeleton remain full-height at desktop and mobile widths.

- [ ] **Step 6: Commit**

```powershell
git add src/components/ChallengeScreen.tsx src/components/ChallengeScreen.test.tsx src/app/App.test.tsx src/styles.css
git commit -m "refactor: focus the active dance challenge HUD"
```
