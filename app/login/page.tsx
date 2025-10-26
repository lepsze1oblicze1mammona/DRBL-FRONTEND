'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api';
import { LoginCredentials } from '../../types/api';

export default function Login() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    login: '',
    password: ''
  });
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await apiClient.login(credentials);
      
      if (result.success) {
        localStorage.setItem('token', result.token || '');
        localStorage.setItem('user', JSON.stringify(result.user));
        
        setMessage('Logowanie udane!');
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        const errorMessage = result.error || result.message || 'Błędne dane logowania';
        setMessage(`Błąd: ${errorMessage}`);
      }
    } catch (error) {
      setMessage('Błąd połączenia z serwerem');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Logowanie</h1>
          <p className="text-gray-600">Zaloguj się do swojego konta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-2">
              Login
            </label>
            <input
              type="text"
              id="login"
              name="login"
              placeholder="Wprowadź login"
              value={credentials.login}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Hasło
            </label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Wprowadź hasło"
              value={credentials.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logowanie...
              </>
            ) : (
              'Zaloguj się'
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg ${message.includes('Błąd') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {message}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Nie masz konta?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Zarejestruj się
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}