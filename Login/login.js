const { createClient } = supabase;
const db = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    if (getSession()) window.location.replace('../Main/index.html');

    const email_input = document.getElementById('email');
    const password_input = document.getElementById('password');
    const sign_in_button = document.getElementById('sign-in-btn');
    const error_text = document.getElementById('error-text');
    const error_msg = document.getElementById('error-msg');

    function show_error(msg) {
        error_text.textContent = msg;
        error_msg.classList.add('visible');
        email_input.classList.add('error');
        password_input.classList.add('error');
    }

    function clear_error() {
        error_msg.classList.remove('visible');
        email_input.classList.remove('error');
        password_input.classList.remove('error');
    }

    function set_loading(val) {
        sign_in_button.disabled = val;
        sign_in_button.classList.toggle('loading', val);
    }

    sign_in_button.addEventListener('click', handle_sign_in);
    password_input.addEventListener('keydown', e => { if (e.key === 'Enter') handle_sign_in(); });

    async function handle_sign_in() {
        clear_error();
        const email = email_input.value.trim().toLowerCase();
        const password = password_input.value;

        if (!email || !email.endsWith('@' + ENV.ALLOWED_DOMAIN)) {
            show_error(`Only @${ENV.ALLOWED_DOMAIN} emails are allowed.`);
            return;
        }
        if (!password) { show_error('Please enter a password.'); return; }

        set_loading(true);

        const { data: students, error } = await db
            .from('Students')
            .select('*')
            .eq('Email', email)
            .limit(1);

        if (error) { show_error(error.message); set_loading(false); return; }
        if (!students.length) { show_error('Email not found. Are you enrolled?'); set_loading(false); return; }

        const student = students[0];

        if (!student.Password) {
            const hash = await dcodeIO.bcrypt.hash(password, ENV.BCRYPT_ROUNDS);
            const { error: update_error } = await db.from('Students').update({ Password: hash }).eq('Email', email);
            if (update_error) { show_error(update_error.message); set_loading(false); return; }
        } else {
            const match = await dcodeIO.bcrypt.compare(password, student.Password);
            if (!match) { show_error('Incorrect email or password.'); set_loading(false); return; }
        }

        saveSession(email);
        window.location.replace('../Main/index.html');
    }
});
