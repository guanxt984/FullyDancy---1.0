# Dance Rhythm Game MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based personal dance rhythm game MVP where a user uploads a dance video, generates a lightweight challenge, calibrates their body/camera setup, dances with real-time feedback, and reviews a replay-motivating result card.

**Architecture:** Create a Vite React TypeScript app with pure domain modules for challenge generation, calibration, judging, scoring, and weak-section selection. Keep webcam/pose-estimation behind interfaces so the first MVP can ship with a deterministic browser-friendly heuristic provider and later swap in a production pose model.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Playwright, CSS modules or plain CSS.

## Global Constraints

- The first version is a personal dance rhythm game, not a creator marketplace, teacher platform, or professional judging system.
- The app must support local video upload.
- The app must generate beats and checkpoints automatically enough to start quickly.
- The app must support simple checkpoint confirmation without exposing raw angles, coordinates, or thresholds.
- The app must use webcam-based full-body practice.
- The app must include a short body and camera calibration.
- The app must judge pose checks using relative body measurements rather than absolute screen coordinates.
- The app must provide real-time timing feedback: Perfect, Great, Early, Late, Miss.
- The app must provide real-time key pose feedback, combo, energy, fever, and high-impact visual feedback.
- The app must show a post-run result card with score, best sections, weak sections, retry, and weak-section practice.
- The MVP must not include public sharing, leaderboards, multiplayer, teacher course marketplace, professional frame-by-frame judging, complex manual chart editing, or fine judging of hands, feet, facial expression, or texture.

---

## File Structure

- `package.json`: project scripts and dependencies.
- `index.html`: Vite HTML entry.
- `vite.config.ts`: Vite configuration.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript configuration.
- `vitest.config.ts`: unit test configuration.
- `playwright.config.ts`: end-to-end test configuration.
- `src/main.tsx`: React entry.
- `src/App.tsx`: top-level app state machine.
- `src/styles.css`: global visual language for the game UI.
- `src/domain/types.ts`: shared domain types.
- `src/domain/challengeGenerator.ts`: turns video metadata into beats and checkpoint suggestions.
- `src/domain/calibration.ts`: derives body calibration from normalized pose samples.
- `src/domain/judging.ts`: evaluates timing and relative pose hits.
- `src/domain/scoring.ts`: computes score, grade, combo, energy, fever, best sections, and weak sections.
- `src/services/videoMetadata.ts`: reads uploaded video duration and object URL.
- `src/services/webcam.ts`: starts/stops webcam streams.
- `src/services/poseProvider.ts`: defines pose provider interface and heuristic demo provider.
- `src/components/UploadStep.tsx`: local video upload UI.
- `src/components/CheckpointConfirmStep.tsx`: lightweight checkpoint confirmation UI.
- `src/components/CalibrationStep.tsx`: full-body calibration UI and guidance.
- `src/components/ChallengeStep.tsx`: gameplay screen with video, webcam preview, rhythm lane, feedback, combo, and energy.
- `src/components/ResultStep.tsx`: result card with retry and weak-section practice actions.
- `src/test/fixtures.ts`: deterministic fixtures for unit tests.
- `src/**/*.test.ts`: unit tests beside domain modules.
- `tests/e2e/mvp-flow.spec.ts`: browser smoke test for the full MVP loop.

---

### Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/domain/types.ts`
- Create: `src/test/fixtures.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App(): JSX.Element`
- Produces: domain type exports from `src/domain/types.ts`

- [ ] **Step 1: Create the failing app render test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("starts at the upload step for the personal dance challenge", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /create your dance challenge/i })).toBeInTheDocument();
    expect(screen.getByText(/upload a local dance video/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add project configuration**

Create `package.json`:

```json
{
  "name": "dance-rhythm-game-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dance Rhythm Game MVP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.app.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create the minimal app and shared types**

Create `src/domain/types.ts`:

```ts
export type BodyTarget = "leftArm" | "rightArm" | "shoulders" | "hips" | "knees" | "centerOfMass";
export type CheckpointIntent = "extension" | "squat" | "hold" | "turn" | "fastArrival";
export type Strictness = "loose" | "standard" | "strict";
export type TimingJudgment = "Perfect" | "Great" | "Early" | "Late" | "Miss";
export type PoseJudgment = "Pose Lock" | "Loose" | "Off Shape";

export interface VideoAsset {
  id: string;
  name: string;
  url: string;
  durationSec: number;
}

export interface Checkpoint {
  id: string;
  time: number;
  beat?: number;
  label: string;
  bodyTargets: BodyTarget[];
  intent: CheckpointIntent;
  timingWindowMs: number;
  strictness: Strictness;
  feedback: {
    hit: string;
    miss: string;
  };
}

export interface PoseLandmark {
  x: number;
  y: number;
  visibility: number;
}

export interface PoseFrame {
  timestampSec: number;
  landmarks: Partial<Record<BodyTarget | "leftWrist" | "rightWrist" | "leftElbow" | "rightElbow", PoseLandmark>>;
}

export interface CalibrationProfile {
  shoulderWidth: number;
  armSpan: number;
  standingHipY: number;
  naturalSquatHipY: number;
  bodyScale: number;
  fullBodyVisible: boolean;
}

export interface HitResult {
  checkpointId: string;
  timing: TimingJudgment;
  pose: PoseJudgment;
  deltaMs: number;
  score: number;
  message: string;
}

export interface RunSummary {
  grade: "S" | "A" | "B" | "C";
  totalScore: number;
  highestCombo: number;
  timingAccuracy: number;
  frameworkHitRate: number;
  bestSectionLabel: string;
  weakestSectionLabel: string;
}
```

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Personal dance rhythm game</p>
        <h1>Create your dance challenge</h1>
        <p>Upload a local dance video, generate a playable challenge, and dance with webcam feedback.</p>
      </section>
    </main>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `src/styles.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f7fbff;
  background: #090a10;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 45, 85, 0.24), transparent 28%),
    radial-gradient(circle at 84% 12%, rgba(0, 209, 255, 0.22), transparent 24%),
    linear-gradient(135deg, #090a10, #12131d 52%, #10141a);
}

.hero-panel {
  max-width: 760px;
}

.eyebrow {
  margin: 0 0 12px;
  color: #64e3ff;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 16px;
  font-size: 48px;
  line-height: 1.04;
}
```

Create `src/test/fixtures.ts`:

```ts
import type { CalibrationProfile, Checkpoint, PoseFrame, VideoAsset } from "../domain/types";

export const fixtureVideo: VideoAsset = {
  id: "video-1",
  name: "demo.mp4",
  url: "blob:demo",
  durationSec: 32,
};

export const fixtureCheckpoint: Checkpoint = {
  id: "cp-1",
  time: 8,
  beat: 16,
  label: "Arm open",
  bodyTargets: ["rightArm", "shoulders"],
  intent: "extension",
  timingWindowMs: 120,
  strictness: "standard",
  feedback: { hit: "Pose Lock", miss: "Arm not open" },
};

export const fixtureCalibration: CalibrationProfile = {
  shoulderWidth: 0.22,
  armSpan: 0.72,
  standingHipY: 0.52,
  naturalSquatHipY: 0.72,
  bodyScale: 1,
  fullBodyVisible: true,
};

export const fixturePoseFrame: PoseFrame = {
  timestampSec: 8.04,
  landmarks: {
    shoulders: { x: 0.5, y: 0.28, visibility: 0.95 },
    hips: { x: 0.5, y: 0.52, visibility: 0.95 },
    rightWrist: { x: 0.86, y: 0.3, visibility: 0.95 },
    rightElbow: { x: 0.68, y: 0.29, visibility: 0.95 },
    rightArm: { x: 0.77, y: 0.3, visibility: 0.95 },
  },
};
```

- [ ] **Step 4: Run the failing test, install dependencies, then pass**

Run: `npm install`

Run: `npm test -- src/App.test.tsx`

Expected after implementation: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json tsconfig.app.json vitest.config.ts playwright.config.ts src
git commit -m "feat: scaffold dance rhythm game app"
```

---

### Task 2: Video Upload And Metadata

**Files:**
- Create: `src/services/videoMetadata.ts`
- Create: `src/services/videoMetadata.test.ts`
- Create: `src/components/UploadStep.tsx`
- Create: `src/components/UploadStep.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `VideoAsset` from `src/domain/types.ts`
- Produces: `readVideoAsset(file: File): Promise<VideoAsset>`
- Produces: `UploadStep(props: { onVideoReady(video: VideoAsset): void }): JSX.Element`

- [ ] **Step 1: Write video metadata unit tests**

Create `src/services/videoMetadata.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { readVideoAsset } from "./videoMetadata";

describe("readVideoAsset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a local video asset from an uploaded file", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-video");

    const file = new File(["video"], "practice.mp4", { type: "video/mp4" });
    const asset = await readVideoAsset(file, 42);

    expect(asset).toEqual({
      id: "practice-mp4-42",
      name: "practice.mp4",
      url: "blob:local-video",
      durationSec: 42,
    });
  });
});
```

- [ ] **Step 2: Implement video metadata service**

Create `src/services/videoMetadata.ts`:

```ts
import type { VideoAsset } from "../domain/types";

