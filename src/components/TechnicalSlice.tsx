import { useCallback, useEffect, useRef, useState } from "react";
import { startCamera, type CameraSession } from "../pose/camera";
import { MediaPipePoseProvider } from "../pose/mediaPipePoseProvider";
import { runPoseLoop } from "../pose/poseLoop";

export function TechnicalSlice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const providerRef = useRef<MediaPipePoseProvider | null>(null);
  const loopRef = useRef<(() => void) | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState("???????");

  const stop = useCallback(() => {
    requestRef.current += 1;
    loopRef.current?.();
    loopRef.current = null;
    providerRef.current?.stop();
    providerRef.current = null;
    cameraRef.current?.stop();
    cameraRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    stop();
    const request = requestRef.current;
    setStatus("??????????");
    try {
      const camera = await startCamera(video);
      if (request !== requestRef.current) return camera.stop();
      const provider = new MediaPipePoseProvider();
      await provider.start();
      if (request !== requestRef.current) {
        provider.stop();
        return camera.stop();
      }
      cameraRef.current = camera;
      providerRef.current = provider;
      loopRef.current = runPoseLoop({ video, provider });
      setStatus("??????????20 FPS?Full ???");
    } catch (error) {
      stop();
      setStatus(`????????${error instanceof Error ? error.message : "????"}`);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return (
    <section aria-labelledby="technical-slice-title">
      <h2 id="technical-slice-title">?????????</h2>
      <p>{status}</p>
      <video ref={videoRef} data-testid="camera-preview" aria-label="?????" muted playsInline />
      <button type="button" onClick={() => void start()}>?????????</button>
      <button type="button" onClick={stop}>????????</button>
    </section>
  );
}
