import api from './client'
import type {
  LoginRequest,
  RegisterRequest,
  GoogleLoginRequest,
  LoginResponse,
  RefreshResponse,
} from '../types'

export const authApi = {
  register(data: RegisterRequest) {
    return api.post<LoginResponse>('/auth/register', data)
  },

  login(data: LoginRequest) {
    return api.post<LoginResponse>('/auth/login', data)
  },

  googleLogin(data: GoogleLoginRequest) {
    return api.post<LoginResponse>('/auth/google', data)
  },

  refresh() {
    return api.post<RefreshResponse>('/auth/refresh')
  },

  logout() {
    return api.post<void>('/auth/logout')
  },
}
