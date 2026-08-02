// src/config.js

// Base URL configuration.
// Shared over ngrok, the backend isn't reachable at localhost from a visitor's
// browser, so calls go to /api and Vite proxies them through the tunnel.
const isNgrok = window.location.hostname.includes('ngrok-free.app');

export const API_BASE_URL = isNgrok ? '/api' : 'http://localhost:8000';

// Default headers for API requests
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  // Required for ngrok free tier
  'ngrok-skip-browser-warning': 'true'
};

// URL building and requests live in src/lib/api.js — this file only decides
// where the backend is. (Removed: getApiUrl and API_ENDPOINTS, superseded by
// the api client; WS_URL, which nothing ever used — there is no WebSocket.)