export async function readVideoAsset(file: File, knownDurationSec?: number): Promise<VideoAsset> {
  const url = URL.createObjectURL(file);
  const durationSec = knownDurationSec ?? (await loadVideoDuration(url));

  return {
    id: `${file.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.round(durationSec)}`,
    name: file.name,
    url,
    durationSec,
  };
}

function loadVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : 0);
    video.onerror = () => reject(new Error("Unable to read video metadata."));
    video.src = url;
  });
}
```

- [ ] **Step 3: Write upload component test**

Create `src/components/UploadStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadStep } from "./UploadStep";

describe("UploadStep", () => {
  it("accepts a local video file and calls onVideoReady", async () => {
    const onVideoReady = vi.fn();
    render(<UploadStep onVideoReady={onVideoReady} />);

    const file = new File(["demo"], "demo.mp4", { type: "video/mp4" });
    const input = screen.getByLabelText(/upload a local dance video/i);
    await userEvent.upload(input, file);

    expect(await screen.findByText(/demo.mp4/i)).toBeInTheDocument();
    expect(onVideoReady).toHaveBeenCalledWith(expect.objectContaining({ name: "demo.mp4" }));
  });
});
```

- [ ] **Step 4: Implement upload component**

Create `src/components/UploadStep.tsx`:

```tsx
import { useState } from "react";
import type { VideoAsset } from "../domain/types";
import { readVideoAsset } from "../services/videoMetadata";

interface UploadStepProps {
  onVideoReady(video: VideoAsset): void;
}

export function UploadStep({ onVideoReady }: UploadStepProps) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Choose a video file.");
      return;
    }

    setError("");
    setFileName(file.name);
    const asset = await readVideoAsset(file);
    onVideoReady(asset);
  }

  return (
    <section className="step-panel">
      <p className="eyebrow">Step 1</p>
      <h1>Create your dance challenge</h1>
      <p>Upload a local dance video and turn it into a playable practice run.</p>
      <label className="upload-zone">
        <span>Upload a local dance video</span>
        <input type="file" accept="video/*" onChange={(event) => void handleFile(event.target.files?.[0])} />
      </label>
      {fileName ? <p className="status-line">Loaded {fileName}</p> : null}
      {error ? <p className="error-line">{error}</p> : null}
    </section>
  );
}
```

- [ ] **Step 5: Wire upload into App**

Modify `src/App.tsx`:

```tsx
import { useState } from "react";
import { UploadStep } from "./components/UploadStep";
import type { VideoAsset } from "./domain/types";

