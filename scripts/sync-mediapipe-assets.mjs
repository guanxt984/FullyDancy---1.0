import { cp, mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function replaceAssetTrees({
  modelsDirectory,
  wasmDirectory,
  stagedModelsDirectory,
  stagedWasmDirectory,
  stagingRoot,
}) {
  const backupDirectory = join(stagingRoot, "previous");
  const backupModelsDirectory = join(backupDirectory, "models");
  const backupWasmDirectory = join(backupDirectory, "wasm");
  await mkdir(backupDirectory, { recursive: true });
  let modelsBackedUp = false;
  let wasmBackedUp = false;
  let modelsInstalled = false;
  let wasmInstalled = false;

  try {
    if (await pathExists(modelsDirectory)) {
      await rename(modelsDirectory, backupModelsDirectory);
      modelsBackedUp = true;
    }
    if (await pathExists(wasmDirectory)) {
      await rename(wasmDirectory, backupWasmDirectory);
      wasmBackedUp = true;
    }
    await rename(stagedModelsDirectory, modelsDirectory);
    modelsInstalled = true;
    await rename(stagedWasmDirectory, wasmDirectory);
    wasmInstalled = true;
  } catch (error) {
    const rollbackErrors = [];
    try {
      if (modelsInstalled) await rm(modelsDirectory, { recursive: true, force: true });
      if (wasmInstalled) await rm(wasmDirectory, { recursive: true, force: true });
      if (modelsBackedUp) await rename(backupModelsDirectory, modelsDirectory);
      if (wasmBackedUp) await rename(backupWasmDirectory, wasmDirectory);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], "MediaPipe asset replacement and rollback failed");
    }
    throw error;
  }
}

export async function syncMediaPipeAssets({
  root = process.cwd(),
  packageRoot = root,
  fetchAsset = downloadedAsset,
  wasmFiles,
} = {}) {
  const publicDirectory = join(root, "public");
  const modelsDirectory = join(publicDirectory, "models");
  const wasmDirectory = join(publicDirectory, "wasm");
  await mkdir(publicDirectory, { recursive: true });
  const stagingRoot = await mkdtemp(join(publicDirectory, ".mediapipe-assets-"));
  const stagedModelsDirectory = join(stagingRoot, "models");
  const stagedWasmDirectory = join(stagingRoot, "wasm");

  try {
    await mkdir(stagedModelsDirectory, { recursive: true });
    await mkdir(stagedWasmDirectory, { recursive: true });

    for (const model of MODELS) {
      await writeFile(join(stagedModelsDirectory, model.fileName), await fetchAsset(model.url));
    }

    if (wasmFiles) {
      for (const [fileName, contents] of wasmFiles) {
        await writeFile(join(stagedWasmDirectory, fileName), contents);
      }
    } else {
      const packageWasmDirectory = join(packageRoot, "node_modules", "@mediapipe", "tasks-vision", "wasm");
      for (const fileName of await readdir(packageWasmDirectory)) {
        await cp(
          join(packageWasmDirectory, fileName),
          join(stagedWasmDirectory, fileName),
          { recursive: true },
        );
      }
    }

    await replaceAssetTrees({
      modelsDirectory,
      wasmDirectory,
      stagedModelsDirectory,
      stagedWasmDirectory,
      stagingRoot,
    });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncMediaPipeAssets().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
