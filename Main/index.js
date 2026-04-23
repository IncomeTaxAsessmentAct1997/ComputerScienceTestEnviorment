const current_user = getSession();
if (!current_user) window.location.replace('../Login/login.html');

const profile_button = document.getElementById('profile-btn');
const profile_dropdown = document.getElementById('profile-dropdown');
const profile_initials = document.getElementById('profile-initials');
const logout_button = document.getElementById('logout-btn');

const initials = current_user.split('@')[0].slice(0, 2).toUpperCase();
profile_initials.textContent = initials;
profile_button.classList.add('logged-in');
document.getElementById('dropdown-email-text').textContent = current_user;

profile_button.addEventListener('click', e => {
    e.stopPropagation();
    profile_dropdown.classList.toggle('open');
});

document.addEventListener('click', e => {
    if (!profile_dropdown.contains(e.target) && e.target !== profile_button)
        profile_dropdown.classList.remove('open');
});

logout_button.addEventListener('click', () => {
    clearSession();
    window.location.replace('../Login/login.html');
});

Split(['#left-split', '#right-split'], { sizes: [45, 55], minSize: 200, gutterSize: 8 });
let left_split = Split(['#problem-panel', '#canvas-panel'], { direction: 'vertical', sizes: [50, 50], minSize: [100, 41], gutterSize: 8 });
Split(['#editor-panel', '#terminal-panel'], { direction: 'vertical', sizes: [70, 30], minSize: 100, gutterSize: 8 });

let canvas_minimized = false;
let previous_canvas_sizes = [50, 50];

document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const is_light = document.body.classList.contains('light-mode');
    document.getElementById('moon-icon').style.display = is_light ? 'none' : 'block';
    document.getElementById('sun-icon').style.display = is_light ? 'block' : 'none';
    if (window.editor) monaco.editor.setTheme(is_light ? 'vs' : 'vs-dark');
    draw_visualization();
});

document.getElementById('min-canvas').addEventListener('click', () => {
    const container = document.getElementById('canvas-container');
    const button = document.getElementById('min-canvas');

    if (!canvas_minimized) {
        previous_canvas_sizes = left_split.getSizes();
        left_split.setSizes([100, 0]);
        container.style.display = 'none';
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.5 2v5.5H2v1h5.5V14h1V8.5H14v-1H8.5V2h-1z"/></svg>';
        canvas_minimized = true;
    } else {
        left_split.setSizes(previous_canvas_sizes);
        container.style.display = 'block';
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 7.5h12v1H2z"/></svg>';
        canvas_minimized = false;
        draw_visualization();
    }
});

function draw_visualization() {
    if (canvas_minimized) return;

    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nums = [2, 7, 11, 15];
    const target = 9;
    const box_size = 60;
    const gap = 12;
    const total_width = nums.length * box_size + (nums.length - 1) * gap;
    const start_x = (canvas.width - total_width) / 2;
    const start_y = (canvas.height - box_size) / 2;
    const is_light = document.body.classList.contains('light-mode');

    ctx.font = '14px "Inter", system-ui, sans-serif';
    ctx.fillStyle = is_light ? '#6b7280' : '#aaaaaa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Target: ${target}`, canvas.width / 2, start_y - 25);

    ctx.font = '600 20px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    nums.forEach((num, i) => {
        const x = start_x + i * (box_size + gap);
        ctx.fillStyle = i === 0 ? '#2ecc71' : i === 1 ? '#f1c40f' : is_light ? '#e5e7eb' : '#3f3f42';
        ctx.beginPath();
        ctx.roundRect(x, start_y, box_size, box_size, 12);
        ctx.fill();
        ctx.fillStyle = i > 1 && is_light ? '#111827' : '#ffffff';
        ctx.fillText(num, x + box_size / 2, start_y + box_size / 2);
    });
}

const resize_observer = new ResizeObserver(() => {
    draw_visualization();
    if (window.editor) window.editor.layout();
});
resize_observer.observe(document.getElementById('canvas-container'));
resize_observer.observe(document.getElementById('editor-container'));
window.addEventListener('resize', draw_visualization);

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function() {
    const is_light = document.body.classList.contains('light-mode');
    window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: "def twoSum(nums, target):\n    return [0, 1]\n\nprint(twoSum([2, 7, 11, 15], 9))",
        language: 'python',
        theme: is_light ? 'vs' : 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Fira Code', 'ui-monospace', 'SFMono-Regular', Consolas, monospace",
        automaticLayout: true,
        padding: { top: 15 },
        scrollBeyondLastLine: false
    });
});

let pyodide_ready = false;
let pyodide;

async function init_pyodide() {
    pyodide = await loadPyodide();
    await pyodide.runPythonAsync(`
        import sys, io
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
    `);
    document.getElementById('terminal-content').innerText = "$ Python environment ready. Click Run to test.";
    document.getElementById('run-btn').disabled = false;
    document.getElementById('submit-btn').disabled = false;
    pyodide_ready = true;
}

init_pyodide();

async function execute_code() {
    if (!pyodide_ready) return;

    const terminal = document.getElementById('terminal-content');
    terminal.innerText = "$ Running code...";
    terminal.style.color = "var(--text-main)";
    document.getElementById('run-btn').disabled = true;
    document.getElementById('submit-btn').disabled = true;

    try {
        await pyodide.runPythonAsync(`
            sys.stdout.truncate(0); sys.stdout.seek(0)
            sys.stderr.truncate(0); sys.stderr.seek(0)
        `);
        await pyodide.runPythonAsync(window.editor.getValue());

        const stdout = pyodide.runPython("sys.stdout.getvalue()");
        const stderr = pyodide.runPython("sys.stderr.getvalue()");

        terminal.style.color = stderr ? "var(--term-err)" : "var(--term-out)";
        terminal.innerText = stderr || stdout || "Executed successfully (no output).";
    } catch (err) {
        terminal.style.color = "var(--term-err)";
        terminal.innerText = "Error:" + (err.toString().split('File "<exec>"').pop() || err.toString());
    }

    document.getElementById('run-btn').disabled = false;
    document.getElementById('submit-btn').disabled = false;
}

document.getElementById('run-btn').addEventListener('click', execute_code);
document.getElementById('submit-btn').addEventListener('click', execute_code);
