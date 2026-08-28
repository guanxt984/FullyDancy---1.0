import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const DURATION_SEC = 13;
const OUTPUT_PATH = join(process.cwd(), "src", "levels", "assets", "level-1.pose.json");

function validateGeneratedPoseCache(value) {
  if (!Array.isArray(value) || value.length < 100) {
    throw new Error(`Generated pose cache must contain at least 100 frames; received ${value?.length ?? 0}`);
  }

  let previous = -1;
  for (const frame of value) {
    if (typeof frame?.captureTimeSec !== "number" || frame.captureTimeSec < previous) {
      throw new Error("Generated pose frames must be ordered");
    }
    if (!Array.isArray(frame.landmarks) || frame.landmarks.length !== 33) {
      throw new Error("Generated pose frame must contain 33 landmarks");
    }
    previous = frame.captureTimeSec;
  }

  if (value[0].captureTimeSec !== 0 || previous < DURATION_SEC - 0.1) {
    throw new Error("Generated pose cache must cover the complete level duration");
  }

  return value;
}

let server;
let browser;

try {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not bind to a TCP port");

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Executable doesn't exist")) throw error;
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });

  const poseCache = validateGeneratedPoseCache(await page.evaluate(async ({ videoUrl, durationSec }) => {
    const { extractDemoPoseCache } = await import("/src/analysis/demoPoseCache.ts");
    return extractDemoPoseCache(videoUrl, durationSec);
  }, { videoUrl: "/levels/level-1.mp4", durationSec: DURATION_SEC }));

  await writeFile(OUTPUT_PATH, `${JSON.stringify(poseCache, null, 2)}\n`, "utf8");
  console.log(`Generated ${poseCache.length} pose frames from 0s to ${poseCache.at(-1).captureTimeSec}s.`);
} finally {
  try {
    await browser?.close();
  } finally {
    await server?.close();
  }
}
