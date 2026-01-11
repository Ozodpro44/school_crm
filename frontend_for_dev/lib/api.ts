import axios, { AxiosInstance, AxiosError } from "axios";
import { useAuthStore, useAPIStore } from "./store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

let apiClient: AxiosInstance;

export function initializeAPI(): AxiosInstance {
  if (apiClient) return apiClient;

  apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
  });

  // Request interceptor
  apiClient.interceptors.request.use((config) => {
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token.value}`;
    }
    return config;
  });

  // Response interceptor
  apiClient.interceptors.response.use(
    (response) => {
      const startTime = performance.now();
      const responseTime = Math.round(performance.now() - startTime);

      useAPIStore.getState().addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        method: response.config.method?.toUpperCase() || "GET",
        endpoint: response.config.url || "",
        status: response.status,
        responseTime,
        requestBody:
          typeof response.config.data === "string"
            ? response.config.data
            : JSON.stringify(response.config.data),
        responseBody: JSON.stringify(response.data),
      });

      return response;
    },
    (error: AxiosError) => {
      const responseTime = Math.round(
        (error.response?.config.metadata?.endTime || Date.now()) -
          (error.response?.config.metadata?.startTime || Date.now())
      );

      useAPIStore.getState().addLog({
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        method: error.config?.method?.toUpperCase() || "GET",
        endpoint: error.config?.url || "",
        status: error.response?.status,
        responseTime,
        requestBody:
          typeof error.config?.data === "string"
            ? error.config.data
            : JSON.stringify(error.config?.data),
        responseBody: JSON.stringify(error.response?.data),
      });

      return Promise.reject(error);
    }
  );

  return apiClient;
}

export function getAPI(): AxiosInstance {
  if (!apiClient) {
    initializeAPI();
  }
  return apiClient;
}
