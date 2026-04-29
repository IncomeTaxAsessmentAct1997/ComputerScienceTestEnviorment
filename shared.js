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

function initProfileUI(email) {
    const initials = email.split('@')[0].slice(0, 2).toUpperCase();
    const profileBtn = document.getElementById('profile-btn');
    const profileInitials = document.getElementById('profile-initials');
    const emailText = document.getElementById('dropdown-email-text');
    const dropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');

    profileInitials.textContent = initials;
    profileBtn.classList.add('logged-in');
    if (emailText) emailText.textContent = email;

    profileBtn.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', e => {
        if (!dropdown.contains(e.target) && e.target !== profileBtn)
            dropdown.classList.remove('open');
    });

    logoutBtn.addEventListener('click', () => {
        clearSession();
        window.location.replace('../Login/login.html');
    });
}
