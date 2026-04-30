'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, saveSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN!;
const BCRYPT_ROUNDS = parseInt(process.env.NEXT_PUBLIC_BCRYPT_ROUNDS || '10');

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace('/home');
  }, [router]);

  const showError = (msg: string) => setError(msg);
  const clearError = () => setError('');

  const handleSignIn = async () => {
    clearError();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.endsWith('@' + ALLOWED_DOMAIN)) {
      showError(`Only @${ALLOWED_DOMAIN} emails are allowed.`);
      return;
    }
    if (!password) { showError('Please enter a password.'); return; }

    setLoading(true);

    const { data: students, error: dbError } = await supabase
      .from('Students')
      .select('*')
      .eq('Email', trimmedEmail)
      .limit(1);

    if (dbError) { showError(dbError.message); setLoading(false); return; }
    if (!students || students.length === 0) { showError('Email not found. Are you enrolled?'); setLoading(false); return; }

    const student = students[0];

    if (!student.Password) {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { error: updateError } = await supabase.from('Students').update({ Password: hash }).eq('Email', trimmedEmail);
      if (updateError) { showError(updateError.message); setLoading(false); return; }
    } else {
      const match = await bcrypt.compare(password, student.Password);
      if (!match) { showError('Incorrect email or password.'); setLoading(false); return; }
    }

    saveSession(trimmedEmail);
    router.replace('/home');
  };

  return (
    <div className="card">
      <div className="logo-row">
        <svg className="logo-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
        <span className="logo-text">Testing Environment</span>
      </div>

      <h1>Sign In</h1>
      <p />

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="you@dtechhs.org"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={error ? 'error' : ''}
        />
        <div className="domain-badge">@dtechhs.org only</div>
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={error ? 'error' : ''}
          onKeyDown={e => { if (e.key === 'Enter') handleSignIn(); }}
        />
      </div>

      {error && (
        <div className="error-msg visible">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button className={`btn-sign-in${loading ? ' loading' : ''}`} disabled={loading} onClick={handleSignIn}>
        <div className="spinner" />
        <span className="btn-label">Sign In</span>
      </button>

      <div className="first-time-note">
        <strong>First time?</strong> If your account hasn&apos;t been set up yet, the password you enter will become your permanent password.
      </div>
    </div>
  );
}
