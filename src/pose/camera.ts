export interface CameraEnvironment {
  mediaDevices: Pick<MediaDevices, "getUserMedia">;
}
export interface CameraSession { stream: MediaStream; stop(): void; }

export async function startCamera(
  video: HTMLVideoElement,
  environment: CameraEnvironment = { mediaDevices: navigator.mediaDevices },
): Promise<CameraSession> {
  const stream = await environment.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return {
    stream,
    stop() {
      video.pause();
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}
