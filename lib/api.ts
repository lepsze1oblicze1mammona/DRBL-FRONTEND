import { User, LoginCredentials, ApiResponse, LoggedInUser } from '../types/api';

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

  async logout(): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
};