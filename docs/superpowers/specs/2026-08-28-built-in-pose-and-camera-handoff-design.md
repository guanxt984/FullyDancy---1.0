# FullyDancy 内置骨架与摄像头会话移交设计

## 目标

- 示例舞蹈骨架作为产品内置资产发布，用户进入分析或挑战时不再现场运行示范视频姿态提取。
- 摄像头只在校准页申请一次权限；校准完成后，同一个媒体流移交给挑战页使用。
- 挑战页不再次调用 `getUserMedia()`。没有可用摄像头流时，提示用户返回校准开启摄像头。

## 非目标

- 本轮不改变音乐、卡点分析算法、校准动作判定或手势定义。
- 本轮不为用户上传视频生成持久化骨架资产；内置资产只覆盖内置关卡。
- 不使用 Service Worker、IndexedDB 或运行时后台预热替代真正的内置文件。

## 内置骨架资产

为关卡 1 增加版本化 JSON 文件，例如 `src/levels/assets/level-1.pose.json`。文件内容符合 `DemoPoseCache`：每帧包含 `captureTimeSec`、33 个归一化 landmarks，并可包含 world landmarks。

该文件由一次性的开发脚本从 `public/levels/level-1.mp4` 生成并提交到仓库。运行时通过静态 import 随应用构建，不发起姿态模型初始化，也不等待视频 seek 或 MediaPipe 扫描。

`BuiltInLevel` 增加 `poseCache` 字段。`AnalysisScreen` 使用该缓存生成动作建议与确认结果；`ChallengeScreen` 直接使用同一缓存渲染骨架。内置关卡运行路径移除 `extractDemoPoseCache` fallback、加载状态和“重试示范骨架”入口。

## 摄像头所有权

新增与 DOM 元素解耦的摄像头句柄：

```ts
interface SharedCameraSession {
  stream: MediaStream;
  attach(video: HTMLVideoElement): Promise<void>;
  detach(video: HTMLVideoElement): void;
  stop(): void;
}
```

`startCamera()` 仍是唯一调用 `getUserMedia()` 的入口，但返回的 session 不再永久绑定校准页的 `<video>`。`attach()` 将现有 stream 设置为目标视频的 `srcObject` 并播放，`detach()` 只断开当前视频，不停止 tracks，`stop()` 才停止全部 tracks。

所有权状态位于 `App`：

1. 校准页启动时申请摄像头并拥有 session。
2. 校准完成时通过 `onComplete(profile, cameraSession)` 把 session 移交给 App；组件卸载只 detach，不 stop 已移交的 session。
3. 用户在已取得摄像头后点击“跳过”，同样移交 session；如果摄像头尚未取得，则取消当前启动，挑战页进入无摄像头状态。
4. 挑战页接收 session 并 attach 到挑战视频，不调用 `getUserMedia()`。
5. 返回校准时，挑战页 detach；App 保留 session 供校准页重新 attach。
6. App 卸载或 session 被替换时，App 调用 `stop()`，确保 tracks 最终释放。

为避免 StrictMode 与异步乱序破坏所有权，移交使用显式 owner/token。旧 run 晚到只能停止自己的 session，不能覆盖或停止 App 当前持有的 session。

## 页面行为

### 分析页

- 卡点分析完成后立即使用内置 pose cache，不显示“正在提取示范骨架”。
- 确认结果始终携带内置 cache。
- 用户跳过分析时，App 使用默认 chart 和内置 cache。

### 校准页

- 页面加载即申请摄像头权限并显示预览。
- 完成或跳过时，已有 session 被移交；不停止摄像头 tracks。
- 权限拒绝时显示校准页错误与重试按钮。

### 挑战页

- 说明卡出现时示范骨架已经可以直接显示。
- 点击“开始舞蹈”只启动音乐、姿态模型和对已有摄像头流的识别，不申请权限。
- 若无 session，说明卡保留，但主操作提示返回校准开启摄像头；不触发第二次权限请求。
- 播放、暂停、重新开始手势及备用按钮行为保持不变。

## 错误处理

- 内置骨架 JSON 在构建期进行结构校验；缺失或格式错误使测试/构建失败，不退回运行时提取。
- session attach 播放失败与摄像头权限失败分开显示。
- 已结束的 MediaStreamTrack 视为不可用，挑战页提示返回校准重新开启。
- 任意卸载、返回、重试和 StrictMode 重放都必须保持 session 单一所有者并避免重复 stop。

## 测试与验收

- 资产测试：帧按时间升序、覆盖关卡时长、每帧 landmark 数量正确、可在首屏同步读取。
- Analysis 测试：不调用 `extractDemoPoseCache`，确认与跳过都交付内置 cache。
- Camera 单元测试：同一 stream 可从校准 video detach 后 attach 到挑战 video；只有 `stop()` 停止 tracks。
- App 集成测试：正常校准到挑战全流程只调用一次 `getUserMedia()`；session 被传给真实挑战组件。
- Calibration 竞态测试：完成、跳过、权限 pending、StrictMode 乱序下移交与清理正确。
- Challenge 测试：不再接受现场 pose extractor；有 session 时不调用 camera starter；无 session 时不请求权限并给出返回校准入口。
- 浏览器验收：首次权限提示发生在校准页；挑战页无第二次提示；摄像头预览正常；骨架无需等待即可出现；桌面和移动端仍保持全高布局。

