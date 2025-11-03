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


async refreshToken(): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
  try {
    // read token info from your helper
    const info = getTokenInfo();
    if (!info || !info.token) {
      return { success: false, error: 'Brak tokena' };
    }

    // Build Authorization header without double "Bearer" prefix
    let authHeader = info.token;
    if (!/^Bearer\s+/i.test(authHeader)) {
      authHeader = `Bearer ${authHeader}`;
    }

    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });

    // Explicit handling for unauthorized
    if (response.status === 401) {
      // backend says token invalid/expired
      clearTokenInfo();
      return { success: false, error: 'unauthorized' };
    }

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      return { success: false, error: `Odświeżanie tokena nie powiodło się (${response.status}) ${txt}` };
    }

    const data = await response.json().catch(() => null);
    if (!data || !data.token || !data.expiresAt) {
      return { success: false, error: 'Nieprawidłowa odpowiedź z serwera' };
    }

    // Persist exactly what backend returned (keeps compatibility with other callers)
    setTokenInfo(data.token, data.expiresAt);

    return { success: true, data: { token: data.token, expiresAt: data.expiresAt } };
  } catch (err: any) {
    return { success: false, error: 'Błąd połączenia z serwerem' };
  }
},


};