'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api';

export default function Logout() {
  const [message, setMessage] = useState<string>('Trwa wylogowywanie...');
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await apiClient.logout();
      } catch (error) {
        // Ignoruj błędy połączenia
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        setMessage('Wylogowano pomyślnie!');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Wylogowywanie</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}