# Dance Rhythm Game MVP Design

## Summary

The product is a personal web-based dance rhythm practice game. A user uploads a dance video, the system quickly turns it into a playable challenge, and the user dances in front of a computer webcam while receiving real-time rhythm and pose feedback.

The first version prioritizes fun, repeatable practice over professional-grade dance coaching. Its core promise is:

> Upload a dance video, generate a challenge, dance with strong game feedback, review your result, and try again.

## Target User

The first version serves dance enthusiasts who practice alone by following videos. They are not creating public courses or social challenges. They want a faster, more motivating way to practice framework, pose timing, and crispness while dancing in front of a computer screen.

## Product Positioning

This is a personal dance rhythm game, not a creator marketplace, teacher platform, or professional judging system.

The experience should feel closer to a computer-based dance arcade or rhythm game than a homework correction tool. Professional feedback exists, but it supports the game loop rather than dominating it.

## Core User Loop

1. Upload a dance video.
2. The system detects beats, motion changes, and candidate key poses.
3. The user confirms a small set of key checkpoints.
4. The user completes a short body and camera calibration.
5. The user starts the challenge.
6. The app gives strong real-time feedback for timing, combo, energy, and key pose hits.
7. The app shows a post-run result card with score, best sections, and weak sections.
8. The user retries the full challenge or loops a weak section.

## MVP Scope

### Included

- Local video upload.
- Automatic beat and checkpoint generation.
- Simple checkpoint confirmation.
- Webcam-based full-body practice.
- Short body and camera calibration.
- Real-time timing feedback.
- Real-time key pose feedback.
- Combo, energy, fever, and high-impact visual feedback.
- Post-run result card.
- One-click retry.
- Weak-section loop practice.

### Not Included

- Public sharing.
- Leaderboards.
- Multiplayer or live competition.
- Teacher course marketplace.
- Professional frame-by-frame judging.
- Complex manual chart editing.
- Detailed support for all dance styles.
- Fine judging of hands, feet, facial expression, or texture.

## Challenge Generation

After a user uploads a video, the system generates a playable challenge that is good enough to start quickly. It does not need to produce a perfect chart.

The generator should prioritize:

- Strong music beats.
- Visible pose holds.
- Arm extension peaks.
- Squat or low-center moments.
- Direction changes.
- Turn or torso-angle changes.
- End points of fast contraction or release movements.

The app should present generated checkpoints as lightweight confirmations. The user should not edit angles, coordinates, or thresholds directly.

Example labels:

- Arm open.
- Squat low.
- Hold the pose.
- Hit fast.
- Turn body.
- Lock frame.

## Checkpoint Model

Each checkpoint describes the dance intent, not a fixed screen coordinate.

Minimum checkpoint fields:

- `time`: target timestamp in the uploaded video.
- `beat`: optional beat index if beat tracking is available.
- `label`: user-facing checkpoint label.
- `bodyTargets`: relevant body areas, such as arms, shoulders, hips, knees, or center of mass.
- `intent`: movement goal, such as extension, squat, hold, turn, or fast arrival.
- `timingWindowMs`: acceptable hit window.
- `strictness`: loose, standard, or strict.
- `feedback`: success and miss feedback text or visual effect.

Example:

```json
{
  "time": 18.4,
  "beat": 32,
  "label": "Arm open",
  "bodyTargets": ["rightArm", "shoulders"],
  "intent": "extension",
  "timingWindowMs": 120,
  "strictness": "standard",
  "feedback": {
    "hit": "Pose Lock",
    "miss": "Arm not open"
  }
}
```

## Body Calibration

The product must not judge by absolute screen position. Height, arm length, camera angle, and distance from the computer all affect raw coordinates.

Before the first challenge, the user completes a short 10-20 second calibration:

1. Stand fully in frame.
2. Hold a neutral standing pose.
3. Open both arms.
4. Perform a natural squat.
5. Return to standing.

The calibration estimates:

- Body scale in camera frame.
- Shoulder width.
- Approximate arm span.
- Standing hip height.
- Natural squat depth.
- Camera framing quality.
- Whether the full body is visible.

The app should show clear blocking guidance only when needed, such as when the user is partially out of frame or too close to the camera.

## Relative Judging

Pose checks use relative body measurements rather than screen coordinates.

Examples:

- Arm extension checks wrist-to-shoulder distance, elbow angle, and shoulder alignment relative to the user's calibrated body.
- Squat depth checks hip height relative to the user's standing hip height and natural squat range.
- Frame openness checks shoulder, elbow, wrist, and hip angles.
- Body tilt checks shoulder line, hip line, and torso axis.
- Pose timing checks when the target pose appears relative to the beat or checkpoint timestamp.

This makes the challenge more fair across different bodies and room setups.

## Real-Time Challenge Feedback

The challenge screen should provide strong, immediate feedback without overwhelming the dancer.

Primary real-time elements:

- Timing judgment: Perfect, Great, Early, Late, Miss.
- Combo count.
- Energy or fever meter.
- Pose Lock feedback for framework checkpoints.
- Short miss prompts, such as "late", "arm not open", or "go lower".
- Stage-like visual effects on strong hits.

Real-time feedback must be short and visceral. It should reward good moments more loudly than it criticizes bad moments.

## Post-Run Review

After a challenge, the app shows a result card focused on replay motivation.

The result card includes:

- Grade: S, A, B, or C.
- Total score.
- Highest combo.
- Timing accuracy.
- Framework hit rate.
- Best 8-count section.
- Weakest 8-count section.
- Retry full challenge.
- Practice weak section.

The review should avoid long coaching essays. It should help the user decide what to try next.

## UX Principles

- Start playing quickly.
- Keep editing lightweight.
- Make correct movement feel exciting.
- Use short feedback during dancing.
- Save detailed analysis for after the run.
- Prefer personal progress over public comparison.
- Treat judging as adaptive, not absolute.

## First Release Success Criteria

The MVP is successful if a user can:

- Upload a dance video and generate a playable challenge within a few minutes.
- Complete webcam calibration without expert help.
- Dance a challenge with visible real-time rhythm and pose feedback.
- Understand whether they were early, late, or off-frame on key moments.
- See a result card that motivates one more attempt.
- Retry the full challenge or practice a weak section immediately.

## Open Product Decisions

The approved first version intentionally leaves these questions for later:

- Which pose-estimation model should power the webcam pipeline.
- Whether beat detection runs entirely in browser or with a backend service.
- How saved challenges are stored.
- Whether future versions support sharing or creator-made public challenges.
- Which dance style receives the first optimized feedback presets.