export function App() {
  const [video, setVideo] = useState<VideoAsset | null>(null);

  return (
    <main className="app-shell">
      {!video ? <UploadStep onVideoReady={setVideo} /> : <section className="step-panel"><h1>{video.name}</h1></section>}
    </main>
  );
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/services/videoMetadata.test.ts src/components/UploadStep.test.tsx src/App.test.tsx`

Expected: PASS with all listed tests passing.

```bash
git add src/services src/components src/App.tsx
git commit -m "feat: add local video upload"
```

---

### Task 3: Automatic Challenge Generation

**Files:**
- Create: `src/domain/challengeGenerator.ts`
- Create: `src/domain/challengeGenerator.test.ts`
- Create: `src/components/CheckpointConfirmStep.tsx`
- Create: `src/components/CheckpointConfirmStep.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `VideoAsset`, `Checkpoint`
- Produces: `generateChallenge(video: VideoAsset): Checkpoint[]`
- Produces: `CheckpointConfirmStep(props: { video: VideoAsset; checkpoints: Checkpoint[]; onConfirm(checkpoints: Checkpoint[]): void }): JSX.Element`

- [ ] **Step 1: Write challenge generator tests**

Create `src/domain/challengeGenerator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtureVideo } from "../test/fixtures";
import { generateChallenge } from "./challengeGenerator";

describe("generateChallenge", () => {
  it("creates playable checkpoints from video duration", () => {
    const checkpoints = generateChallenge({ ...fixtureVideo, durationSec: 32 });

    expect(checkpoints).toHaveLength(8);
    expect(checkpoints[0]).toMatchObject({
      time: 4,
      beat: 8,
      label: "Arm open",
      intent: "extension",
      strictness: "standard",
    });
    expect(checkpoints.every((checkpoint) => checkpoint.timingWindowMs === 120)).toBe(true);
  });

  it("caps checkpoint count so confirmation stays lightweight", () => {
    const checkpoints = generateChallenge({ ...fixtureVideo, durationSec: 180 });

    expect(checkpoints).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Implement deterministic MVP generator**

Create `src/domain/challengeGenerator.ts`:

```ts
import type { Checkpoint, CheckpointIntent, VideoAsset } from "./types";

const labelCycle: Array<{ label: string; intent: CheckpointIntent; miss: string }> = [
  { label: "Arm open", intent: "extension", miss: "Arm not open" },
  { label: "Squat low", intent: "squat", miss: "Go lower" },
  { label: "Hold the pose", intent: "hold", miss: "Do not drift" },
  { label: "Hit fast", intent: "fastArrival", miss: "Too soft" },
  { label: "Turn body", intent: "turn", miss: "Turn more" },
];

export function generateChallenge(video: VideoAsset): Checkpoint[] {
  const count = Math.min(20, Math.max(5, Math.floor(video.durationSec / 4)));
  return Array.from({ length: count }, (_, index) => {
    const preset = labelCycle[index % labelCycle.length];
    const time = Number((((index + 1) * video.durationSec) / (count + 1)).toFixed(2));

    return {
      id: `cp-${index + 1}`,
      time,
      beat: (index + 1) * 8,
      label: preset.label,
      bodyTargets: preset.intent === "squat" ? ["hips", "knees"] : ["rightArm", "shoulders"],
      intent: preset.intent,
      timingWindowMs: 120,
      strictness: "standard",
      feedback: {
        hit: preset.intent === "hold" ? "Pose Lock" : "Perfect hit",
        miss: preset.miss,
      },
    };
  });
}
```

- [ ] **Step 3: Write checkpoint confirmation test**

Create `src/components/CheckpointConfirmStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fixtureCheckpoint, fixtureVideo } from "../test/fixtures";
import { CheckpointConfirmStep } from "./CheckpointConfirmStep";

describe("CheckpointConfirmStep", () => {
  it("lets the user confirm generated checkpoints", async () => {
    const onConfirm = vi.fn();
    render(<CheckpointConfirmStep video={fixtureVideo} checkpoints={[fixtureCheckpoint]} onConfirm={onConfirm} />);

    expect(screen.getByText(/arm open/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /start calibration/i }));

    expect(onConfirm).toHaveBeenCalledWith([fixtureCheckpoint]);
  });
});
```

- [ ] **Step 4: Implement checkpoint confirmation**

Create `src/components/CheckpointConfirmStep.tsx`:

```tsx
import type { Checkpoint, VideoAsset } from "../domain/types";

interface CheckpointConfirmStepProps {
  video: VideoAsset;
  checkpoints: Checkpoint[];
  onConfirm(checkpoints: Checkpoint[]): void;
}

export function CheckpointConfirmStep({ video, checkpoints, onConfirm }: CheckpointConfirmStepProps) {
  return (
    <section className="step-panel">
      <p className="eyebrow">Step 2</p>
      <h1>Quick challenge generated</h1>
      <p>{video.name} became {checkpoints.length} playable checkpoints.</p>
      <div className="checkpoint-list">
        {checkpoints.map((checkpoint) => (
          <article className="checkpoint-card" key={checkpoint.id}>
            <strong>{checkpoint.label}</strong>
            <span>{checkpoint.time.toFixed(1)}s</span>
            <small>{checkpoint.feedback.miss}</small>
          </article>
        ))}
      </div>
      <button className="primary-button" onClick={() => onConfirm(checkpoints)}>Start calibration</button>
    </section>
  );
}
```

- [ ] **Step 5: Wire generation flow into App**

Modify `src/App.tsx` so upload moves to checkpoint confirmation:

```tsx
import { useState } from "react";
import { CheckpointConfirmStep } from "./components/CheckpointConfirmStep";
import { UploadStep } from "./components/UploadStep";
import { generateChallenge } from "./domain/challengeGenerator";
import type { Checkpoint, VideoAsset } from "./domain/types";

type Step = "upload" | "confirm" | "calibration";

export function App() {
  const [step, setStep] = useState<Step>("upload");
  const [video, setVideo] = useState<VideoAsset | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  function handleVideoReady(asset: VideoAsset) {
    setVideo(asset);
    setCheckpoints(generateChallenge(asset));
    setStep("confirm");
  }

  function handleConfirm(confirmed: Checkpoint[]) {
    setCheckpoints(confirmed);
    setStep("calibration");
  }

  return (
    <main className="app-shell">
      {step === "upload" ? <UploadStep onVideoReady={handleVideoReady} /> : null}
      {step === "confirm" && video ? <CheckpointConfirmStep video={video} checkpoints={checkpoints} onConfirm={handleConfirm} /> : null}
      {step === "calibration" ? <section className="step-panel"><h1>Calibration</h1></section> : null}
    </main>
  );
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/domain/challengeGenerator.test.ts src/components/CheckpointConfirmStep.test.tsx src/App.test.tsx`

Expected: PASS with all listed tests passing.

```bash
git add src/domain/challengeGenerator.ts src/domain/challengeGenerator.test.ts src/components/CheckpointConfirmStep.tsx src/components/CheckpointConfirmStep.test.tsx src/App.tsx
git commit -m "feat: generate quick dance checkpoints"
```

---

### Task 4: Calibration Domain And UI

**Files:**
- Create: `src/domain/calibration.ts`
- Create: `src/domain/calibration.test.ts`
- Create: `src/components/CalibrationStep.tsx`
- Create: `src/components/CalibrationStep.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PoseFrame`, `CalibrationProfile`
- Produces: `buildCalibrationProfile(samples: PoseFrame[]): CalibrationProfile`
- Produces: `getCalibrationGuidance(profile: CalibrationProfile): string[]`
- Produces: `CalibrationStep(props: { onComplete(profile: CalibrationProfile): void }): JSX.Element`

- [ ] **Step 1: Write calibration domain tests**

Create `src/domain/calibration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCalibrationProfile, getCalibrationGuidance } from "./calibration";
import type { PoseFrame } from "./types";

