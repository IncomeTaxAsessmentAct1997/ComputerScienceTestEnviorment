import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { ENV, saveSession, getSession } from '../App';
import './Login.css';

const db = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (getSession()) {
    navigate('/');
    return null;
  }

  async function handleSignIn() {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.endsWith('@' + ENV.ALLOWED_DOMAIN)) {
      setError(`Only @${ENV.ALLOWED_DOMAIN} emails are allowed.`);
      return;
    }
    if (!password) { setError('Please enter a password.'); return; }

    setLoading(true);

    const { data: students, error: fetchErr } = await db
      .from('Students')
      .select('*')
      .eq('Email', trimmed)
      .limit(1);

    if (fetchErr) { setError(fetchErr.message); setLoading(false); return; }
    if (!students.length) { setError('Email not found. Are you enrolled?'); setLoading(false); return; }

    const student = students[0];
    const bcrypt = window.dcodeIO?.bcrypt;

    if (!student.Password) {
      const hash = await bcrypt.hash(password, ENV.BCRYPT_ROUNDS);
      const { error: updateErr } = await db.from('Students').update({ Password: hash }).eq('Email', trimmed);
      if (updateErr) { setError(updateErr.message); setLoading(false); return; }
    } else {
      const match = await bcrypt.compare(password, student.Password);
      if (!match) { setError('Incorrect email or password.'); setLoading(false); return; }
    }

    saveSession(trimmed);
    navigate('/');
  }

  const hasError = !!error;

  return (
    <div className="login-body">
      <div className="card">
        <div className="logo-row">
          <svg className="logo-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          <span className="logo-text">Testing Environment</span>
        </div>

        <h1>Sign In</h1>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@dtechhs.org"
            autoComplete="email"
            className={hasError ? 'error' : ''}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <div className="domain-badge">@dtechhs.org only</div>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            className={hasError ? 'error' : ''}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignIn()}
          />
        </div>

        <div className={`error-msg${error ? ' visible' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>

        <button
          className={`btn-sign-in${loading ? ' loading' : ''}`}
          disabled={loading}
          onClick={handleSignIn}
        >
          <div className="spinner" />
          <span className="btn-label">{loading ? 'Signing in…' : 'Sign In'}</span>
        </button>

        <div className="first-time-note">
          <strong>First time?</strong> If your account hasn't been set up yet, the password you enter will become your permanent password.
        </div>
      </div>
    </div>
  );
}