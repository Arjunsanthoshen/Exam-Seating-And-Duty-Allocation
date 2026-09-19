/**
 * Centralized API Configuration
 *
 * Resolution order:
 *  1. REACT_APP_API_URL build-time env var (explicit override)
 *  2. window.location.origin — same-origin for single-service Render deployment
 *  3. http://localhost:5000 — local development fallback
 */

function resolveApiBaseUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, "");
  }
  // In the browser: same-origin means the Express backend is serving this page.
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR / test environments
  return "http://localhost:5000";
}

export const API_BASE_URL = resolveApiBaseUrl();

export default API_BASE_URL;