const samples: PoseFrame[] = [
  {
    timestampSec: 0,
    landmarks: {
      shoulders: { x: 0.5, y: 0.25, visibility: 0.95 },
      hips: { x: 0.5, y: 0.52, visibility: 0.95 },
      leftWrist: { x: 0.12, y: 0.28, visibility: 0.95 },
      rightWrist: { x: 0.88, y: 0.28, visibility: 0.95 },
    },
  },
  {
    timestampSec: 1,
    landmarks: {
      shoulders: { x: 0.5, y: 0.25, visibility: 0.95 },
      hips: { x: 0.5, y: 0.72, visibility: 0.95 },
      leftWrist: { x: 0.14, y: 0.31, visibility: 0.95 },
      rightWrist: { x: 0.86, y: 0.31, visibility: 0.95 },
    },
  },
];

describe("calibration", () => {
  it("builds a relative body profile from pose samples", () => {
    const profile = buildCalibrationProfile(samples);

    expect(profile.armSpan).toBeCloseTo(0.76);
    expect(profile.standingHipY).toBeCloseTo(0.52);
    expect(profile.naturalSquatHipY).toBeCloseTo(0.72);
    expect(profile.fullBodyVisible).toBe(true);
  });

  it("blocks when visibility is too low", () => {
    const profile = buildCalibrationProfile([
      { ...samples[0], landmarks: { shoulders: { x: 0.5, y: 0.25, visibility: 0.2 } } },
    ]);

    expect(getCalibrationGuidance(profile)).toContain("Stand fully in frame.");
  });
});
```

- [ ] **Step 2: Implement calibration domain**

Create `src/domain/calibration.ts`:

```ts
import type { CalibrationProfile, PoseFrame, PoseLandmark } from "./types";

function visible(point: PoseLandmark | undefined): point is PoseLandmark {
  return Boolean(point && point.visibility >= 0.6);
}

export function buildCalibrationProfile(samples: PoseFrame[]): CalibrationProfile {
  const visibleSamples = samples.filter((sample) => visible(sample.landmarks.shoulders) && visible(sample.landmarks.hips));
  const standing = visibleSamples[0];
  const squat = visibleSamples.reduce((lowest, sample) => {
    const currentY = sample.landmarks.hips?.y ?? 0;
    const lowestY = lowest.landmarks.hips?.y ?? 0;
    return currentY > lowestY ? sample : lowest;
  }, visibleSamples[0] ?? samples[0]);

  const leftWrist = standing?.landmarks.leftWrist;
  const rightWrist = standing?.landmarks.rightWrist;
  const armSpan = visible(leftWrist) && visible(rightWrist) ? Math.abs(rightWrist.x - leftWrist.x) : 0;
  const standingHipY = standing?.landmarks.hips?.y ?? 0;
  const naturalSquatHipY = squat?.landmarks.hips?.y ?? standingHipY;

  return {
    shoulderWidth: Math.max(0.18, armSpan * 0.3),
    armSpan,
    standingHipY,
    naturalSquatHipY,
    bodyScale: Math.max(0.1, naturalSquatHipY - (standing?.landmarks.shoulders?.y ?? 0)),
    fullBodyVisible: visibleSamples.length > 0 && armSpan > 0.4,
  };
}

export function getCalibrationGuidance(profile: CalibrationProfile): string[] {
  const guidance: string[] = [];
  if (!profile.fullBodyVisible) guidance.push("Stand fully in frame.");
  if (profile.armSpan < 0.4) guidance.push("Step back from the camera.");
  if (profile.naturalSquatHipY <= profile.standingHipY) guidance.push("Do one natural squat.");
  return guidance;
}
```

- [ ] **Step 3: Write calibration UI test**

Create `src/components/CalibrationStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalibrationStep } from "./CalibrationStep";

describe("CalibrationStep", () => {
  it("completes the short calibration flow", async () => {
    const onComplete = vi.fn();
    render(<CalibrationStep onComplete={onComplete} />);

    expect(screen.getByText(/stand fully in frame/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /use demo calibration/i }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ fullBodyVisible: true }));
  });
});
```

- [ ] **Step 4: Implement calibration UI**

Create `src/components/CalibrationStep.tsx`:

```tsx
import { buildCalibrationProfile } from "../domain/calibration";
import type { CalibrationProfile, PoseFrame } from "../domain/types";

interface CalibrationStepProps {
  onComplete(profile: CalibrationProfile): void;
}

const demoSamples: PoseFrame[] = [
  {
    timestampSec: 0,
    landmarks: {
      shoulders: { x: 0.5, y: 0.25, visibility: 0.95 },
      hips: { x: 0.5, y: 0.52, visibility: 0.95 },
      leftWrist: { x: 0.12, y: 0.28, visibility: 0.95 },
      rightWrist: { x: 0.88, y: 0.28, visibility: 0.95 },
    },
  },
  {
    timestampSec: 1,
    landmarks: {
      shoulders: { x: 0.5, y: 0.25, visibility: 0.95 },
      hips: { x: 0.5, y: 0.72, visibility: 0.95 },
      leftWrist: { x: 0.13, y: 0.3, visibility: 0.95 },
      rightWrist: { x: 0.87, y: 0.3, visibility: 0.95 },
    },
  },
];

