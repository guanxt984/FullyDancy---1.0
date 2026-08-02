import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { syncMediaPipeAssets } from "./sync-mediapipe-assets.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function modelFetch(seed) {
  let modelIndex = 0;
  return async () => new Uint8Array([seed, modelIndex += 1]);
}

async function temporaryRoot() {
  return mkdtemp(join(tmpdir(), "fullydancy-assets-"));
}

async function expectMissing(path) {
  await assert.rejects(access(path), (error) => error?.code === "ENOENT");
}

test("syncMediaPipeAssets writes versioned models and every supplied WASM file", async () => {
  const root = await temporaryRoot();

  try {
    await syncMediaPipeAssets({
      root,
      fetchAsset: modelFetch(1),
      wasmFiles: new Map([[
        "vision_wasm_internal.wasm",
        new Uint8Array([7, 8]),
      ]]),
    });

    assert.deepEqual(
      [...await readFile(join(root, "public/models/pose_landmarker_full-v1.task"))],
      [1, 1],
    );
    assert.deepEqual(
      [...await readFile(join(root, "public/models/pose_landmarker_lite-v1.task"))],
      [1, 2],
    );
    assert.deepEqual(
      [...await readFile(join(root, "public/wasm/vision_wasm_internal.wasm"))],
      [7, 8],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("syncMediaPipeAssets copies the complete WASM tree from the installed package", async () => {
  const root = await temporaryRoot();
  const source = join(projectRoot, "node_modules", "@mediapipe", "tasks-vision", "wasm");

  try {
    await syncMediaPipeAssets({ root, packageRoot: projectRoot, fetchAsset: modelFetch(2) });

    const expectedFiles = (await readdir(source)).sort();
    const actualFiles = (await readdir(join(root, "public", "wasm"))).sort();
    assert.deepEqual(actualFiles, expectedFiles);
    for (const fileName of expectedFiles) {
      assert.equal(
        (await stat(join(root, "public", "wasm", fileName))).size,
        (await stat(join(source, fileName))).size,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("syncMediaPipeAssets replaces the previous complete tree on repeated runs", async () => {
  const root = await temporaryRoot();

  try {
    await syncMediaPipeAssets({
      root,
      fetchAsset: modelFetch(3),
      wasmFiles: new Map([["old.wasm", new Uint8Array([3])]]),
    });
    await syncMediaPipeAssets({
      root,
      fetchAsset: modelFetch(4),
      wasmFiles: new Map([["new.wasm", new Uint8Array([4])]]),
    });

    assert.deepEqual(
      [...await readFile(join(root, "public", "models", "pose_landmarker_full-v1.task"))],
      [4, 1],
    );
    assert.deepEqual([...await readFile(join(root, "public", "wasm", "new.wasm"))], [4]);
    await expectMissing(join(root, "public", "wasm", "old.wasm"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("syncMediaPipeAssets preserves previous assets when preparation fails mid-run", async () => {
  const root = await temporaryRoot();
  const models = join(root, "public", "models");
  const wasm = join(root, "public", "wasm");
  await mkdir(models, { recursive: true });
  await mkdir(wasm, { recursive: true });
  await writeFile(join(models, "previous.task"), new Uint8Array([8]));
  await writeFile(join(wasm, "previous.wasm"), new Uint8Array([9]));
  let attempt = 0;

  try {
    await assert.rejects(
      syncMediaPipeAssets({
        root,
        fetchAsset: async () => {
          attempt += 1;
          if (attempt === 2) throw new Error("injected model failure");
          return new Uint8Array([1]);
        },
        wasmFiles: new Map([["replacement.wasm", new Uint8Array([2])]]),
      }),
      /injected model failure/,
    );

    assert.deepEqual([...await readFile(join(models, "previous.task"))], [8]);
    assert.deepEqual([...await readFile(join(wasm, "previous.wasm"))], [9]);
    await expectMissing(join(models, "pose_landmarker_full-v1.task"));
    await expectMissing(join(wasm, "replacement.wasm"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
