const SESSION_KEY = 'py_challenge_user';

function getSession() {
    return localStorage.getItem(SESSION_KEY);
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// Gate: redirect to login if not authenticated
const currentUser = getSession();
if (!currentUser) {
    window.location.replace('../Login/login.html');
}

// ── PROFILE ICON / DROPDOWN ───────────────────────────────────────────────────

const profileBtn      = document.getElementById('profile-btn');
const profileDropdown = document.getElementById('profile-dropdown');
const profileInitials = document.getElementById('profile-initials');
const dropdownEmail   = document.getElementById('dropdown-email-text');
const logoutBtn       = document.getElementById('logout-btn');

function initProfileUI(email) {
    if (!email) return;

    // Show initials in the profile button
    const initials = email.split('@')[0].slice(0, 2).toUpperCase();
    profileInitials.textContent = initials;
    profileBtn.classList.add('logged-in');

    // Populate dropdown email
    dropdownEmail.textContent = email;
}

initProfileUI(currentUser);

// Toggle dropdown on click
profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (!getSession()) {
        // Not logged in — go to login page
        window.location.replace('../Login/login.html');
        return;
    }

    profileDropdown.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!profileDropdown.contains(e.target) && e.target !== profileBtn) {
        profileDropdown.classList.remove('open');
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    clearSession();
    window.location.replace('../Login/login.html');
});

// ── SPLIT PANELS ──────────────────────────────────────────────────────────────

const mainSplit = Split(['#left-split', '#right-split'], { sizes: [45, 55], minSize: 200, gutterSize: 8 });
let leftSplit = Split(['#problem-panel', '#canvas-panel'], { direction: 'vertical', sizes: [50, 50], minSize: [100, 41], gutterSize: 8 });
const rightSplit = Split(['#editor-panel', '#terminal-panel'], { direction: 'vertical', sizes: [70, 30], minSize: 100, gutterSize: 8 });

let isCanvasMinimized = false;
let previousCanvasSizes = [50, 50];

// ── THEME TOGGLE ──────────────────────────────────────────────────────────────

const themeBtn = document.getElementById('theme-toggle');
const moonIcon = document.getElementById('moon-icon');
const sunIcon  = document.getElementById('sun-icon');

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');

    if (isLight) {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
        if (window.editor) monaco.editor.setTheme('vs');
    } else {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
        if (window.editor) monaco.editor.setTheme('vs-dark');
    }
    drawVisualization();
});

// ── CANVAS MINIMIZE ───────────────────────────────────────────────────────────

document.getElementById('min-canvas').addEventListener('click', () => {
    const container = document.getElementById('canvas-container');
    const minBtn    = document.getElementById('min-canvas');

    if (!isCanvasMinimized) {
        previousCanvasSizes = leftSplit.getSizes();
        leftSplit.setSizes([100, 0]);
        container.style.display = 'none';
        minBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.5 2v5.5H2v1h5.5V14h1V8.5H14v-1H8.5V2h-1z"/></svg>';
        isCanvasMinimized = true;
    } else {
        leftSplit.setSizes(previousCanvasSizes);
        container.style.display = 'block';
        minBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 7.5h12v1H2z"/></svg>';
        isCanvasMinimized = false;
        drawVisualization();
    }
});

// ── CANVAS DRAW ───────────────────────────────────────────────────────────────

