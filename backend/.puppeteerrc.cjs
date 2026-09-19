/**
 * Puppeteer configuration file.
 *
 * Redirects the browser cache directory from the default ~/.cache/puppeteer
 * (home directory) to .cache/puppeteer inside the backend project directory.
 *
 * Why this matters on Render:
 *   - During the build phase, `npm install` triggers the `postinstall` script
 *     which runs `puppeteer browsers install chrome`.
 *   - Render's build container writes to /opt/render/project/src/... for the
 *     project directory, which IS available at runtime.
 *   - The home directory cache (~/.cache or /opt/render/.cache) is NOT reliably
 *     available at runtime — it may be wiped between build and container start.
 *   - By pointing cacheDirectory here (inside the project), the downloaded Chrome
 *     binary survives the build→runtime transition and puppeteer.executablePath()
 *     resolves to a path that actually exists when the server starts.
 */
const { join } = require("path");

module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