export function CalibrationStep({ onComplete }: CalibrationStepProps) {
  function completeDemoCalibration() {
    onComplete(buildCalibrationProfile(demoSamples));
  }

  return (
    <section className="step-panel">
      <p className="eyebrow">Step 3</p>
      <h1>Calibrate your space</h1>
      <ol className="calibration-list">
        <li>Stand fully in frame.</li>
        <li>Hold a neutral pose.</li>
        <li>Open both arms.</li>
        <li>Do one natural squat.</li>
      </ol>
      <button className="primary-button" onClick={completeDemoCalibration}>Use demo calibration</button>
    </section>
  );
}
```

- [ ] **Step 5: Wire calibration into App**

Modify `src/App.tsx` to store `CalibrationProfile` and move to challenge:

```tsx
import { useState } from "react";
import { CalibrationStep } from "./components/CalibrationStep";
import { CheckpointConfirmStep } from "./components/CheckpointConfirmStep";
import { UploadStep } from "./components/UploadStep";
import { generateChallenge } from "./domain/challengeGenerator";
import type { CalibrationProfile, Checkpoint, VideoAsset } from "./domain/types";

type Step = "upload" | "confirm" | "calibration" | "challenge";

export function App() {
  const [step, setStep] = useState<Step>("upload");
  const [video, setVideo] = useState<VideoAsset | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(null);

  function handleVideoReady(asset: VideoAsset) {
    setVideo(asset);
    setCheckpoints(generateChallenge(asset));
    setStep("confirm");
  }

  function handleConfirm(confirmed: Checkpoint[]) {
    setCheckpoints(confirmed);
    setStep("calibration");
  }

  function handleCalibrationComplete(profile: CalibrationProfile) {
    setCalibration(profile);
    setStep("challenge");
  }

  return (
    <main className="app-shell">
      {step === "upload" ? <UploadStep onVideoReady={handleVideoReady} /> : null}
      {step === "confirm" && video ? <CheckpointConfirmStep video={video} checkpoints={checkpoints} onConfirm={handleConfirm} /> : null}
      {step === "calibration" ? <CalibrationStep onComplete={handleCalibrationComplete} /> : null}
      {step === "challenge" && calibration ? <section className="step-panel"><h1>Challenge ready</h1></section> : null}
    </main>
  );
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/domain/calibration.test.ts src/components/CalibrationStep.test.tsx src/App.test.tsx`

Expected: PASS with all listed tests passing.

```bash
git add src/domain/calibration.ts src/domain/calibration.test.ts src/components/CalibrationStep.tsx src/components/CalibrationStep.test.tsx src/App.tsx
git commit -m "feat: add adaptive body calibration"
```

---

### Task 5: Timing And Pose Judging

**Files:**
- Create: `src/domain/judging.ts`
- Create: `src/domain/judging.test.ts`

**Interfaces:**
- Consumes: `Checkpoint`, `CalibrationProfile`, `PoseFrame`, `HitResult`
- Produces: `judgeCheckpoint(checkpoint: Checkpoint, poseFrame: PoseFrame, calibration: CalibrationProfile): HitResult`
- Produces: `judgeTiming(deltaMs: number, timingWindowMs: number): TimingJudgment`

- [ ] **Step 1: Write judging tests**

Create `src/domain/judging.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtureCalibration, fixtureCheckpoint, fixturePoseFrame } from "../test/fixtures";
import { judgeCheckpoint, judgeTiming } from "./judging";

describe("judgeTiming", () => {
  it.each([
    [20, "Perfect"],
    [80, "Great"],
    [-90, "Early"],
    [160, "Late"],
    [280, "Miss"],
  ] as const)("judges %sms as %s", (deltaMs, expected) => {
    expect(judgeTiming(deltaMs, 120)).toBe(expected);
  });
});

describe("judgeCheckpoint", () => {
  it("uses relative arm extension for pose lock", () => {
    const result = judgeCheckpoint(fixtureCheckpoint, fixturePoseFrame, fixtureCalibration);

    expect(result.pose).toBe("Pose Lock");
    expect(result.timing).toBe("Great");
    expect(result.score).toBeGreaterThan(0);
  });

  it("marks off shape when arm extension is below calibrated threshold", () => {
    const result = judgeCheckpoint(
      fixtureCheckpoint,
      {
        ...fixturePoseFrame,
        landmarks: {
          ...fixturePoseFrame.landmarks,
          rightWrist: { x: 0.6, y: 0.3, visibility: 0.95 },
        },
      },
      fixtureCalibration,
    );

    expect(result.pose).toBe("Off Shape");
    expect(result.message).toBe("Arm not open");
  });
});
```

- [ ] **Step 2: Implement judging**

Create `src/domain/judging.ts`:

```ts
import type { CalibrationProfile, Checkpoint, HitResult, PoseFrame, PoseJudgment, TimingJudgment } from "./types";

export function judgeTiming(deltaMs: number, timingWindowMs: number): TimingJudgment {
  const absolute = Math.abs(deltaMs);
  if (absolute <= timingWindowMs * 0.35) return "Perfect";
  if (absolute <= timingWindowMs) return "Great";
  if (absolute <= timingWindowMs * 1.75) return deltaMs < 0 ? "Early" : "Late";
  return "Miss";
}

export function judgeCheckpoint(
  checkpoint: Checkpoint,
  poseFrame: PoseFrame,
  calibration: CalibrationProfile,
): HitResult {
  const deltaMs = Math.round((poseFrame.timestampSec - checkpoint.time) * 1000);
  const timing = judgeTiming(deltaMs, checkpoint.timingWindowMs);
  const pose = judgePose(checkpoint, poseFrame, calibration);
  const timingScore = timing === "Perfect" ? 100 : timing === "Great" ? 80 : timing === "Early" || timing === "Late" ? 45 : 0;
  const poseScore = pose === "Pose Lock" ? 100 : pose === "Loose" ? 60 : 0;
  const score = Math.round((timingScore * 0.55 + poseScore * 0.45) * strictnessMultiplier(checkpoint.strictness));

  return {
    checkpointId: checkpoint.id,
    timing,
    pose,
    deltaMs,
    score,
    message: pose === "Pose Lock" ? checkpoint.feedback.hit : checkpoint.feedback.miss,
  };
}

