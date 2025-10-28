import { User, LoginCredentials, ApiResponse, LoggedInUser } from '../types/api';
import { getTokenInfo, setTokenInfo, clearTokenInfo } from '../lib/auth';

export const apiClient = {
  async createUser(userData: User): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/createUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      return { success: false, error: 'Błąd połączenia' };
    }
  },

  async login(credentials: LoginCredentials): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      const result = await response.json();
      
      if (result.token) {
        const loggedInUser: LoggedInUser = {
          login: credentials.login
        };
        setTokenInfo(result.token, result.expiresAt);
        
        return { 
          success: true, 
          token: result.token, 
          user: loggedInUser 
        };
      } else {
        return { success: false, error: result.error || 'Brak tokena w odpowiedzi' };
      }
    } catch (error) {
      return { success: false, error: 'Błąd połączenia z serwerem' };
    }
  },

  async logout(token: string): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`,
        },
      });
      
      if (response.ok) {
        return { success: true, message: 'Wylogowano pomyślnie' };
      } else {
        return { success: false, error: 'Błąd podczas wylogowania' };
      }
    } catch (error) {
      return { success: false, error: 'Błąd połączenia z serwerem' };
    }
  },
//POPRAWA TEGO SYFA
  async refreshToken(): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
  try {
    const token = localStorage.getItem('token');
    if (!token) return { success: false, error: 'Brak tokena' };

    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include', // if your backend uses cookies
    });

    if (!response.ok) {
      return { success: false, error: 'Odświeżanie tokena nie powiodło się' };
    }

    const data = await response.json();
    if (data.token && data.expiresAt) {
      return { success: true, data: { token: data.token, expiresAt: data.expiresAt } };
    } else {
      return { success: false, error: 'Nieprawidłowa odpowiedź z serwera' };
    }
  } catch (error) {
    return { success: false, error: 'Błąd połączenia z serwerem' };
  }
},

};