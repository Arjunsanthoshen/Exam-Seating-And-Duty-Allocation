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
  // When running the frontend dev server locally (e.g. localhost:3000), route API calls to Express backend on port 5000
  if (typeof window !== "undefined") {
    if (
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      window.location.port !== "5000"
    ) {
      return "http://localhost:5000";
    }
    // In production single-service deployment, the Express backend serves this page.
    return window.location.origin;
  }
  // SSR / test environments
  return "http://localhost:5000";
}

export const API_BASE_URL = resolveApiBaseUrl();

export default API_BASE_URL;