function judgePose(checkpoint: Checkpoint, poseFrame: PoseFrame, calibration: CalibrationProfile): PoseJudgment {
  if (checkpoint.intent === "squat") {
    const hipY = poseFrame.landmarks.hips?.y ?? calibration.standingHipY;
    const requiredY = calibration.standingHipY + (calibration.naturalSquatHipY - calibration.standingHipY) * 0.75;
    if (hipY >= requiredY) return "Pose Lock";
    if (hipY >= requiredY - 0.05) return "Loose";
    return "Off Shape";
  }

  if (checkpoint.intent === "extension") {
    const shoulder = poseFrame.landmarks.shoulders;
    const wrist = poseFrame.landmarks.rightWrist ?? poseFrame.landmarks.leftWrist;
    if (!shoulder || !wrist) return "Off Shape";
    const reach = Math.abs(wrist.x - shoulder.x);
    const ratio = reach / calibration.armSpan;
    if (ratio >= 0.45) return "Pose Lock";
    if (ratio >= 0.34) return "Loose";
    return "Off Shape";
  }

  return timingPoseFallback(poseFrame);
}

function timingPoseFallback(poseFrame: PoseFrame): PoseJudgment {
  return poseFrame.landmarks.shoulders && poseFrame.landmarks.hips ? "Pose Lock" : "Off Shape";
}

function strictnessMultiplier(strictness: Checkpoint["strictness"]): number {
  if (strictness === "loose") return 1.05;
  if (strictness === "strict") return 0.95;
  return 1;
}
```

- [ ] **Step 3: Run tests and commit**

Run: `npm test -- src/domain/judging.test.ts`

Expected: PASS with all judging tests passing.

```bash
git add src/domain/judging.ts src/domain/judging.test.ts
git commit -m "feat: add relative timing and pose judging"
```

---

### Task 6: Scoring, Combo, Fever, And Weak Sections

**Files:**
- Create: `src/domain/scoring.ts`
- Create: `src/domain/scoring.test.ts`

**Interfaces:**
- Consumes: `HitResult`, `RunSummary`
- Produces: `calculateRunSummary(results: HitResult[]): RunSummary`
- Produces: `calculateCombo(results: HitResult[]): number`
- Produces: `calculateEnergy(results: HitResult[]): number`

- [ ] **Step 1: Write scoring tests**

Create `src/domain/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HitResult } from "./types";
import { calculateCombo, calculateEnergy, calculateRunSummary } from "./scoring";

const results: HitResult[] = [
  { checkpointId: "cp-1", timing: "Perfect", pose: "Pose Lock", deltaMs: 10, score: 100, message: "Pose Lock" },
  { checkpointId: "cp-2", timing: "Great", pose: "Pose Lock", deltaMs: 60, score: 89, message: "Pose Lock" },
  { checkpointId: "cp-3", timing: "Late", pose: "Off Shape", deltaMs: 160, score: 25, message: "Go lower" },
  { checkpointId: "cp-4", timing: "Perfect", pose: "Pose Lock", deltaMs: 20, score: 100, message: "Pose Lock" },
];

describe("scoring", () => {
  it("calculates highest combo without misses or off-shape results", () => {
    expect(calculateCombo(results)).toBe(2);
  });

  it("calculates capped energy", () => {
    expect(calculateEnergy(results)).toBe(78);
  });

  it("summarizes the run for the result card", () => {
    const summary = calculateRunSummary(results);

    expect(summary.grade).toBe("B");
    expect(summary.highestCombo).toBe(2);
    expect(summary.timingAccuracy).toBe(75);
    expect(summary.frameworkHitRate).toBe(75);
    expect(summary.bestSectionLabel).toBe("Checkpoints 1-2");
    expect(summary.weakestSectionLabel).toBe("Checkpoints 3-4");
  });
});
```

- [ ] **Step 2: Implement scoring**

Create `src/domain/scoring.ts`:

```ts
import type { HitResult, RunSummary } from "./types";

