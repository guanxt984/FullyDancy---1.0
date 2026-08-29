export interface CameraOptions {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  videoConstraints?: MediaTrackConstraints;
}

export interface SharedCameraSession {
  stream: MediaStream;
  attach(video: HTMLVideoElement): Promise<void>;
  detach(video: HTMLVideoElement): void;
  stop(): void;
  isLive(): boolean;
}

// Retained for existing consumers while camera ownership is migrated.
export interface CameraSession extends SharedCameraSession {}

export async function startCamera(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): Promise<SharedCameraSession> {
  const mediaDevices = options.mediaDevices ?? navigator.mediaDevices;
  const videoConstraints = options.videoConstraints ?? { facingMode: "user" };
  const stream = await mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  const attachedVideos = new Set<HTMLVideoElement>();
  let stopped = false;

  const detach = (attachedVideo: HTMLVideoElement) => {
    if (!attachedVideos.delete(attachedVideo)) return;
    attachedVideo.pause();
    if (attachedVideo.srcObject === stream) attachedVideo.srcObject = null;
  };

  const session: SharedCameraSession = {
    stream,
    async attach(attachedVideo) {
      if (stopped) throw new Error("Camera session has been stopped");

      attachedVideo.muted = true;
      attachedVideo.playsInline = true;
      attachedVideo.srcObject = stream;
      attachedVideos.add(attachedVideo);
      try {
        await attachedVideo.play();
      } catch (error) {
        detach(attachedVideo);
        throw error;
      }
    },
    detach,
    stop() {
      if (stopped) return;
      stopped = true;
      [...attachedVideos].forEach(detach);
      stream.getTracks().forEach((track) => track.stop());
    },
    isLive() {
      return stream.getVideoTracks().some((track) => track.readyState === "live");
    },
  };

  try {
    await session.attach(video);
  } catch (error) {
    session.stop();
    throw error;
  }
  return session;
}
