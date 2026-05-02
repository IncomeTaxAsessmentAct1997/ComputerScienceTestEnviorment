'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/session';

export function useRequireAuth(): string {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    getSession().then(sessionEmail => {
      if (!sessionEmail) { router.replace('/login'); return; }
      setEmail(sessionEmail);
    });
  }, []);

  return email;
}
