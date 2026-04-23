const SESSION_KEY = 'py_challenge_user';

function getSession() {
    return localStorage.getItem(SESSION_KEY);
}

function saveSession(email) {
    localStorage.setItem(SESSION_KEY, email);
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
