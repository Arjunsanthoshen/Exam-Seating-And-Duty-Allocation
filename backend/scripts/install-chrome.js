/**
 * Dedicated script to install Chrome via Puppeteer CLI directly into the
 * in-project cache directory (backend/.cache/puppeteer).
 *
 * This ensures:
 * 1. The Chrome binary is saved INSIDE the project directory (/opt/render/project/src/backend/.cache/puppeteer),
 *    which survives Render's build-to-runtime container transition.
 * 2. It does not rely on cosmiconfig auto-discovery of .puppeteerrc.cjs.
 * 3. It does not rely on Render dashboard or render.yaml environment variable injection.
 */
const path = require("path");
const { execSync } = require("child_process");

const backendDir = path.resolve(__dirname, "..");
const cacheDir = path.join(backendDir, ".cache", "puppeteer");

console.log(`[Puppeteer Install] Target in-project cache directory: ${cacheDir}`);
process.env.PUPPETEER_CACHE_DIR = cacheDir;

try {
    execSync("npx puppeteer browsers install chrome", {
        cwd: backendDir,
        env: {
            ...process.env,
            PUPPETEER_CACHE_DIR: cacheDir
        },
        stdio: "inherit"
    });
    console.log(`[Puppeteer Install] Chrome successfully installed into: ${cacheDir}`);
} catch (error) {
    console.error("[Puppeteer Install] Failed to install Chrome:", error.message || error);
    process.exit(1);
}
