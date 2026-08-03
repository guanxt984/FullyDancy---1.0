# FullyDancy Built-in Dance Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user video upload with one publicly bundled dance video, then generate an editable beat chart from that built-in level.

**Architecture:** Serve the MP4 as a same-origin static asset and expose it through one small `BuiltInLevel` configuration. React first renders a playable level preview; the next task fetches the same asset, decodes its audio locally, runs lightweight beat analysis on the main thread, and opens the existing-style chart confirmation flow. This plan supersedes upload-related parts of Tasks 3, 4, 9, 11, and 12 in `2026-07-19-dance-rhythm-game-mvp.md`.

**Tech Stack:** Vite, React, TypeScript, Web Audio API, music-tempo, HTML video, Vitest, Testing Library.

## Global Constraints

- MVP contains exactly one level: `public/levels/level-1.mp4`.
- The source file is `C:/Users/GXT/Videos/8月3日.mp4`, authorized for public distribution.
- Do not expose a file input, upload endpoint, level list, account, database, or backend.
- The beat chart is not preset: analyze the built-in video, then let the user confirm beats and mark `open` or `squat`.
- The video is about 13 seconds and 11.5 MiB; do not add transcoding or complex container parsing.
- Media loading or decoding failure uses the single message `关卡加载失败，请重试`.
- Keep implementation small. Do not add a generic level framework before a second level exists.
- Camera frames, pose landmarks, body measurements, and calibration data stay local.
- Write a failing behavior test before the minimum implementation for each code change.
- Pause for user inspection after Task 1 before starting Task 2.

---

## File Structure

- `public/levels/level-1.mp4`: the public built-in dance video.
- `src/levels/builtInLevel.ts`: the single level's stable metadata.
- `src/components/BuiltInLevelStep.tsx`: playable preview and analysis entry action.
- `src/media/decodeAudio.ts`: browser audio decoding and mono PCM conversion.
- `src/media/loadBuiltInLevelAudio.ts`: same-origin fetch boundary for the level audio.
- `src/beat-analysis/`: lightweight music-tempo adapter and salience filtering.
- `src/chart/chart.ts`: editable beat chart data operations.
- `src/components/ChartEditor.tsx`: beat confirmation and `open` / `squat` marking.
- `src/app/App.tsx`: temporary orchestration until the later session reducer task.

---

### Task 1: Replace Upload UI with a Playable Built-in Level

**Files:**
- Copy: `C:/Users/GXT/Videos/8月3日.mp4` → `public/levels/level-1.mp4`
- Create: `src/levels/builtInLevel.ts`
- Test: `src/levels/builtInLevel.test.ts`
- Create: `src/components/BuiltInLevelStep.tsx`
- Test: `src/components/BuiltInLevelStep.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Delete: `src/components/UploadStep.tsx`
- Delete: `src/components/UploadStep.test.tsx`
- Delete: `src/media/videoAsset.ts`
- Delete: `src/media/videoAsset.test.ts`

**Interfaces:**
- Produces: `BuiltInLevel`
- Produces: `BUILT_IN_LEVEL`
- Produces: `BuiltInLevelStep({ level, onAnalyze }): JSX.Element`
- `onAnalyze` is a synchronous intent callback in this task; Task 2 connects real analysis.

- [ ] **Step 1: Write failing level and page tests**

```ts
it("uses the one public dance level", () => {
  expect(BUILT_IN_LEVEL).toEqual({
    id: "level-1",
    title: "8月3日舞蹈挑战",
    videoUrl: "/levels/level-1.mp4",
  });
});

it("shows the built-in video without an upload control", () => {
  render(<App />);
  expect(screen.getByLabelText("内置舞蹈示范")).toHaveAttribute(
    "src",
    "/levels/level-1.mp4",
  );
  expect(screen.queryByLabelText("选择练习视频")).not.toBeInTheDocument();
});

