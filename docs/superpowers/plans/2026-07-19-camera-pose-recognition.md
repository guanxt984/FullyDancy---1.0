# Camera Pose Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser page that opens the user's camera, recognizes one body with MediaPipe Pose Landmarker, draws the pose skeleton over the mirrored preview, and reports whether a sufficiently visible full body is in frame.

**Architecture:** A small Vite React TypeScript app owns the UI lifecycle. Browser camera access, MediaPipe inference, pose-quality classification, and canvas drawing live behind separate interfaces so deterministic unit tests do not load a real model or camera. The first version runs throttled inference on the main thread; a Web Worker is explicitly deferred.

**Tech Stack:** React 19.2.7, Vite 8.1.5, TypeScript 7.0.2, Vitest 4.1.10, Testing Library, MediaPipe Tasks Vision 0.10.35.

## Global Constraints

- Recognize one person only.
- Process camera frames locally in the browser; do not upload images.
- Use MediaPipe Pose Landmarker in `VIDEO` mode with the lite model.
- Request a video stream without audio.
- Mirror the preview and canvas consistently.
- Throttle inference to at most 20 frames per second on the main thread.
- Treat missing or low-confidence landmarks as “not visible,” not as a user movement error.
- Stop all media tracks, cancel the frame loop, and close the landmarker when the feature stops or unmounts.
- Camera access requires localhost or HTTPS.
- Do not add calibration, arm-open scoring, squat scoring, beat detection, recording, gesture controls, or Web Workers.

---

## File Structure

- `package.json`: scripts and pinned runtime dependencies.
- `index.html`: Vite entry document.
- `vite.config.ts`: React-enabled Vite configuration.
- `vitest.config.ts`: jsdom test configuration.
- `tsconfig.json`: strict browser TypeScript configuration.
- `src/main.tsx`: React entry.
- `src/App.tsx`: page shell.
- `src/styles.css`: camera-stage layout and states.
- `src/pose/types.ts`: stable app-owned pose types and recognizer interface.
- `src/pose/poseQuality.ts`: pure full-body visibility classification.
- `src/pose/mediaPipePoseRecognizer.ts`: MediaPipe adapter and result normalization.
- `src/pose/drawPose.ts`: canvas skeleton renderer.
- `src/camera/camera.ts`: acquire and release browser camera streams.
- `src/components/PoseCamera.tsx`: camera, inference-loop, rendering, and cleanup orchestration.
- `src/test/setup.ts`: Testing Library matchers.
- `src/**/*.test.ts(x)`: colocated behavior tests.

### Task 1: App Scaffold And Camera Lifecycle

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `src/camera/camera.ts`
- Test: `src/camera/camera.test.ts`

**Interfaces:**
- Produces: `startCamera(devices?: MediaDevices): Promise<MediaStream>`
- Produces: `stopCamera(stream: MediaStream): void`

- [ ] **Step 1: Write the failing camera lifecycle tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { startCamera, stopCamera } from "./camera";

