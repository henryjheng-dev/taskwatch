import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, LoginRequest, RegisterRequest, GoogleLoginRequest } from '../types'
import { authApi } from '../api'
import { setAccessToken } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)

  function setAuth(token: string, userData: User) {
    setAccessToken(token)
    accessToken.value = token
    user.value = userData
  }

  function clearAuth() {
    setAccessToken(null)
    accessToken.value = null
    user.value = null
  }

  async function register(data: RegisterRequest) {
    const res = await authApi.register(data)
    setAuth(res.data.accessToken, res.data.user)
  }

  async function login(data: LoginRequest) {
    const res = await authApi.login(data)
    setAuth(res.data.accessToken, res.data.user)
  }

  async function googleLogin(data: GoogleLoginRequest) {
    const res = await authApi.googleLogin(data)
    setAuth(res.data.accessToken, res.data.user)
  }

  async function refresh() {
    const res = await authApi.refresh()
    const token = res.data.accessToken
    setAccessToken(token)
    accessToken.value = token
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearAuth()
    }
  }

  async function init() {
    if (isInitialized.value) return
    try {
      await refresh()
    } catch {
      clearAuth()
    } finally {
      isInitialized.value = true
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
  }
})
