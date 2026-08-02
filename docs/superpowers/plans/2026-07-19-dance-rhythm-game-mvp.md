# fullydancy MVP 分阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 构建可公开部署的轻量 Web 舞蹈练习 MVP：上传本地视频、确认强拍谱面、自动采集身体与机位数据，并通过本地姿态识别反馈节奏落点和“打开/蹲低”。

**Architecture:** 纯浏览器、本地优先，以视频 mediaTime 为唯一游戏时钟。外部算法位于 BeatAnalyzer 与 PoseProvider 端口后；校准、运动特征、判定和计分是纯 TypeScript 模块，React 只编排流程与显示结果。先验证 MediaPipe 性能，再依次完成谱面、校准、双层判定、完整游戏循环和静态部署。

**Tech Stack:** Vite、React、TypeScript、Web Audio API、music-tempo、MediaPipe Tasks Vision Pose Landmarker、Web Worker、Canvas 2D、CSS、Vitest、Testing Library、Playwright。

## Global Constraints

- 单人模式；首发支持桌面 Chrome 和 Edge，其他浏览器先做能力检测。
- 视频、摄像头帧、姿态关键点、身体比例和校准结果不得上传。
- 不需要登录、数据库、云同步或应用后端。
- 本地视频限制 15–60 秒；对象地址在会话结束时 revoke。
- 每个保留强拍都判定节奏；每拍最多附加 open 或 squat 一种动作状态。
- open：卡点窗口内任意一只可靠手臂伸直即命中；方向无关，提前伸直并保持也有效。
- squat：达到个人校准下蹲深度约 85% 即命中；提前蹲低并保持也有效。
- 无法可靠识别时返回 unjudgeable，不算动作失败且不打断 Combo。
- Combo 仅由节奏维持；动作只影响完成率、额外分数和能量。
- 时间窗集中配置：Perfect ±100ms、Great ±200ms、Early/Late ±350ms，其余 Miss。
- 完整校准目标 6–8 秒；再来一局先做约 2 秒机位复核，明显变化才重校准。
- Pose Landmarker 默认 Full，性能不足降级 Lite；目标约 20 FPS。
- 摄像头帧在推理前绑定 video.currentTime；推理完成时间不得用于节奏判定。
- 公开版本使用 HTTPS 静态托管，自托管并缓存 Pose 模型和 WASM。
- 先写失败测试，再写最小实现；每个任务独立验证并提交。
- 不比较原视频姿势，不识别原视频动作，不引入大型游戏引擎。

---

## 文件结构

- package.json、vite.config.ts、tsconfig*.json：工程、构建和严格类型。
- vitest.config.ts、playwright.config.ts：单元、组件和浏览器测试。
- public/models/、public/wasm/、scripts/sync-mediapipe-assets.mjs：本地模型资源。
- src/app/App.tsx、src/app/sessionReducer.ts：流程装配和状态机。
- src/config/gameConfig.ts、src/domain/types.ts：集中阈值和共享类型。
- src/media/：视频对象地址、时长校验与音轨解码。
- src/beat-analysis/：算法端口、music-tempo 适配、显著度筛选和 Worker。
- src/chart/：谱面生成、启停与动作标记。
- src/pose/：摄像头、MediaPipe 适配、质量分类和 20 FPS 循环。
- src/calibration/：稳定帧聚合、完整校准和 2 秒复核。
- src/motion/：关节角、髋部下降、归一化速度和落点检测。
- src/judging/、src/scoring/：双层判定与计分。
- src/components/、src/render/：五步界面、骨架和轻量反馈。
- src/test/fixtures/、tests/e2e/：姿态序列与完整流程夹具。
- .github/workflows/verify-and-deploy.yml：验证与静态部署。

---

# Phase 1：浏览器技术可行性

### Task 1: 工程骨架、能力检测和共享契约

**Files:**
- Create: package.json
- Create: index.html
- Create: vite.config.ts
- Create: tsconfig.json
- Create: tsconfig.app.json
- Create: vitest.config.ts
- Create: playwright.config.ts
- Create: src/main.tsx
- Create: src/app/App.tsx
- Create: src/config/gameConfig.ts
- Create: src/domain/types.ts
- Create: src/platform/capabilities.ts
- Test: src/platform/capabilities.test.ts
- Create: src/test/setup.ts