it("reports the user's analysis intent", async () => {
  const onAnalyze = vi.fn();
  render(<BuiltInLevelStep level={BUILT_IN_LEVEL} onAnalyze={onAnalyze} />);
  await userEvent.click(screen.getByRole("button", { name: "分析卡点" }));
  expect(onAnalyze).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- src/levels/builtInLevel.test.ts src/components/BuiltInLevelStep.test.tsx src/app/App.test.tsx`

Expected: FAIL because `builtInLevel` and `BuiltInLevelStep` do not exist and `App` still renders only the camera technical slice.

- [ ] **Step 3: Copy the exact public asset**

Create `public/levels/` and copy `C:/Users/GXT/Videos/8月3日.mp4` to `public/levels/level-1.mp4` without re-encoding it. Verify the destination size is `12063040` bytes.

- [ ] **Step 4: Implement the single level configuration**

```ts
export interface BuiltInLevel {
  id: "level-1";
  title: string;
  videoUrl: string;
}

export const BUILT_IN_LEVEL: BuiltInLevel = {
  id: "level-1",
  title: "8月3日舞蹈挑战",
  videoUrl: "/levels/level-1.mp4",
};
```

- [ ] **Step 5: Implement the minimal preview component**

```tsx
interface BuiltInLevelStepProps {
  level: BuiltInLevel;
  onAnalyze(): void;
}

export function BuiltInLevelStep({ level, onAnalyze }: BuiltInLevelStepProps) {
  return (
    <section aria-labelledby="level-title">
      <h2 id="level-title">{level.title}</h2>
      <video aria-label="内置舞蹈示范" controls preload="metadata" src={level.videoUrl} />
      <p>先观看示范，再分析音乐强拍。</p>
      <button type="button" onClick={onAnalyze}>分析卡点</button>
    </section>
  );
}
```

Render this component from `App`. On click, show `正在准备卡点分析…`; do not pretend beat analysis has completed.

- [ ] **Step 6: Remove upload-only code**

Delete `UploadStep` and `videoAsset` with their tests. Keep `decodeAudio.ts` and its tests because Task 2 reuses mono PCM conversion. Remove imports that only supported upload.

- [ ] **Step 7: Run focused and full verification**

Run: `npm.cmd test -- src/levels/builtInLevel.test.ts src/components/BuiltInLevelStep.test.tsx src/app/App.test.tsx`

Expected: the new level/page tests pass.

Run: `npm.cmd test`

Expected: all remaining tests pass with no upload tests present.

Run: `npm.cmd run build`

Expected: exit 0 and `dist/levels/level-1.mp4` exists with size `12063040` bytes.

- [ ] **Step 8: Commit and pause for user inspection**

```powershell
git add public/levels src/levels src/components src/media src/app
git commit -m "feat: replace uploads with built-in dance level"
```

Start the local app on `127.0.0.1:5174`, open it for the user, and pause. The user verifies that the video appears, plays with sound, seeks correctly, no upload control exists, and “分析卡点” shows the honest preparation message.

---

### Task 2: Analyze the Built-in Audio and Confirm the Beat Chart

**Files:**
- Modify: `src/media/decodeAudio.ts`
- Modify: `src/media/decodeAudio.test.ts`
- Create: `src/media/loadBuiltInLevelAudio.ts`
- Test: `src/media/loadBuiltInLevelAudio.test.ts`
- Create: `src/beat-analysis/beatAnalyzer.ts`
- Create: `src/beat-analysis/musicTempoAdapter.ts`
- Create: `src/beat-analysis/salience.ts`
- Test: `src/beat-analysis/salience.test.ts`
- Create: `src/chart/chart.ts`
- Test: `src/chart/chart.test.ts`
- Create: `src/components/ChartEditor.tsx`
- Test: `src/components/ChartEditor.test.tsx`
- Modify: `src/components/BuiltInLevelStep.tsx`
- Modify: `src/components/BuiltInLevelStep.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `BuiltInLevel`, `BUILT_IN_LEVEL`
- Produces: `decodeMonoPcm(source: Blob, context: AudioContext): Promise<PcmAudio>`
- Produces: `loadBuiltInLevelAudio(level, context, fetcher?): Promise<PcmAudio>`
- Produces: `BeatAnalyzer.analyze(audio): Promise<BeatCandidate[]>`
- Produces: `filterSalientBeats(candidates, pcm, config): BeatCandidate[]`
- Produces: `createChart(candidates): BeatPoint[]`
- Produces: `updateBeat(chart, beatId, patch): BeatPoint[]`

- [ ] **Step 1: Write failing built-in loading tests**

```ts
it("fetches the configured built-in video", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" })),
  );
  await loadBuiltInLevelAudio(BUILT_IN_LEVEL, fakeAudioContext(), fetcher);
  expect(fetcher).toHaveBeenCalledWith("/levels/level-1.mp4");
});

it("uses one simple public error for media failure", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
  await expect(loadBuiltInLevelAudio(BUILT_IN_LEVEL, fakeAudioContext(), fetcher))
    .rejects.toThrow("关卡加载失败，请重试");
});
```

- [ ] **Step 2: Run the loader test and verify RED**

Run: `npm.cmd test -- src/media/loadBuiltInLevelAudio.test.ts`

Expected: FAIL because the loader does not exist.

- [ ] **Step 3: Simplify decoding for the fixed asset**

Change `decodeMonoPcm` to accept `Blob`, call `arrayBuffer()` and `decodeAudioData()`, then average every channel sample into one `Float32Array`. Remove upload-only preflight, object URL creation, file-name handling, and specialized format/no-track public errors. Any failure exposed by `loadBuiltInLevelAudio` becomes `关卡加载失败，请重试`.

```ts
export async function loadBuiltInLevelAudio(
  level: BuiltInLevel,
  context: AudioContext,
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

- [ ] **Step 4: Write failing salience and chart tests**

```ts
it("removes weak beats that are too close", () => {
  const result = filterSalientBeats(
    candidatesAt([1, 1.1, 1.5]),
    impulsePcm([1, 1.5]),
    config,
  );
  expect(result.map((beat) => beat.timeSec)).toEqual([1, 1.5]);
});

it("allows one optional action per beat", () => {
  const opened = updateBeat(chart, "b2", { action: "open" });
  expect(updateBeat(opened, "b2", { action: "squat" })[1].action).toBe("squat");
});
```

Add one fixture proving a 120 BPM clip does not become a dense 240 BPM chart.

- [ ] **Step 5: Run analysis/chart tests and verify RED**

Run: `npm.cmd test -- src/beat-analysis src/chart src/components/ChartEditor.test.tsx`

Expected: FAIL because the analysis, chart, and editor modules do not exist.

- [ ] **Step 6: Implement the minimum main-thread analyzer**

`musicTempoAdapter.ts` is the only file that imports `music-tempo`. Convert tempo beat positions to seconds, then use short-window PCM energy, median salience, and minimum spacing to keep a sparse chart. The built-in clip is about 13 seconds, so do not add a Worker, request protocol, abort registry, or generic job system.

- [ ] **Step 7: Implement the chart editor**

Each retained beat supports four choices: remove, rhythm only, `open`, or `squat`. Replacing an action must overwrite the previous action so one beat never holds both. Show this fixed guidance:

`动作标记是你希望自己在该拍完成的状态，不是系统识别原视频动作。`

- [ ] **Step 8: Connect real analysis in App**

When “分析卡点” is clicked:

1. Create an `AudioContext`.
2. Load mono PCM from `BUILT_IN_LEVEL`.
3. Analyze and filter beat candidates.
4. Create a chart and render `ChartEditor`.
5. Close the `AudioContext` in `finally`.
6. On any error, keep the preview visible and show `关卡加载失败，请重试`.

Do not add the later calibration/session reducer yet.

- [ ] **Step 9: Run verification**

Run: `npm.cmd test -- src/media src/beat-analysis src/chart src/components/BuiltInLevelStep.test.tsx src/components/ChartEditor.test.tsx src/app/App.test.tsx`

Expected: all built-in loading, analysis, chart, and page tests pass.

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: exit 0 and the built-in MP4 remains in `dist/levels/`.

- [ ] **Step 10: Commit**

```powershell
git add package.json package-lock.json src/media src/beat-analysis src/chart src/components src/app
git commit -m "feat: analyze the built-in dance level"
```

After this task, resume the main MVP plan at its pose-quality task. Future session, E2E, privacy, and acceptance work must use the `level → chart → calibrate → countdown → challenge → result → retry-check` flow and must not restore upload or object-URL requirements.
