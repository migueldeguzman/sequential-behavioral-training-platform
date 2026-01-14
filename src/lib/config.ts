/**
 * Central configuration for API and WebSocket URLs
 * Uses environment variables with localhost fallback for development
 */

// HTTP API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// WebSocket URL - derive from API URL or use separate env var
export const getWebSocketUrl = (path: string = "/ws/profiling"): string => {
  // Allow override via dedicated WebSocket env var
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return `${process.env.NEXT_PUBLIC_WS_URL}${path}`;
  }

  // Otherwise, derive from API_BASE_URL
  // Convert http:// to ws:// and https:// to wss://
  const wsUrl = API_BASE_URL.replace(/^http/, "ws");
  return `${wsUrl}${path}`;
};
