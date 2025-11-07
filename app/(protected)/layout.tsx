'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../context/AuthContext';

const menuItems = [
  { href: '/create-image', label: 'Create image' },
  { href: '/restore-image', label: 'Restore image' },
  { href: '/save-image', label: 'Save image (RAM)' },
  { href: '/drbl-config', label: 'Make changes to DRBL server' },
];

function Header() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login'); // redirect to login after logout
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-4">
        <nav className="flex space-x-8">
          {menuItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium ${
                pathname === href ? 'text-blue-600' : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {user && (
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Wyloguj się
          </button>
        )}
      </div>
    </header>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        <Header />
        <main className="flex-1 max-w-5xl mx-auto w-full p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
