'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession } from '@/lib/session';

interface NavbarProps {
  email: string;
}

export default function Navbar({ email }: NavbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <svg className="home-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" onClick={() => router.push('/home')}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      </div>
      <div className="nav-center" />
      <div className="nav-right">
        <div className="profile-wrapper" ref={dropdownRef}>
          <button
            className={`profile-icon${email ? ' logged-in' : ''}`}
            onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          >
            <svg className="profile-default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span className="profile-initials">{initials}</span>
          </button>
          <div className={`profile-dropdown${open ? ' open' : ''}`}>
            <div className="dropdown-email">
              <span>Signed in as</span>
              <span>{email}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
