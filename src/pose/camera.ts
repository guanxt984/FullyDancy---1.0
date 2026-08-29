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
  const attachmentGenerations = new Map<HTMLVideoElement, number>();
  let nextAttachmentGeneration = 0;
  let stopped = false;

  const detach = (attachedVideo: HTMLVideoElement) => {
    if (attachedVideo.srcObject !== stream) {
      attachedVideos.delete(attachedVideo);
      attachmentGenerations.delete(attachedVideo);
      return;
    }
    if (!attachedVideos.delete(attachedVideo)) return;
    attachmentGenerations.delete(attachedVideo);
    attachedVideo.pause();
    attachedVideo.srcObject = null;
  };

  const session: SharedCameraSession = {
    stream,
    async attach(attachedVideo) {
      if (stopped) throw new Error("Camera session has been stopped");

      attachedVideo.muted = true;
      attachedVideo.playsInline = true;
      attachedVideo.srcObject = stream;
      attachedVideos.add(attachedVideo);
      const attachmentGeneration = ++nextAttachmentGeneration;
      attachmentGenerations.set(attachedVideo, attachmentGeneration);
      try {
        await attachedVideo.play();
      } catch (error) {
        if (
          attachmentGenerations.get(attachedVideo) === attachmentGeneration
          && attachedVideo.srcObject === stream
        ) {
          detach(attachedVideo);
        }
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
