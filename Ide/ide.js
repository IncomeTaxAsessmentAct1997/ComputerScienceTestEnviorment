const current_user = getSession();
if (!current_user) window.location.replace('../Login/login.html');

initProfileUI(current_user);

Split(['#left-split', '#right-split'], { sizes: [45, 55], minSize: 200, gutterSize: 8 });
Split(['#problem-panel', '#canvas-panel'], { direction: 'vertical', sizes: [0, 100], minSize: [0, 41], gutterSize: 8 });
let right_split = Split(['#editor-panel', '#terminal-panel'], { direction: 'vertical', sizes: [70, 30], minSize: [100, 38], gutterSize: 8 });

const resize_observer = new ResizeObserver(() => {
    if (window.editor) window.editor.layout();
});
resize_observer.observe(document.getElementById('editor-container'));

const PYTHON_LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px"><defs><linearGradient id="pyBl" x1="12%" y1="12%" x2="83%" y2="88%"><stop offset="0" stop-color="#387EB8"/><stop offset="1" stop-color="#366994"/></linearGradient><linearGradient id="pyYe" x1="19%" y1="20%" x2="90%" y2="88%"><stop offset="0" stop-color="#FFE052"/><stop offset="1" stop-color="#FFC331"/></linearGradient></defs><path fill="url(#pyBl)" d="M126.9.9c-64.2 0-60.2 27.9-60.2 27.9l.1 28.9h61.3v8.7H43.3S5.2 61.8 5.2 126.6c0 64.8 35.8 62.5 35.8 62.5h21.4v-30s-1.2-35.8 35.2-35.8h60.7s34.1.6 34.1-32.9V35.6S197.1.9 126.9.9zm-33.8 19.6a11 11 0 1 1 0 22 11 11 0 0 1 0-22z"/><path fill="url(#pyYe)" d="M128.8 254.1c64.2 0 60.2-27.9 60.2-27.9l-.1-28.9h-61.3v-8.7h84.8s38.2 4.6 38.2-60.2c0-64.8-35.8-62.5-35.8-62.5h-21.4v30s1.2 35.8-35.2 35.8H97.5S63.4 121.1 63.4 154.6v88.8s-5.3 10.7 65.4 10.7zm33.8-19.6a11 11 0 1 1 0-22 11 11 0 0 1 0 22z"/></svg>`;

let current_editor_file = 'script.py';
let pyodide_ready = false;
let pyodide;
let terminal_closed = false;
let previous_right_sizes = [70, 30];

function set_editor_tab(filename) {
    current_editor_file = filename;
    const header = document.querySelector('#editor-panel .panel-header span');
    if (!header) return;
    if (filename.endsWith('.py')) {
        header.innerHTML = PYTHON_LOGO_SVG + filename;
    } else {
        header.textContent = filename;
    }
}

set_editor_tab('script.py');

const EDITOR_KEY = 'py_challenge_editor_' + (current_user);
const saved_code = localStorage.getItem(EDITOR_KEY) || '';

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: saved_code,
        language: 'python',
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Fira Code', 'ui-monospace', 'SFMono-Regular', Consolas, monospace",
        automaticLayout: true,
        padding: { top: 15 },
        scrollBeyondLastLine: false
    });
    window.editor.onDidChangeModelContent(() => {
        localStorage.setItem(EDITOR_KEY, window.editor.getValue());
    });
});

function open_terminal() {
    if (!terminal_closed) { term_input.focus(); return; }
    terminal_output.innerHTML = '';
    document.getElementById('terminal-panel').style.display = '';
    right_split.setSizes(previous_right_sizes);
    terminal_closed = false;
    update_prompt();
    term_input.focus();
}

document.getElementById('terminal-close-btn').addEventListener('click', () => {
    previous_right_sizes = right_split.getSizes();
    document.getElementById('terminal-panel').style.display = 'none';
    right_split.setSizes([100, 0]);
    terminal_closed = true;
});

async function execute_from_button() {
    if (!pyodide_ready) return;
    open_terminal();
    const source = window.editor ? window.editor.getValue() : '';
    vfs_set(resolve_path(current_editor_file), source);
    print_cmd_echo(prompt_str(), `python3 ${current_editor_file}`);
    await run_python_file(current_editor_file);
    print_line('');
    update_prompt();
    term_input.focus();
}

document.getElementById('run-btn').addEventListener('click', execute_from_button);
document.getElementById('submit-btn').addEventListener('click', execute_from_button);

init_pyodide();
