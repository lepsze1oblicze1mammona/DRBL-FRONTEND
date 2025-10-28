'use client';

import { getTokenInfo, setTokenInfo, clearTokenInfo } from '../../../lib/auth';
import { useEffect, useState } from 'react';

export default function SaveImagePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const info = getTokenInfo();
    if (info) setToken(info.token);
  }, []);

  return (
      <div>
    <h1 className="text-xl font-semibold text-gray-800">Save image page</h1>
    <p className="text-gray-700">Token: {token}</p>
    </div>
  );
}
