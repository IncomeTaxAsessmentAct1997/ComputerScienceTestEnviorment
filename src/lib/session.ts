export async function getSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

export async function saveSession(email: string): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'DELETE',
    credentials: 'include',
  });
}
