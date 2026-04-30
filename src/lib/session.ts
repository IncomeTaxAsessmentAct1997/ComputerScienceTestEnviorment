const SESSION_KEY = 'py_challenge_user';

export function getSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function saveSession(email: string): void {
  localStorage.setItem(SESSION_KEY, email);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
