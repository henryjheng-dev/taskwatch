import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, LoginRequest, RegisterRequest, GoogleLoginRequest } from '../types';
import { authApi } from '../api';
import { setAccessToken } from '../api/client';

const authChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('taskwatch-auth')
    : null;

// 同一分頁內共用同一個 refresh Promise，避免 init() 與 axios interceptor 同時刷新
let refreshPromise: Promise<void> | null = null;

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<User | null>(null);
  const isInitialized = ref(false);

  const isAuthenticated = computed(() => !!accessToken.value);

  /** @description 寫入使用者驗證狀態（登入/Token 刷新時呼叫）*/
  function setAuth(token: string, userData: User) {
    setAccessToken(token);
    accessToken.value = token;
    user.value = userData;
    authChannel?.postMessage({ type: 'auth', accessToken: token, user: userData });
  }

  /** @description 清除使用者驗證狀態（使用者登出/Token 逾時失效時呼叫） */
  function clearAuth() {
    setAccessToken(null);
    accessToken.value = null;
    user.value = null;
  }

  // 其他分頁登入或刷新成功時，同步 access token 與 user，避免各自重複刷新
  authChannel?.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; accessToken?: string; user?: User } | null;

    if (data?.type === 'auth' && data.accessToken && data.user) {
      setAccessToken(data.accessToken);
      accessToken.value = data.accessToken;
      user.value = data.user;
    } else if (data?.type === 'logout') {
      clearAuth();
    }
  });

  async function register(data: RegisterRequest) {
    const res = await authApi.register(data);
    setAuth(res.data.accessToken, res.data.user);
  }

  async function login(data: LoginRequest) {
    const res = await authApi.login(data);
    setAuth(res.data.accessToken, res.data.user);
  }

  async function googleLogin(data: GoogleLoginRequest) {
    const res = await authApi.googleLogin(data);
    setAuth(res.data.accessToken, res.data.user);
  }

  /** @description 換發 access token；同一時間只會送出一個 refresh 請求 */
  async function refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const res = await authApi.refresh();
      setAuth(res.data.accessToken, res.data.user);
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
    } finally {
      clearAuth();
      authChannel?.postMessage({ type: 'logout' });
    }
  }

  async function init() {
    if (isInitialized.value) return;
    try {
      await refresh();
    } catch {
      clearAuth();
    } finally {
      isInitialized.value = true;
    }
  }

  return {
    accessToken,
    user,
    isInitialized,
    isAuthenticated,
    register,
    login,
    googleLogin,
    refresh,
    logout,
    init,
    clearAuth,
  };
});
