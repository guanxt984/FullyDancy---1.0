import { afterEach, describe, expect, it, vi } from "vitest";
import "../test/urlObjectUrl";
import {
  createVideoAsset,
  releaseVideoAsset,
  type VideoMetadataLoader,
} from "./videoAsset";

const objectUrl = "blob:practice";

function fakeVideoFile(type = "video/mp4"): File {
  return new File(["local-video"], "practice.mp4", { type });
}

function fakeMetadata(durationSec: number): VideoMetadataLoader {
  return async () => ({ durationSec });
}

afterEach(() => vi.restoreAllMocks());

describe("createVideoAsset", () => {
  it("rejects a non-video file before creating a local URL", async () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");

    await expect(createVideoAsset(fakeVideoFile("audio/mpeg")))
      .rejects.toThrow("请选择视频文件");

    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it.each([14.99, 60.01])("rejects %s seconds", async (durationSec) => {
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
    vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);

    await expect(createVideoAsset(fakeVideoFile(), fakeMetadata(durationSec)))
      .rejects.toThrow("请选择 15–60 秒的视频");

    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl);
  });

  it("returns a local asset for a video within the allowed duration", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);

    await expect(createVideoAsset(fakeVideoFile(), fakeMetadata(15)))
      .resolves.toMatchObject({ file: expect.any(File), objectUrl, durationSec: 15 });
  });
});

describe("releaseVideoAsset", () => {
  it("revokes the object URL", () => {
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

    releaseVideoAsset({ file: fakeVideoFile(), objectUrl, durationSec: 30 });

    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl);
  });
});
