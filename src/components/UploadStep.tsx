import { useEffect, useRef, useState } from "react";
import {
  createVideoAsset,
  releaseVideoAsset,
  type VideoAsset,
} from "../media/videoAsset";

interface UploadStepProps {
  onAssetReady?: (asset: VideoAsset) => void;
}

export function UploadStep({ onAssetReady }: UploadStepProps) {
  const activeAssetRef = useRef<VideoAsset | null>(null);
  const requestRef = useRef(0);
  const [asset, setAsset] = useState<VideoAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    requestRef.current += 1;
    if (activeAssetRef.current) releaseVideoAsset(activeAssetRef.current);
  }, []);

  async function selectFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setError(null);

    try {
      const nextAsset = await createVideoAsset(file);
      if (request !== requestRef.current) {
        releaseVideoAsset(nextAsset);
        return;
      }
      if (activeAssetRef.current) releaseVideoAsset(activeAssetRef.current);
      activeAssetRef.current = null;
      if (onAssetReady) {
        try {
          onAssetReady(nextAsset);
        } catch (reason) {
          releaseVideoAsset(nextAsset);
          throw reason;
        }
      } else {
        activeAssetRef.current = nextAsset;
      }
      setAsset(nextAsset);
    } catch (reason) {
      if (request === requestRef.current) {
        setError(reason instanceof Error ? reason.message : "无法加载该视频");
      }
    }
  }

  return (
    <section aria-labelledby="upload-step-title">
      <h2 id="upload-step-title">上传练习视频</h2>
      <p>视频仅在此设备上处理，不会上传。</p>
      <label>
        选择练习视频
        <input
          accept="video/*"
          aria-label="选择练习视频"
          type="file"
          onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
        />
      </label>
      {asset ? <p>{asset.file.name}（{asset.durationSec.toFixed(1)} 秒）</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