export function calculateCombo(results: HitResult[]): number {
  let current = 0;
  let best = 0;

  for (const result of results) {
    if (result.timing !== "Miss" && result.pose !== "Off Shape") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

export function calculateEnergy(results: HitResult[]): number {
  if (results.length === 0) return 0;
  return Math.min(100, Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length));
}

export function calculateRunSummary(results: HitResult[]): RunSummary {
  const totalScore = calculateEnergy(results);
  const timingHits = results.filter((result) => result.timing === "Perfect" || result.timing === "Great").length;
  const frameworkHits = results.filter((result) => result.pose === "Pose Lock").length;

  return {
    grade: gradeFromScore(totalScore),
    totalScore,
    highestCombo: calculateCombo(results),
    timingAccuracy: Math.round((timingHits / Math.max(1, results.length)) * 100),
    frameworkHitRate: Math.round((frameworkHits / Math.max(1, results.length)) * 100),
    bestSectionLabel: sectionLabel(results, "best"),
    weakestSectionLabel: sectionLabel(results, "weakest"),
  };
}

function gradeFromScore(score: number): RunSummary["grade"] {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  return "C";
}

function sectionLabel(results: HitResult[], mode: "best" | "weakest"): string {
  if (results.length <= 2) return "Full challenge";
  const windows = [];
  for (let index = 0; index < results.length - 1; index += 1) {
    const pair = results.slice(index, index + 2);
    const average = pair.reduce((sum, result) => sum + result.score, 0) / pair.length;
    windows.push({ index, average });
  }
  const selected = windows.reduce((chosen, item) => {
    return mode === "best"
      ? item.average > chosen.average ? item : chosen
      : item.average < chosen.average ? item : chosen;
  }, windows[0]);

  return `Checkpoints ${selected.index + 1}-${selected.index + 2}`;
}
```

- [ ] **Step 3: Run tests and commit**

Run: `npm test -- src/domain/scoring.test.ts`

Expected: PASS with all scoring tests passing.

```bash
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "feat: add run scoring and weak section logic"
```

---

### Task 7: Gameplay Screen

**Files:**
- Create: `src/services/poseProvider.ts`
- Create: `src/services/webcam.ts`
- Create: `src/components/ChallengeStep.tsx`
- Create: `src/components/ChallengeStep.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `VideoAsset`, `Checkpoint`, `CalibrationProfile`, `HitResult`
- Consumes: `judgeCheckpoint(checkpoint, poseFrame, calibration)`
- Produces: `createDemoPoseFrame(checkpoint: Checkpoint): PoseFrame`
- Produces: `ChallengeStep(props: { video: VideoAsset; checkpoints: Checkpoint[]; calibration: CalibrationProfile; onComplete(results: HitResult[]): void }): JSX.Element`

- [ ] **Step 1: Write ChallengeStep test**

Create `src/components/ChallengeStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fixtureCalibration, fixtureCheckpoint, fixtureVideo } from "../test/fixtures";
import { ChallengeStep } from "./ChallengeStep";

describe("ChallengeStep", () => {
  it("plays checkpoint hits and completes with results", async () => {
    const onComplete = vi.fn();
    render(
      <ChallengeStep
        video={fixtureVideo}
        checkpoints={[fixtureCheckpoint]}
        calibration={fixtureCalibration}
        onComplete={onComplete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /start challenge/i }));
    expect(screen.getByText(/pose lock/i)).toBeInTheDocument();
    expect(screen.getByText(/combo 1/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finish run/i }));
    expect(onComplete).toHaveBeenCalledWith([expect.objectContaining({ checkpointId: "cp-1" })]);
  });
});
```

- [ ] **Step 2: Implement pose and webcam services**

Create `src/services/poseProvider.ts`:

```ts
import type { Checkpoint, PoseFrame } from "../domain/types";

export function createDemoPoseFrame(checkpoint: Checkpoint): PoseFrame {
  return {
    timestampSec: checkpoint.time + 0.04,
    landmarks: {
      shoulders: { x: 0.5, y: 0.28, visibility: 0.95 },
      hips: { x: 0.5, y: checkpoint.intent === "squat" ? 0.7 : 0.52, visibility: 0.95 },
      rightWrist: { x: 0.86, y: 0.3, visibility: 0.95 },
      rightElbow: { x: 0.68, y: 0.29, visibility: 0.95 },
      rightArm: { x: 0.77, y: 0.3, visibility: 0.95 },
    },
  };
}
```

Create `src/services/webcam.ts`:

```ts
export async function startWebcam(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, facingMode: "user" },
    audio: false,
  });
}

export function stopWebcam(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
```

- [ ] **Step 3: Implement gameplay component**

Create `src/components/ChallengeStep.tsx`:

```tsx
import { useMemo, useState } from "react";
import { judgeCheckpoint } from "../domain/judging";
import { calculateCombo, calculateEnergy } from "../domain/scoring";
import type { CalibrationProfile, Checkpoint, HitResult, VideoAsset } from "../domain/types";
import { createDemoPoseFrame } from "../services/poseProvider";

interface ChallengeStepProps {
  video: VideoAsset;
  checkpoints: Checkpoint[];
  calibration: CalibrationProfile;
  onComplete(results: HitResult[]): void;
}

export function ChallengeStep({ video, checkpoints, calibration, onComplete }: ChallengeStepProps) {
  const [results, setResults] = useState<HitResult[]>([]);
  const [started, setStarted] = useState(false);
  const combo = useMemo(() => calculateCombo(results), [results]);
  const energy = useMemo(() => calculateEnergy(results), [results]);
  const latest = results.at(-1);

  function startChallenge() {
    setStarted(true);
    setResults(checkpoints.map((checkpoint) => judgeCheckpoint(checkpoint, createDemoPoseFrame(checkpoint), calibration)));
  }

  return (
    <section className="challenge-stage">
      <div className="video-panel">
        <video src={video.url} controls aria-label="Reference dance video" />
      </div>
      <div className="hud-panel">
        <p className="eyebrow">Step 4</p>
        <h1>Hit the stage</h1>
        <div className="judgment-burst">{latest?.pose ?? "Ready"}</div>
        <div className="stat-grid">
          <strong>Combo {combo}</strong>
          <strong>Energy {energy}</strong>
          <strong>{latest?.timing ?? "Waiting"}</strong>
        </div>
        <div className={energy >= 85 ? "fever-meter fever-meter-on" : "fever-meter"}>
          <span style={{ width: `${energy}%` }} />
        </div>
        {!started ? <button className="primary-button" onClick={startChallenge}>Start challenge</button> : null}
        {started ? <button className="primary-button" onClick={() => onComplete(results)}>Finish run</button> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire ChallengeStep into App**

Modify the challenge branch in `src/App.tsx`:

```tsx
import { ChallengeStep } from "./components/ChallengeStep";
import type { CalibrationProfile, Checkpoint, HitResult, VideoAsset } from "./domain/types";
```

Add state:

```tsx
const [results, setResults] = useState<HitResult[]>([]);
```

Add handler:

```tsx
function handleChallengeComplete(runResults: HitResult[]) {
  setResults(runResults);
  setStep("result");
}
```

Set `Step` to include `"result"`, and render:

```tsx
{step === "challenge" && video && calibration ? (
  <ChallengeStep video={video} checkpoints={checkpoints} calibration={calibration} onComplete={handleChallengeComplete} />
) : null}
{step === "result" ? <section className="step-panel"><h1>Result ready</h1><p>{results.length} hits recorded.</p></section> : null}
```

- [ ] **Step 5: Add gameplay CSS**

Append to `src/styles.css`:

```css
.challenge-stage {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.6fr);
  gap: 24px;
  min-height: calc(100vh - 64px);
  align-items: center;
}

