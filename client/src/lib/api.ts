import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';

interface RetryQueueItem {
  resolve: (value?: unknown) => void;
  reject: (error?: unknown) => void;
}

let isRefreshing = false;
let failedQueue: RetryQueueItem[] = [];

function processQueue(error: Error | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Double-submission protection: deduplicate identical mutating requests
const inFlightMutations = new Map<string, Promise<any>>();
const recentMutations = new Map<string, { time: number; response: any }>();

const rawRequest = api.request.bind(api);

(api as any).request = function (config: any): Promise<any> {
  const method = (config.method || 'get').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Skip auth login/refresh or read-only requests
  if (!isMutation || config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh')) {
    return rawRequest(config);
  }

  const signature = `${method}:${config.url || ''}:${JSON.stringify(config.data ?? {})}`;

  // If identical mutation is already in-flight, return the existing active promise
  if (inFlightMutations.has(signature)) {
    return inFlightMutations.get(signature)!;
  }

  // If identical mutation completed less than 1200ms ago, return recent response to avoid duplicate insert
  const recent = recentMutations.get(signature);
  if (recent && Date.now() - recent.time < 1200) {
    return Promise.resolve(recent.response);
  }

  const promise = rawRequest(config)
    .then((res: any) => {
      recentMutations.set(signature, { time: Date.now(), response: res });
      setTimeout(() => {
        recentMutations.delete(signature);
      }, 1500);
      return res;
    })
    .finally(() => {
      inFlightMutations.delete(signature);
    });

  inFlightMutations.set(signature, promise);
  return promise;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<{ data: { accessToken: string; user: unknown } }>(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
