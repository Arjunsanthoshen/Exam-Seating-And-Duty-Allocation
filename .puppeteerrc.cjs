/**
 * Root Puppeteer configuration file.
 *
 * Directs Puppeteer's cache directory to backend/.cache/puppeteer
 * when tools or processes run from the repository root.
 */
const { join } = require("path");

module.exports = {
  cacheDirectory: join(__dirname, "backend", ".cache", "puppeteer"),
};