.video-panel video {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.hud-panel,
.step-panel {
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(10, 12, 20, 0.82);
  border-radius: 8px;
}

.judgment-burst {
  min-height: 96px;
  display: grid;
  place-items: center;
  color: #ffffff;
  background: linear-gradient(135deg, #ff2d55, #00d1ff);
  font-size: 36px;
  font-weight: 900;
  border-radius: 8px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.fever-meter {
  height: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
}

.fever-meter span {
  display: block;
  height: 100%;
  background: #64e3ff;
}

.fever-meter-on span {
  background: #ffdd33;
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/components/ChallengeStep.test.tsx src/domain/judging.test.ts src/domain/scoring.test.ts`

Expected: PASS with all listed tests passing.

```bash
git add src/services/poseProvider.ts src/services/webcam.ts src/components/ChallengeStep.tsx src/components/ChallengeStep.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add real-time challenge stage"
```

---

### Task 8: Result Card, Retry, And Weak-Section Practice

**Files:**
- Create: `src/components/ResultStep.tsx`
- Create: `src/components/ResultStep.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `HitResult`, `RunSummary`, `calculateRunSummary(results)`
- Produces: `ResultStep(props: { results: HitResult[]; onRetry(): void; onPracticeWeakSection(): void }): JSX.Element`

- [ ] **Step 1: Write result card test**

Create `src/components/ResultStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HitResult } from "../domain/types";
import { ResultStep } from "./ResultStep";

const results: HitResult[] = [
  { checkpointId: "cp-1", timing: "Perfect", pose: "Pose Lock", deltaMs: 10, score: 100, message: "Pose Lock" },
  { checkpointId: "cp-2", timing: "Late", pose: "Off Shape", deltaMs: 160, score: 25, message: "Go lower" },
];

describe("ResultStep", () => {
  it("shows replay-focused result actions", async () => {
    const onRetry = vi.fn();
    const onPracticeWeakSection = vi.fn();
    render(<ResultStep results={results} onRetry={onRetry} onPracticeWeakSection={onPracticeWeakSection} />);

    expect(screen.getByText(/grade c/i)).toBeInTheDocument();
    expect(screen.getByText(/highest combo/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry full challenge/i }));
    await userEvent.click(screen.getByRole("button", { name: /practice weak section/i }));

    expect(onRetry).toHaveBeenCalled();
    expect(onPracticeWeakSection).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement result card**

Create `src/components/ResultStep.tsx`:

```tsx
import { calculateRunSummary } from "../domain/scoring";
import type { HitResult } from "../domain/types";

interface ResultStepProps {
  results: HitResult[];
  onRetry(): void;
  onPracticeWeakSection(): void;
}

export function ResultStep({ results, onRetry, onPracticeWeakSection }: ResultStepProps) {
  const summary = calculateRunSummary(results);

  return (
    <section className="step-panel result-card">
      <p className="eyebrow">Result</p>
      <h1>Grade {summary.grade}</h1>
      <div className="stat-grid">
        <strong>Score {summary.totalScore}</strong>
        <strong>Highest combo {summary.highestCombo}</strong>
        <strong>Timing {summary.timingAccuracy}%</strong>
        <strong>Framework {summary.frameworkHitRate}%</strong>
      </div>
      <p>Best section: {summary.bestSectionLabel}</p>
      <p>Weak section: {summary.weakestSectionLabel}</p>
      <div className="action-row">
        <button className="primary-button" onClick={onRetry}>Retry full challenge</button>
        <button className="secondary-button" onClick={onPracticeWeakSection}>Practice weak section</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire result actions into App**

Modify `src/App.tsx`:

```tsx
import { ResultStep } from "./components/ResultStep";
```

Replace the result branch:

```tsx
{step === "result" ? (
  <ResultStep
    results={results}
    onRetry={() => setStep("challenge")}
    onPracticeWeakSection={() => setStep("challenge")}
  />
) : null}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/components/ResultStep.test.tsx src/domain/scoring.test.ts src/App.test.tsx`

Expected: PASS with all listed tests passing.

```bash
git add src/components/ResultStep.tsx src/components/ResultStep.test.tsx src/App.tsx
git commit -m "feat: add replay-focused result card"
```

---

### Task 9: End-To-End MVP Flow And Build Verification

**Files:**
- Create: `tests/e2e/mvp-flow.spec.ts`
- Modify: `src/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete app flow from upload through result.
- Produces: a verified browser smoke path and local run instructions.

- [ ] **Step 1: Write E2E smoke test**

Create `tests/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("user can move through the MVP dance challenge flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /create your dance challenge/i })).toBeVisible();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/upload a local dance video/i).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "practice.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("demo"),
  });

  await expect(page.getByRole("heading", { name: /quick challenge generated/i })).toBeVisible();
  await page.getByRole("button", { name: /start calibration/i }).click();

  await expect(page.getByRole("heading", { name: /calibrate your space/i })).toBeVisible();
  await page.getByRole("button", { name: /use demo calibration/i }).click();

  await expect(page.getByRole("heading", { name: /hit the stage/i })).toBeVisible();
  await page.getByRole("button", { name: /start challenge/i }).click();
  await expect(page.getByText(/combo/i)).toBeVisible();
  await page.getByRole("button", { name: /finish run/i }).click();

  await expect(page.getByRole("heading", { name: /grade/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /retry full challenge/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /practice weak section/i })).toBeVisible();
});
```

- [ ] **Step 2: Add responsive polish**

Append to `src/styles.css`:

```css
.primary-button,
.secondary-button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 18px;
  color: #071014;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  background: #64e3ff;
}

.secondary-button {
  background: #ffdd33;
}

.upload-zone {
  display: grid;
  gap: 12px;
  width: min(100%, 520px);
  padding: 24px;
  border: 1px dashed rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  cursor: pointer;
}

.checkpoint-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.checkpoint-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.status-line {
  color: #64e3ff;
}

.error-line {
  color: #ff8aa0;
}

@media (max-width: 840px) {
  .app-shell {
    padding: 18px;
  }

  h1 {
    font-size: 34px;
  }

  .challenge-stage {
    grid-template-columns: 1fr;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Add README**

Create or replace `README.md`:

```md
# Dance Rhythm Game MVP

A personal web-based dance rhythm practice game. Upload a local dance video, generate a quick challenge, calibrate your body and camera setup, dance with real-time feedback, and review a replay-focused result card.

## Run Locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
npm run e2e
```

## MVP Boundaries

The first version focuses on personal practice. It does not include public sharing, leaderboards, multiplayer, teacher course marketplaces, or professional frame-by-frame judging.
```

- [ ] **Step 4: Run full verification**

Run: `npm test`

Expected: PASS with all unit and component tests passing.

Run: `npm run build`

Expected: exit code 0 and Vite production build output.

Run: `npx playwright install chromium`

Expected: Chromium browser installed or already available.

Run: `npm run e2e`

Expected: PASS with `mvp-flow.spec.ts` passing in Chromium.

- [ ] **Step 5: Commit**

```bash
git add tests README.md src/styles.css
git commit -m "test: verify full dance challenge flow"
```

---

## Self-Review Notes

- Spec coverage: Tasks cover upload, automatic challenge generation, checkpoint confirmation, body calibration, relative judging, real-time feedback, combo/energy/fever, result card, retry, and weak-section practice.
- Scope control: The plan excludes sharing, leaderboards, multiplayer, marketplace features, professional frame-by-frame judging, and complex chart editing.
- Type consistency: Shared types originate in `src/domain/types.ts`; later tasks consume `VideoAsset`, `Checkpoint`, `CalibrationProfile`, `PoseFrame`, `HitResult`, and `RunSummary` from that file.
- Test coverage: Each domain module has unit tests; each major UI step has component tests; the full user loop has one Playwright smoke test.