**Interfaces:**
- Produces: detectCapabilities(environment?: CapabilityEnvironment): CapabilityReport
- Produces: BeatPoint、PoseFrame、CalibrationProfile、BeatJudgement、ActionJudgement、BeatResult
- Produces: GAME_CONFIG；后续任务不得散落阈值。

- [ ] **Step 1: 写能力检测失败测试**

~~~ts
it("requires camera, Web Audio and Worker", () => {
  expect(detectCapabilities(fakeEnvironment({ mediaDevices: false })).supported).toBe(false);
  expect(detectCapabilities(fakeEnvironment()).supported).toBe(true);
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/platform/capabilities.test.ts
Expected: FAIL，capabilities 模块不存在。

- [ ] **Step 3: 建立类型和集中配置**

~~~ts
export type ActionRequirement = "rhythm" | "open" | "squat";
export type TimingGrade = "perfect" | "great" | "early" | "late" | "miss";
export type ActionGrade = "hit" | "miss" | "unjudgeable";
export type Side = "left" | "right";
export type Reliable<T> =
  | { kind: "value"; value: T }
  | { kind: "unjudgeable"; reason: string };

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
export interface PoseFrame {
  captureTimeSec: number;
  landmarks: PoseLandmark[];
}
export interface CameraSignature {
  bodyScale: number;
  centerX: number;
  centerY: number;
  limbRatios: Record<string, number>;
}
export interface CalibrationProfile {
  bodyScale: number;
  straightArmAngle: Record<Side, number>;
  standingHipHeight: number;
  squatDepth: number | null;
  cameraSignature: CameraSignature;
}
export interface BeatPoint {
  id: string;
  beatIndex: number;
  timeSec: number;
  salience: number;
  enabled: boolean;
  action: ActionRequirement;
}
export interface BeatJudgement {
  grade: TimingGrade;
  deltaMs: number | null;
  endpointId: string | null;
}
export interface ActionJudgement {
  action: Exclude<ActionRequirement, "rhythm">;
  grade: ActionGrade;
  reason?: string;
}
export interface BeatResult {
  beatId: string;
  timing: BeatJudgement;
  action: ActionJudgement | null;
}
~~~

GAME_CONFIG 初值：timingWindowsMs 100/200/350、poseFps 20、minimumVisibility 0.6、openAngleToleranceDeg 10、squatRatio 0.85、fullCalibrationMs 6000、retryVerificationMs 2000。

- [ ] **Step 4: 实现能力页**

检测 getUserMedia、AudioContext、Worker、HTMLVideoElement 和 requestAnimationFrame。requestVideoFrameCallback 缺失时允许回退。页面固定显示“视频和摄像头数据仅在本机处理”。

- [ ] **Step 5: 验证并提交**

Run: npm.cmd test -- src/platform/capabilities.test.ts
Run: npm.cmd run build
Expected: 测试通过，构建退出 0。

~~~powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig*.json vitest.config.ts playwright.config.ts src
git commit -m "chore: scaffold local-first dance MVP"
~~~

### Task 2: 真实摄像头与 MediaPipe 性能切片

**Files:**
- Create: scripts/sync-mediapipe-assets.mjs
- Create: src/pose/types.ts
- Create: src/pose/camera.ts
- Create: src/pose/mediaPipePoseProvider.ts
- Create: src/pose/poseLoop.ts
- Test: src/pose/mediaPipePoseProvider.test.ts
- Create: src/components/TechnicalSlice.tsx
- Modify: package.json
- Modify: src/app/App.tsx

**Interfaces:**
- Produces: PoseProvider 与 runPoseLoop：

~~~ts
export interface PoseProvider {
  start(): Promise<void>;
  detect(video: HTMLVideoElement, captureTimeSec: number): PoseFrame | null;
  stop(): void;
}
export function runPoseLoop(options: PoseLoopOptions): () => void;
~~~

- [ ] **Step 1: 写时间戳和防重入测试**

~~~ts
it("preserves capture media time", () => {
  expect(normalizePoseResult(fakeResult(), 12.345)?.captureTimeSec).toBe(12.345);
});
it("does not overlap inference", () => {
  const detect = vi.fn(() => pendingFrame.promise);
  const stop = runPoseLoop(fakeLoopOptions({ detect }));
  tickVideoFrame(1);
  tickVideoFrame(1.02);
  expect(detect).toHaveBeenCalledOnce();
  stop();
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/pose/mediaPipePoseProvider.test.ts
Expected: FAIL，适配器不存在。

- [ ] **Step 3: 实现本地资源和 PoseProvider**

同步脚本从 https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task 和 https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task 下载版本 1 模型，以版本化文件名保存到 public/models，并从锁定版本的 @mediapipe/tasks-vision 复制 WASM 到 public/wasm。Landmarker 使用 VIDEO、numPoses: 1、outputSegmentationMasks: false；GPU 失败回退 CPU。默认 Full，连续 120 帧平均推理超过 45ms 时切换 Lite。

- [ ] **Step 4: 实现 20 FPS 技术页**

优先 requestVideoFrameCallback，回退 requestAnimationFrame；相邻推理至少 50ms且禁止重入。detect 前读取 video.currentTime。停止时取消回调、关闭模型并停止全部摄像头轨道。

- [ ] **Step 5: 真人设备闸门**

Run: npm.cmd run dev -- --host 127.0.0.1 --port 5174
在 Chrome、Edge 验证镜像、骨架、全身可见性和连续运行 3 分钟资源释放。记录 Full/Lite 平均及 P95。
Expected: 至少一种模型 P95 ≤ 50ms；两者失败时先降到 960×540 复测，通过前不进入 Phase 2。

- [ ] **Step 6: 验证并提交**

Run: npm.cmd test -- src/pose/mediaPipePoseProvider.test.ts
Run: npm.cmd run build

~~~powershell
git add package.json package-lock.json scripts public src/pose src/components/TechnicalSlice.tsx src/app/App.tsx
git commit -m "feat: validate local MediaPipe pose pipeline"
~~~

---

# Phase 2：本地视频与轻量谱面

### Task 3: 上传、时长校验和音轨解码

**Files:**
- Create: src/media/videoAsset.ts
- Test: src/media/videoAsset.test.ts
- Create: src/media/decodeAudio.ts
- Test: src/media/decodeAudio.test.ts
- Create: src/components/UploadStep.tsx
- Test: src/components/UploadStep.test.tsx

**Interfaces:**
- Produces: createVideoAsset(file): Promise<VideoAsset>
- Produces: releaseVideoAsset(asset): void
- Produces: decodeMonoPcm(file, context): Promise<PcmAudio>

- [ ] **Step 1: 写边界与清理测试**

~~~ts
it.each([14.99, 60.01])("rejects %s seconds", async (durationSec) => {
  await expect(createVideoAsset(fakeVideoFile(), fakeMetadata(durationSec)))
    .rejects.toThrow("请选择 15–60 秒的视频");
});
it("revokes the object URL", () => {
  releaseVideoAsset(fakeAsset("blob:practice"));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:practice");
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/media
Expected: FAIL，媒体模块不存在。

- [ ] **Step 3: 实现媒体模块**

仅接受 video/*；临时 video 元素读取 metadata，createObjectURL 播放。decodeAudioData 后将多声道逐样本平均为 Float32Array。错误区分格式不支持、无音轨和时长越界。

- [ ] **Step 4: 验证并提交**

Run: npm.cmd test -- src/media src/components/UploadStep.test.tsx

~~~powershell
git add src/media src/components/UploadStep*
git commit -m "feat: load local practice videos"
~~~

### Task 4: Worker 强拍分析、显著度筛选和谱面

**Files:**
- Create: src/beat-analysis/beatAnalyzer.ts
- Create: src/beat-analysis/musicTempoAdapter.ts
- Create: src/beat-analysis/salience.ts
- Create: src/beat-analysis/analysis.worker.ts
- Create: src/beat-analysis/workerClient.ts
- Test: src/beat-analysis/salience.test.ts
- Test: src/beat-analysis/workerClient.test.ts
- Create: src/chart/chart.ts
- Test: src/chart/chart.test.ts
- Create: src/components/ChartEditor.tsx
- Test: src/components/ChartEditor.test.tsx

**Interfaces:**
- Produces: BeatAnalyzer.analyze(audio): Promise<BeatCandidate[]>
- Produces: filterSalientBeats(candidates, pcm, config): BeatCandidate[]
- Produces: createChart(candidates): BeatPoint[]
- Produces: updateBeat(chart, beatId, patch): BeatPoint[]

- [ ] **Step 1: 写密度和谱面测试**

~~~ts
it("removes weak beats that are too close", () => {
  const result = filterSalientBeats(candidatesAt([1, 1.1, 1.5]), impulsePcm([1, 1.5]), config);
  expect(result.map((beat) => beat.timeSec)).toEqual([1, 1.5]);
});
it("allows one optional action per beat", () => {
  const opened = updateBeat(chart, "b2", { action: "open" });
  expect(updateBeat(opened, "b2", { action: "squat" })[1].action).toBe("squat");
});
~~~

加入 120 BPM 不输出成 240 BPM 密度、Worker abort 清理 pending 请求的测试。

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/beat-analysis src/chart
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现算法端口与 Worker**

musicTempoAdapter.ts 是唯一 import music-tempo 的文件。输出统一为秒；按短时 RMS/onset 差、显著度中位数和最小间距筛选。Worker 协议固定为 AnalyzeRequest、AnalyzeSuccess、AnalyzeFailure，以 transferable 传 PCM；abort 和卸载清理请求。

- [ ] **Step 4: 实现谱面界面**

每拍提供删除、只卡节奏、打开、蹲低；点击按 video.currentTime 试听。固定提示：“动作标记是你希望自己在该拍完成的状态，不是系统识别原视频动作。”

- [ ] **Step 5: 验证并提交**

Run: npm.cmd test -- src/beat-analysis src/chart src/components/ChartEditor.test.tsx
Run: npm.cmd run build

~~~powershell
git add package.json package-lock.json src/beat-analysis src/chart src/components/ChartEditor*
git commit -m "feat: generate and confirm a lightweight beat chart"
~~~

---

# Phase 3：姿态指标与自动校准

### Task 5: 姿态质量和纯运动指标

**Files:**
- Create: src/pose/poseQuality.ts
- Test: src/pose/poseQuality.test.ts
- Create: src/motion/geometry.ts
- Create: src/motion/poseMetrics.ts
- Test: src/motion/poseMetrics.test.ts
- Create: src/test/fixtures/poseFrames.ts

**Interfaces:**
- Produces: classifyPose(frame): "no-pose" | "partial-body" | "full-body"
- Produces: elbowAngle(frame, side): Reliable<number>
- Produces: hipHeight(frame): Reliable<number>
- Produces: bodyScale(frame): Reliable<number>
- Produces: normalizedBodySpeed(previous, current): Reliable<number>

- [ ] **Step 1: 写无图像夹具测试**

覆盖完整站立、一侧遮挡、双臂遮挡、左臂 174°、右臂 130°、髋部下降和脚踝出框。低置信指标返回 { kind: "unjudgeable" }，不能返回 0 或失败。

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/pose/poseQuality.test.ts src/motion/poseMetrics.test.ts

- [ ] **Step 3: 实现几何与归一化**

肘角使用肩—肘与腕—肘向量夹角；bodyScale 使用肩中点到踝中点距离；速度取可靠躯干和四肢关键点位移中位数，除以 bodyScale 和时间差。除法前检查尺度、时间差和置信度。

- [ ] **Step 4: 验证并提交**

Run: npm.cmd test -- src/pose src/motion

~~~powershell
git add src/pose/poseQuality* src/motion src/test/fixtures
git commit -m "feat: derive reliable normalized pose metrics"
~~~

### Task 6: 完整校准与 2 秒复核

**Files:**
- Create: src/calibration/stableSamples.ts
- Create: src/calibration/fullCalibration.ts
- Test: src/calibration/fullCalibration.test.ts
- Create: src/calibration/retryVerification.ts
- Test: src/calibration/retryVerification.test.ts
- Create: src/components/CalibrationStep.tsx
- Test: src/components/CalibrationStep.test.tsx

**Interfaces:**
- Produces: CalibrationController.accept(frame): CalibrationProgress
- Produces: CalibrationController.finish(): CalibrationProfile
- Produces: verifyRetry(frames, profile, config): "reuse" | "recalibrate"

- [ ] **Step 1: 写阶段、中位数和复核测试**

~~~ts
it("skips squat when chart has no squat beat", () => {
  const controller = createCalibrationController({ chartHasSquat: false, config });
  feedStableNeutralAndStraightArms(controller);
  expect(controller.finish().squatDepth).toBeNull();
});
it("reuses calibration for small variation", () => {
  expect(verifyRetry(similarNeutralFrames(), profile, config)).toBe("reuse");
});
it("recalibrates after clear scale change", () => {
  expect(verifyRetry(changedScaleFrames(), profile, config)).toBe("recalibrate");
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/calibration
Expected: FAIL，校准模块不存在。

- [ ] **Step 3: 实现 6–8 秒自动采集**

状态顺序：full-body、neutral、straight-arms、conditional-squat、complete。neutral 记录尺度、中心、肩髋宽、躯干和四肢比例、站立髋高；straight-arms 分别记录左右个人伸直角；仅谱面含 squat 时记录主动下蹲深度。只接受连续稳定可靠帧，以中位数生成 profile。

- [ ] **Step 4: 实现 2 秒机位签名**

自然站立约 2000ms；比较全身可见度、尺度中位数、中心、四肢比例和机位签名。关键部位持续不可见或任一指标超出集中容差即 recalibrate。

- [ ] **Step 5: 实现无需远程点击的 UI**

以语音、动画和倒计时自动推进；不提供身高、臂长或角度输入框。全身不完整时只提示调整距离或机位。

- [ ] **Step 6: 验证并提交**

Run: npm.cmd test -- src/calibration src/components/CalibrationStep.test.tsx

~~~powershell
git add src/calibration src/components/CalibrationStep*
git commit -m "feat: calibrate body and verify retry setup"
~~~

---

# Phase 4：双层判定与计分

### Task 7: 动作落点与一对一节奏匹配

**Files:**
- Create: src/motion/endpointDetector.ts
- Test: src/motion/endpointDetector.test.ts
- Create: src/judging/timing.ts
- Test: src/judging/timing.test.ts

**Interfaces:**
- Produces: detectMotionEndpoints(samples, config): MotionEndpoint[]
- Produces: matchEndpointsToBeats(beats, endpoints, windows): BeatJudgement[]
- 一个 MotionEndpoint 最多消费一次。

- [ ] **Step 1: 写落点和时间戳测试**

~~~ts
it("matches one endpoint only once", () => {
  const result = matchEndpointsToBeats(beatsAt([1, 1.12]), endpointsAt([1.08]), windows);
  expect(result.filter((x) => x.grade !== "miss")).toHaveLength(1);
});
it("uses capture time", () => {
  const point = endpointAt({ captureTimeSec: 2.09, completedAtSec: 2.7 });
  expect(judgeDelta(beatAt(2), point)).toBe("perfect");
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/motion/endpointDetector.test.ts src/judging/timing.test.ts

- [ ] **Step 3: 实现检测与匹配**

以归一化速度局部极小值、足够前置运动量或明显转向形成候选，加 refractory window 防抖。按绝对时间差从小到大一对一分配，输出 Perfect、Great、Early、Late、Miss。

- [ ] **Step 4: 验证并提交**

Run: npm.cmd test -- src/motion/endpointDetector.test.ts src/judging/timing.test.ts

~~~powershell
git add src/motion/endpointDetector* src/judging/timing*
git commit -m "feat: judge rhythm from motion endpoints"
~~~

### Task 8: open、squat、不可判定与计分

**Files:**
- Create: src/judging/actionState.ts
- Test: src/judging/actionState.test.ts
- Create: src/judging/judgeBeat.ts
- Test: src/judging/judgeBeat.test.ts
- Create: src/scoring/scoring.ts
- Test: src/scoring/scoring.test.ts

**Interfaces:**
- Produces: judgeOpen(frames, profile, window): ActionJudgement
- Produces: judgeSquat(frames, profile, window): ActionJudgement
- Produces: judgeBeat(input): BeatResult
- Produces: reduceScore(state, result, config): ScoreState
- Produces: summarizeRun(results, score): RunSummary

- [ ] **Step 1: 写核心产品规则测试**

~~~ts
it("hits open when either reliable arm is straight", () => {
  expect(judgeOpen([frame({ left: 130, right: 174 })], profile, window).grade).toBe("hit");
});
it("accepts an arm already held straight", () => {
  expect(judgeOpen(heldStraightFrames(), profile, window).grade).toBe("hit");
});
it("is unjudgeable when both arms are unreliable", () => {
  expect(judgeOpen(occludedArms(), profile, window).grade).toBe("unjudgeable");
});
it("hits squat at 85 percent", () => {
  expect(judgeSquat(framesAtSquatRatio(0.85), profile, window).grade).toBe("hit");
});
~~~

- [ ] **Step 2: 写计分独立性测试**

~~~ts
it("does not break combo on action miss", () => {
  expect(reduceScore(scoreWithCombo(8), beatResult("great", "miss"), config).combo).toBe(9);
});
it("excludes unjudgeable actions from denominator", () => {
  expect(summarizeRun([openHit(), openUnjudgeable()], emptyScore()).actionCompletionRate).toBe(100);
});
~~~

- [ ] **Step 3: 运行并确认 RED**

Run: npm.cmd test -- src/judging src/scoring

- [ ] **Step 4: 实现动作状态**

openThreshold(side) = profile.straightArmAngle[side] - openAngleToleranceDeg；任一可靠侧达阈值即 hit，两侧都不可用才 unjudgeable。不得检查方向、手腕距离或双臂宽度。squat 使用 (standingHipHeight - currentHipHeight) / calibratedSquatDepth，窗口最大值达到 0.85 即 hit。judgeBeat 不允许动作结果改写 timing。

- [ ] **Step 5: 实现计分**

总评节奏 70%、动作 30%；仅 timing miss 清空 Combo。动作 hit 增加分数和能量；unjudgeable 不进动作分母。RunSummary 输出总评、总分、节奏准确率、动作完成率、最高 Combo、open 和 squat 命中数。

- [ ] **Step 6: 验证并提交**

Run: npm.cmd test -- src/judging src/scoring

~~~powershell
git add src/judging src/scoring
git commit -m "feat: judge and score independent action states"
~~~

---

# Phase 5：完整游戏循环

### Task 9: 会话状态机与资源生命周期

**Files:**
- Create: src/app/sessionReducer.ts
- Test: src/app/sessionReducer.test.ts
- Modify: src/app/App.tsx

**Interfaces:**
- Produces: SessionState.step = upload | chart | calibrate | countdown | challenge | result | retry-check
- Produces: sessionReducer(state, event): SessionState

- [ ] **Step 1: 写正常、重试和清理测试**

~~~ts
it("routes retry through retry-check", () => {
  expect(sessionReducer(resultState(), { type: "RETRY_REQUESTED" }).step).toBe("retry-check");
});
it("returns to calibration only after changed setup", () => {
  const event = { type: "RETRY_CHECKED", outcome: "recalibrate" } as const;
  expect(sessionReducer(retryState(), event).step).toBe("calibrate");
});
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd test -- src/app/sessionReducer.test.ts

- [ ] **Step 3: 实现显式事件**

事件：VIDEO_READY、BEATS_READY、CHART_CONFIRMED、CALIBRATION_READY、COUNTDOWN_FINISHED、BEAT_JUDGED、CHALLENGE_FINISHED、RETRY_REQUESTED、RETRY_CHECKED、RESET。RESET 和卸载必须释放对象地址、Worker、摄像头轨道、Landmarker、音频上下文和动画回调。

- [ ] **Step 4: 验证并提交**

Run: npm.cmd test -- src/app/sessionReducer.test.ts

~~~powershell
git add src/app
git commit -m "feat: orchestrate dance session lifecycle"
~~~

### Task 10: 挑战反馈、战绩卡和再来一局

**Files:**
- Create: src/components/ChallengeStep.tsx
- Test: src/components/ChallengeStep.test.tsx
- Create: src/components/ResultStep.tsx
- Test: src/components/ResultStep.test.tsx
- Create: src/render/feedbackCanvas.ts
- Test: src/render/feedbackCanvas.test.ts
- Modify: src/app/App.tsx
- Modify: src/styles.css

**Interfaces:**
- ChallengeStep produces: onFinished(results, score): void
- ResultStep consumes: RunSummary、RETRY_REQUESTED、RESET。

- [ ] **Step 1: 写反馈优先级测试**

~~~ts
it("shows action success over timing success", () => {
  renderChallengeWith(beatResult("perfect", "hit", "open"));
  expect(screen.getByText("FULL OUT")).toBeVisible();
  expect(screen.queryByText("Perfect")).not.toBeInTheDocument();
});
it("shows camera guidance for unjudgeable action", () => {
  renderChallengeWith(beatResult("great", "unjudgeable", "open"));
  expect(screen.getByText("保持全身入镜")).toBeVisible();
});
~~~

- [ ] **Step 2: 写战绩卡测试**

断言总评、总分、节奏准确率、动作完成率、最高 Combo、open/squat 命中数和“再来一局”；不展示规格未定义的乐句或分段分析。

- [ ] **Step 3: 运行并确认 RED**

Run: npm.cmd test -- src/components/ChallengeStep.test.tsx src/components/ResultStep.test.tsx

- [ ] **Step 4: 实现单时钟挑战**

video.currentTime 是唯一时钟；每拍超过 Late 窗口后只结算一次。主反馈优先级：动作命中、节奏评价、动作轻提示、机位提示；负面提示按 feedbackCooldownMs 限流。Canvas 2D 绘制骨架、冲击圈和少量粒子；掉帧先关粒子，再降骨架刷新率，不改变判定窗口。

- [ ] **Step 5: 接通战绩和重试**

ResultStep 只消费 RunSummary。再来一局保留视频、谱面和 CalibrationProfile，进入 retry-check；reuse 清空本局结果并倒计时，recalibrate 清空旧 profile 并进入完整校准。

- [ ] **Step 6: 验证并提交**

Run: npm.cmd test
Run: npm.cmd run build

~~~powershell
git add src/components src/render src/app/App.tsx src/styles.css
git commit -m "feat: complete replayable dance challenge UI"
~~~

### Task 11: 端到端固定夹具

**Files:**
- Create: tests/e2e/fixtures/practice.mp4
- Create: tests/e2e/mvp-flow.spec.ts
- Create: tests/e2e/retry-flow.spec.ts
- Create: src/test/fakes/fakeBeatAnalyzer.ts
- Create: src/test/fakes/fakePoseProvider.ts

**Interfaces:**
- Produces: 可注入的固定 BeatAnalyzer 和 PoseProvider。
- 验证: upload → chart → calibrate → challenge → result → retry-check。

- [ ] **Step 1: 写失败的完整流程**

mvp-flow 验证上传、谱面标记、条件式下蹲校准、FULL OUT、DROP LOW、节奏 Combo 和战绩。retry-flow 验证相似机位约 2 秒后直接倒计时，尺度明显变化后回到完整校准。

- [ ] **Step 2: 运行并确认 RED**

Run: npm.cmd run e2e -- tests/e2e/mvp-flow.spec.ts tests/e2e/retry-flow.spec.ts
Expected: 测试注入和流程尚未接通时失败。

- [ ] **Step 3: 接入测试构建依赖注入**

AppDependencies 使用下列唯一签名；生产入口传真实实现，E2E 传固定实现。领域代码不得读取测试环境变量。

~~~ts
export interface AppDependencies {
  beatAnalyzerFactory(): BeatAnalyzer;
  poseProviderFactory(): PoseProvider;
  audioContextFactory(): AudioContext;
  clock: { nowMs(): number };
}
~~~

- [ ] **Step 4: 全量验证并提交**

Run: npm.cmd test
Run: npm.cmd run build
Run: npm.cmd run e2e
Expected: 单元、组件和 Chromium E2E 全部通过。

~~~powershell
git add src/test tests
git commit -m "test: verify the complete dance challenge flow"
~~~

---

# Phase 6：真实设备验收与公开上线

### Task 12: 性能、隐私和 HTTPS 静态部署

**Files:**
- Create: src/telemetry/localPerformanceLog.ts
- Test: src/telemetry/localPerformanceLog.test.ts
- Create: tests/e2e/privacy.spec.ts
- Create: .github/workflows/verify-and-deploy.yml
- Create: README.md
- Modify: vite.config.ts

**Interfaces:**
- Produces: LocalPerformanceSnapshot，仅保存在内存。
- Produces: dist/ 静态产物。

- [ ] **Step 1: 写隐私与资源释放测试**

privacy.spec.ts 监听 page.on("request")；完成上传、校准和挑战后，只允许同源静态资源，断言视频内容、摄像头帧、关键点和校准 JSON 均无出站请求。离开挑战后断言轨道 stop、Worker terminate、Landmarker close、对象地址 revoke。

- [ ] **Step 2: 实现本地性能快照**

记录模型档位、分辨率、推理平均/P95、有效姿态 FPS、丢帧和长任务数；不记录图像、关键点、文件名或身体数据，也不发送网络请求。

- [ ] **Step 3: 配置 CI 和 GitHub Pages**

pull_request 执行 npm ci、npm test、npm run build、npm run e2e；当前默认分支 master 通过后部署 dist。工作流同时声明 main，便于未来改名；Vite base 按仓库名配置，模型与 WASM 使用版本化文件名。

- [ ] **Step 4: 真人验收矩阵**

覆盖不同身高和四肢比例、近远机位、720p/1080p、明暗光线、集显/独显、Chrome/Edge。验证：
1. 校准无需输入数据并在目标时长内完成。
2. 任意单臂伸直命中，提前保持有效，双臂不可见为不可判定。
3. squat 达 85% 命中，关键点不可见为不可判定。
4. 节奏评价不受推理完成时间影响。
5. 相同机位复用，明显变化重校准。
6. 连续三局无摄像头、音频、Worker、对象地址或模型泄漏。

- [ ] **Step 5: 发布前验证**

Run: npm.cmd ci
Run: npm.cmd test
Run: npm.cmd run build
Run: npm.cmd run e2e
Expected: 全部退出 0；dist 含应用、Full/Lite 模型和 WASM；网络面板无用户媒体上传。

- [ ] **Step 6: 提交**

~~~powershell
git add .github README.md vite.config.ts src/telemetry tests/e2e/privacy.spec.ts
git commit -m "ci: verify and deploy fullydancy MVP"
~~~

---

## 阶段闸门

- Phase 1：至少一种 Pose 模型在目标设备达到 P95 ≤ 50ms，否则先调输入分辨率，不扩展功能。
- Phase 2：真实视频能生成可快速确认的稀疏强拍谱面；半拍/双倍问题先调显著度和密度筛选。
- Phase 3：完整校准和 2 秒复核均无需手工身体数据。
- Phase 4：姿态序列夹具证明节奏与动作状态完全独立。
- Phase 5：形成可重复挑战的端到端 MVP。
- Phase 6：隐私、资源释放、真实设备和 HTTPS 部署全部通过后公开发布。

## MVP 验收定义

- 桌面 Chrome/Edge 可上传 15–60 秒本地视频并确认强拍。
- 自动采集身体尺度、四肢比例、个人伸直角和条件式下蹲深度。
- 任意一只可靠手臂在卡点窗口内伸直即 open 命中，保持状态有效。
- 节奏落点决定 Combo；动作失败或不可判定不打断 Combo。
- 再来一局先做约 2 秒复核，机位未变时不重复完整校准。
- 连续三局没有摄像头、音频、Worker、对象地址或模型资源泄漏。
- 视频、摄像头画面、关键点和校准数据没有出站请求。
- 生产构建可通过 HTTPS 静态站点公开访问。

## 执行建议

按 Task 1–12 顺序执行。Task 2、4、6、7、8、11、12 是评审重点，必须检查真实设备证据或领域夹具，不能只凭 UI 演示判断通过。
