export interface User {
  id: number;
  name: string;
  email: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface RegisterResponse {
  accessToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface GoogleLoginRequest {
  credential: string;
}

export interface RefreshResponse {
  accessToken: string;
}
