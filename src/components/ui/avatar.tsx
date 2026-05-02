'use client';

import { useRouter } from 'next/navigation';
import { clearSession } from '@/lib/session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  email: string;
}

export default function Navbar({ email }: NavbarProps) {
  const router = useRouter();
  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '';

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
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer border-0 bg-transparent p-0 outline-none ring-0 focus:outline-none focus-visible:outline-none">
            <button className="profile-icon logged-in">
              <span className="profile-initials">{initials}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ padding: '8px', minWidth: '220px' }}>
            <div className="dropdown-email">
              <span>Signed in as</span>
              {email}
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log out
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}