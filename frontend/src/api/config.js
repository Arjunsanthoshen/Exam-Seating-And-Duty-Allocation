/**
 * Centralized API Configuration
 * Supports production Render deployment via REACT_APP_API_URL
 * Defaults to http://localhost:5000 for local development
 */

export const API_BASE_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export default API_BASE_URL;
