'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoggedInUser } from '../types/api';

export default function Home() {
  const [user, setUser] = useState<LoggedInUser | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Witaj w aplikacji!</h1>
          <p className="text-gray-600 mb-8">
            {user ? 'Miło Cię znowu widzieć!' : 'Zaloguj się lub załóż konto'}
          </p>
          
          {user ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  Jesteś zalogowany jako: <strong className="text-green-900">{user.login}</strong>
                </p>
              </div>
              <Link 
                href="/logout" 
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Wyloguj się
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <Link 
                href="/login" 
                className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition-colors duration-200"
              >
                Zaloguj się
              </Link>
              <Link 
                href="/signup" 
                className="block w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-center transition-colors duration-200"
              >
                Zarejestruj się
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}