describe("camera", () => {
  it("requests a front-facing video stream without audio", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(startCamera({ getUserMedia } as unknown as MediaDevices)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  });

  it("stops every track", () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const stream = { getTracks: () => [{ stop: stopA }, { stop: stopB }] } as unknown as MediaStream;

    stopCamera(stream);

    expect(stopA).toHaveBeenCalledOnce();
    expect(stopB).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd install && npm.cmd test -- src/camera/camera.test.ts`

Expected: FAIL because `src/camera/camera.ts` does not exist.

- [ ] **Step 3: Add the minimal scaffold and camera implementation**

Use exact package versions from the plan header. Configure Vitest with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]`. Implement:

```ts
export function startCamera(devices: MediaDevices = navigator.mediaDevices): Promise<MediaStream> {
  return devices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
```

Render `App` with the heading `摄像头肢体识别` and a placeholder for `PoseCamera`.

- [ ] **Step 4: Run the focused test and build**

Run: `npm.cmd test -- src/camera/camera.test.ts && npm.cmd run build`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json src
git commit -m "feat: scaffold camera pose app"
```

### Task 2: Pose Types And Full-Body Visibility

**Files:**
- Create: `src/pose/types.ts`
- Create: `src/pose/poseQuality.ts`
- Test: `src/pose/poseQuality.test.ts`

**Interfaces:**
- Produces: `PoseLandmark`, `PoseFrame`, `PoseRecognizer`
- Produces: `classifyPose(frame: PoseFrame | null, minimumVisibility?: number): PoseStatus`
- Produces: `PoseStatus = "no-pose" | "partial-body" | "full-body"`

- [ ] **Step 1: Write failing classification tests**

Create fixtures for the required landmark indices: nose `0`, shoulders `11/12`, wrists `15/16`, hips `23/24`, ankles `27/28`. Assert that null is `no-pose`, one low-confidence ankle makes the pose `partial-body`, and all required landmarks at visibility `0.65` produce `full-body`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/pose/poseQuality.test.ts`

Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement app-owned pose types and classifier**

```ts
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  timestampMs: number;
  landmarks: PoseLandmark[];
}

export interface PoseRecognizer {
  recognize(video: HTMLVideoElement, timestampMs: number): PoseFrame | null;
  close(): void;
}

export type PoseStatus = "no-pose" | "partial-body" | "full-body";
```

`classifyPose` must require indices `[0, 11, 12, 15, 16, 23, 24, 27, 28]` to exist, have visibility at least `0.6`, and have normalized `x` and `y` within `[0, 1]`.

- [ ] **Step 4: Run the focused tests**

Run: `npm.cmd test -- src/pose/poseQuality.test.ts`

Expected: all pose-quality tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/pose
git commit -m "feat: classify full-body pose visibility"
```

### Task 3: MediaPipe Adapter And Skeleton Drawing

**Files:**
- Create: `src/pose/mediaPipePoseRecognizer.ts`
- Create: `src/pose/drawPose.ts`
- Test: `src/pose/mediaPipePoseRecognizer.test.ts`
- Test: `src/pose/drawPose.test.ts`

**Interfaces:**
- Consumes: `PoseFrame`, `PoseRecognizer`
- Produces: `createMediaPipePoseRecognizer(): Promise<PoseRecognizer>`
- Produces: `drawPose(context: CanvasRenderingContext2D, frame: PoseFrame, width: number, height: number): void`

- [ ] **Step 1: Write failing adapter and drawing tests**

Inject a fake landmarker into an exported `wrapMediaPipeLandmarker` factory. Assert that the first pose is normalized into `PoseFrame`, an empty result becomes null, and `close()` delegates. For drawing, pass a fake canvas context and assert visible landmarks call `arc`, and at least one valid connected pair calls `lineTo`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm.cmd test -- src/pose/mediaPipePoseRecognizer.test.ts src/pose/drawPose.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the MediaPipe adapter**

Configure `FilesetResolver.forVisionTasks` with the versioned jsDelivr WASM path and `PoseLandmarker.createFromOptions` with:

```ts
{
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputSegmentationMasks: false,
}
```

Map missing `visibility` values to `0`. If GPU initialization fails, retry once without the `delegate` field.

- [ ] **Step 4: Implement skeleton drawing**

Use an explicit list of MediaPipe pose connections. Skip points or segments whose visibility is below `0.5`. Convert normalized positions with `x * width` and `y * height`. Clear the canvas before every frame, draw cyan lines and white joint dots, and keep mirroring in CSS rather than changing coordinates.

- [ ] **Step 5: Run the focused tests**

Run: `npm.cmd test -- src/pose/mediaPipePoseRecognizer.test.ts src/pose/drawPose.test.ts`

Expected: all adapter and drawing tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/pose package.json package-lock.json
git commit -m "feat: add MediaPipe pose recognition adapter"
```

### Task 4: Live Pose Camera Component

**Files:**
- Create: `src/components/PoseCamera.tsx`
- Test: `src/components/PoseCamera.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `startCamera`, `stopCamera`, `createMediaPipePoseRecognizer`, `classifyPose`, `drawPose`
- Produces: `PoseCamera(props?: { createRecognizer?: typeof createMediaPipePoseRecognizer; openCamera?: typeof startCamera }): JSX.Element`

- [ ] **Step 1: Write failing component lifecycle tests**

Using injected fake camera and recognizer factories, verify: the initial button says `打开摄像头`; starting attaches the stream and shows `正在识别`; a full-body result shows `全身已入镜`; permission rejection shows a Chinese recovery message; clicking `停止识别` stops tracks and closes the recognizer; unmount performs the same cleanup.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm.cmd test -- src/components/PoseCamera.test.tsx`

Expected: FAIL because `PoseCamera` does not exist.

- [ ] **Step 3: Implement the component state machine**

Use states `idle`, `loading`, `running`, and `error`. Start the camera only from a user click. Attach `stream` to `video.srcObject`, await `video.play()`, then run inference via `requestVideoFrameCallback`, falling back to `requestAnimationFrame` when unavailable. Skip a frame when less than 50ms has passed since the previous inference. Do not begin another inference while one is in progress.

Map camera errors as follows:

- `NotAllowedError`: `摄像头权限被拒绝，请在浏览器设置中允许访问。`
- `NotFoundError`: `没有找到可用的摄像头。`
- other: `摄像头启动失败，请重试。`

Always cancel the scheduled callback, stop the stream, close the recognizer, clear `video.srcObject`, and clear the canvas on stop or unmount.

- [ ] **Step 4: Add the stage UI**

Render the video and canvas in the same absolutely positioned 16:9 container with identical `object-fit: cover` and `transform: scaleX(-1)`. Display the recognition state without covering the dancer. Add start/stop buttons with visible focus styles.

- [ ] **Step 5: Run all tests and build**

Run: `npm.cmd test && npm.cmd run build`

Expected: all tests pass and the production build exits 0.

- [ ] **Step 6: Perform browser verification**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5174`

Open `http://127.0.0.1:5174`, grant camera access, verify the preview is mirrored, the skeleton follows one person, full-body status changes when ankles leave the frame, and stopping turns off the camera indicator.

- [ ] **Step 7: Commit**

```powershell
git add src
git commit -m "feat: show live camera pose skeleton"
```

## Self-Review Notes

- Scope coverage: The plan covers camera permission, one-person MediaPipe inference, app-owned pose data, skeleton overlay, full-body visibility, user-facing errors, throttling, and cleanup.
- Scope exclusions: Calibration, movement scoring, beat analysis, recording, gesture controls, and workers are not included.
- Type consistency: `PoseRecognizer.recognize` is synchronous because MediaPipe `detectForVideo` is synchronous; the async boundary exists only in recognizer creation.
- Testability: Browser and MediaPipe dependencies are injected at their orchestration boundaries; pure classification and drawing logic are tested without a camera.