function drawVisualization() {
    if (isCanvasMinimized) return;

    const canvasPanel = document.getElementById('canvas-panel');
    if (canvasPanel.style.display === 'none') return;

    const container = document.getElementById('canvas-container');
    const canvas    = document.getElementById('myCanvas');
    const ctx       = canvas.getContext('2d');

    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nums  = [2, 7, 11, 15];
    const target = 9;
    const boxSize = 60;
    const gap     = 12;
    const totalWidth = (nums.length * boxSize) + ((nums.length - 1) * gap);

    const startX = (canvas.width  - totalWidth) / 2;
    const startY = (canvas.height - boxSize)    / 2;

    const isLight = document.body.classList.contains('light-mode');

    ctx.font         = '14px "Inter", system-ui, sans-serif';
    ctx.fillStyle    = isLight ? '#6b7280' : '#aaaaaa';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Target: ${target}`, canvas.width / 2, startY - 25);

    ctx.font         = '600 20px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    nums.forEach((num, i) => {
        const x = startX + i * (boxSize + gap);

        if (i === 0)       ctx.fillStyle = '#2ecc71';
        else if (i === 1)  ctx.fillStyle = '#f1c40f';
        else               ctx.fillStyle = isLight ? '#e5e7eb' : '#3f3f42';

        ctx.beginPath();
        ctx.roundRect(x, startY, boxSize, boxSize, 12);
        ctx.fill();

        ctx.fillStyle = (i > 1 && isLight) ? '#111827' : '#ffffff';
        ctx.fillText(num, x + boxSize / 2, startY + boxSize / 2);
    });
}

const resizeObserver = new ResizeObserver(() => {
    drawVisualization();
    if (window.editor) window.editor.layout();
});
resizeObserver.observe(document.getElementById('canvas-container'));
resizeObserver.observe(document.getElementById('editor-container'));
window.addEventListener('resize', drawVisualization);

// ── MONACO EDITOR ─────────────────────────────────────────────────────────────

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    const isLight = document.body.classList.contains('light-mode');
    window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: "def twoSum(nums, target):\n    return [0, 1]\n\nprint(twoSum([2, 7, 11, 15], 9))",
        language: 'python',
        theme: isLight ? 'vs' : 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Fira Code', 'ui-monospace', 'SFMono-Regular', Consolas, monospace",
        automaticLayout: true,
        padding: { top: 15 },
        scrollBeyondLastLine: false
    });
});

// ── PYODIDE ───────────────────────────────────────────────────────────────────

let pyodideReady = false;
let pyodideInstance;

async function initPyodide() {
    try {
        pyodideInstance = await loadPyodide();

        await pyodideInstance.runPythonAsync(`
            import sys
            import io
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
        `);

        document.getElementById('terminal-content').innerText = "$ Python environment ready. Click Run to test.";
        document.getElementById('run-btn').disabled    = false;
        document.getElementById('submit-btn').disabled = false;
        pyodideReady = true;
    } catch (err) {
        document.getElementById('terminal-content').innerText = "Failed to load Python engine: " + err;
    }
}

initPyodide();

async function executeCode() {
    if (!pyodideReady) return;

    const terminal  = document.getElementById('terminal-content');
    const runBtn    = document.getElementById('run-btn');
    const submitBtn = document.getElementById('submit-btn');

    terminal.innerText  = "$ Running code...";
    terminal.style.color = "var(--text-main)";
    runBtn.disabled    = true;
    submitBtn.disabled = true;

    const userCode = window.editor.getValue();

    try {
        await pyodideInstance.runPythonAsync(`
            sys.stdout.truncate(0)
            sys.stdout.seek(0)
            sys.stderr.truncate(0)
            sys.stderr.seek(0)
        `);

        await pyodideInstance.runPythonAsync(userCode);

        const stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
        const stderr = pyodideInstance.runPython("sys.stderr.getvalue()");

        if (stderr) {
            terminal.style.color = "var(--term-err)";
            terminal.innerText   = stderr;
        } else {
            terminal.style.color = "var(--term-out)";
            terminal.innerText   = stdout ? stdout : "Executed successfully (no output).";
        }
    } catch (err) {
        terminal.style.color = "var(--term-err)";
        let errorMsg = err.toString().split('File "<exec>"').pop() || err.toString();
        terminal.innerText = "Error:" + errorMsg;
    } finally {
        runBtn.disabled    = false;
        submitBtn.disabled = false;
    }
}

document.getElementById('run-btn').addEventListener('click', executeCode);
document.getElementById('submit-btn').addEventListener('click', executeCode);