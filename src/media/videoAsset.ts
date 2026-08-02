export interface VideoAsset {
  file: File;
  objectUrl: string;
  durationSec: number;
}

export interface VideoMetadata {
  durationSec: number;
}

export type VideoMetadataLoader = (objectUrl: string) => Promise<VideoMetadata>;

export class UnsupportedVideoFormatError extends Error {
  constructor() {
    super("请选择视频文件");
    this.name = "UnsupportedVideoFormatError";
  }
}

export class VideoDurationOutOfRangeError extends Error {
  constructor() {
    super("请选择 15–60 秒的视频");
    this.name = "VideoDurationOutOfRangeError";
  }
}

function readVideoMetadata(objectUrl: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanUp = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
    const onLoadedMetadata = () => {
      const durationSec = video.duration;
      cleanUp();
      resolve({ durationSec });
    };
    const onError = () => {
      cleanUp();
      reject(new Error("无法读取视频元数据"));
    };

    video.preload = "metadata";
    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = objectUrl;
  });
}

export async function createVideoAsset(
  file: File,
  metadataLoader: VideoMetadataLoader = readVideoMetadata,
): Promise<VideoAsset> {
  if (!file.type.startsWith("video/")) throw new UnsupportedVideoFormatError();

  const objectUrl = URL.createObjectURL(file);
  try {
    const { durationSec } = await metadataLoader(objectUrl);
    if (!Number.isFinite(durationSec) || durationSec < 15 || durationSec > 60) {
      throw new VideoDurationOutOfRangeError();
    }
    return { file, objectUrl, durationSec };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function releaseVideoAsset(asset: VideoAsset): void {
  URL.revokeObjectURL(asset.objectUrl);
}
