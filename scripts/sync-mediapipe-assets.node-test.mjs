import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { syncMediaPipeAssets } from "./sync-mediapipe-assets.mjs";

test("syncMediaPipeAssets writes versioned models and every supplied WASM file", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullydancy-assets-"));
  const responses = new Map([
    [
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      new Uint8Array([1, 2, 3]),
    ],
    [
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      new Uint8Array([4, 5, 6]),
    ],
  ]);

  try {
    await syncMediaPipeAssets({
      root,
      fetchAsset: async (url) => responses.get(url),
      wasmFiles: new Map([["vision_wasm_internal.wasm", new Uint8Array([7, 8])]]),
    });

    assert.deepEqual(
      [...await readFile(join(root, "public/models/pose_landmarker_full-v1.task"))],
      [1, 2, 3],
    );
    assert.deepEqual(
      [...await readFile(join(root, "public/models/pose_landmarker_lite-v1.task"))],
      [4, 5, 6],
    );
    assert.deepEqual(
      [...await readFile(join(root, "public/wasm/vision_wasm_internal.wasm"))],
      [7, 8],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
