import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODELS = [
  {
    fileName: "pose_landmarker_full-v1.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  },
  {
    fileName: "pose_landmarker_lite-v1.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
];

async function downloadedAsset(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function syncMediaPipeAssets({
  root = process.cwd(),
  fetchAsset = downloadedAsset,
  wasmFiles,
} = {}) {
  const modelsDirectory = join(root, "public", "models");
  const wasmDirectory = join(root, "public", "wasm");
  await mkdir(modelsDirectory, { recursive: true });
  await mkdir(wasmDirectory, { recursive: true });

  for (const model of MODELS) {
    await writeFile(join(modelsDirectory, model.fileName), await fetchAsset(model.url));
  }

  if (wasmFiles) {
    for (const [fileName, contents] of wasmFiles) {
      await writeFile(join(wasmDirectory, fileName), contents);
    }
    return;
  }

  const packageWasmDirectory = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
  for (const fileName of await readdir(packageWasmDirectory)) {
    await cp(join(packageWasmDirectory, fileName), join(wasmDirectory, fileName));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncMediaPipeAssets().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
