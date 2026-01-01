// src/config.js

// Environment configuration
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNgrok = window.location.hostname.includes('ngrok-free.app');

// Base URL configuration
export const API_BASE_URL = (() => {
  if (isNgrok) {
    return '/api'; // Will be proxied by Vite
  }
  return 'http://localhost:8000';
})();

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  USER: (userId) => `/user/${userId}`,
  // Add other endpoints as needed
};

// Default headers for API requests
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  // Required for ngrok free tier
  'ngrok-skip-browser-warning': 'true'
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  // Ensure endpoint starts with a forward slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};

// WebSocket URL (if needed)
export const WS_URL = API_BASE_URL.replace('http', 'ws');

// Debug information
console.log('API Configuration:', {
  hostname: window.location.hostname,
  isLocalhost,
  isNgrok,
  API_BASE_URL,
  WS_URL
});