import axios from 'axios';
import type { Router } from 'vue-router';

let routerInstance: Router | null = null;
let accessToken: string | null = null;
// 用依賴注入取代 import 避免循環依賴
export function injectRouter(router: Router) {
  routerInstance = router;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/refresh',
  '/auth/logout',
];

function isAuthEndpoint(url?: string): boolean {
  return AUTH_ENDPOINTS.some((path) => url === path || url?.startsWith(`${path}?`));
}
// 用 Queue 來存取多個同時觸發的 Pomise，解決 Token Refresh Race Condition 的可能
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

/**
 * @description 批次處理目前在佇列中等待的 API 請求。
 * 根據傳入的 error 決定要全數放行 (resolve) 或是全數拒絕 (reject)，處理完畢後會自動清空佇列。
 */
function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
}

// 自動化帶入 Authorization Header
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response data 解包
api.interceptors.response.use(
  (response) => {
    response.data = response.data.data;
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      isRefreshing = true;

      try {
        // 用動態引入來避免循環依賴
        const { useAuthStore } = await import('../stores/auth');
        const authStore = useAuthStore();
        await authStore.refresh();
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        const { useAuthStore } = await import('../stores/auth');
        const authStore = useAuthStore();
        authStore.clearAuth();
        routerInstance?.push('/login');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
