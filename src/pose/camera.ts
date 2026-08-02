export interface CameraOptions {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  videoConstraints?: MediaTrackConstraints;
}
export interface CameraSession { stream: MediaStream; stop(): void; }

export async function startCamera(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): Promise<CameraSession> {
  const mediaDevices = options.mediaDevices ?? navigator.mediaDevices;
  const videoConstraints = options.videoConstraints ?? { facingMode: "user" };
  const stream = await mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  try {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw error;
  }
  return {
    stream,
    stop() {
      video.pause();
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}
