export interface User {
  login: string;
  password: string;
}

export interface LoggedInUser {
  login: string;
}

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  token?: string;
  user?: LoggedInUser;
  message?: string;
}