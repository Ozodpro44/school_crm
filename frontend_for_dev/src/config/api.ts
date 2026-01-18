/**
 * API Configuration
 */

export const API_CONFIG = {
  // Backend API
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  
  // Railway configuration
  railwayApiKey: import.meta.env.VITE_RAILWAY_API_KEY,
  railwayProjectId: import.meta.env.VITE_RAILWAY_PROJECT_ID,
  
  // Feature flags
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
  showLogsPanel: import.meta.env.VITE_SHOW_LOGS_PANEL === 'true',
  debugApi: import.meta.env.VITE_DEBUG_API === 'true',
} as const;

/**
 * Check if API is ready to use
 */
export function isApiReady(): boolean {
  return !!API_CONFIG.baseUrl;
}

/**
 * Check if Railway logging is configured
 */
export function isRailwayConfigured(): boolean {
  return !!API_CONFIG.railwayApiKey && !!API_CONFIG.railwayProjectId;
}
