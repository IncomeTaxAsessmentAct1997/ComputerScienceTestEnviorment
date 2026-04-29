const MAX_OPS = 500_000;
const MAX_MS  = 10_000;

function js_stdout_write(text) {
    if (!text) return;
    js_stdout_write._buf = (js_stdout_write._buf || '') + text;
    const lines = js_stdout_write._buf.split('\n');
    js_stdout_write._buf = lines.pop();
    for (const line of lines) print_out(line);
}

function js_stdout_flush() {
    if (js_stdout_write._buf) {
        print_out(js_stdout_write._buf);
        js_stdout_write._buf = '';
    }
}

function js_stderr_write(text) {
    if (!text) return;
    js_stderr_write._buf = (js_stderr_write._buf || '') + text;
    const lines = js_stderr_write._buf.split('\n');
    js_stderr_write._buf = lines.pop();
    for (const line of lines) print_err(line);
}

function js_stderr_flush() {
    if (js_stderr_write._buf) {
        print_err(js_stderr_write._buf);
        js_stderr_write._buf = '';
    }
}

function install_realtime_io() {
    pyodide.globals.set('_js_stdout_write', js_stdout_write);
    pyodide.globals.set('_js_stderr_write', js_stderr_write);

    pyodide.runPython(`
import sys, io, os, builtins

class _JSStream:
    def __init__(self, js_write_fn):
        self._write = js_write_fn
        self.encoding = 'utf-8'
        self.errors = 'replace'
    def write(self, text):
        self._write(str(text))
        return len(text)
    def writelines(self, lines):
        for l in lines:
            self.write(l)
    def flush(self): pass
    def isatty(self): return False
    @property
    def softspace(self): return 0

sys.stdout = _JSStream(_js_stdout_write)
sys.stderr = _JSStream(_js_stderr_write)

os.makedirs('/home/user', exist_ok=True)
os.chdir('/home/user')
    `);
}

function install_loop_guard() {
    pyodide.globals.set('_loop_guard_max_ops', MAX_OPS);
    pyodide.globals.set('_loop_guard_deadline', Date.now() + MAX_MS);
    pyodide.globals.set('_loop_guard_now', () => Date.now());

    pyodide.runPython(`
import sys as _sys

_loop_guard_ops = 0

class _LoopLimitExceeded(Exception):
    pass

def _loop_trace(frame, event, arg):
    global _loop_guard_ops
    _loop_guard_ops += 1
    if _loop_guard_ops > _loop_guard_max_ops:
        raise _LoopLimitExceeded("Execution limit reached: too many operations (possible infinite loop).")
    if _loop_guard_now() > _loop_guard_deadline:
        raise _LoopLimitExceeded(f"Execution timed out after ${MAX_MS / 1000} seconds (possible infinite loop).")
    return _loop_trace

def _install_guard():
    global _loop_guard_ops
    _loop_guard_ops = 0
    _sys.settrace(_loop_trace)

def _remove_guard():
    _sys.settrace(None)
    `);
}

async function init_pyodide() {
    print_info('Initializing Python 3.11 (Pyodide)...');
    pyodide = await loadPyodide();
    install_realtime_io();
    install_loop_guard();
    const ver = pyodide.runPython(`import sys; sys.version.split()[0]`);
    terminal_output.querySelector('.term-line.term-info').remove();
    print_out('Python ' + ver + ' ready.');
    print_line('');
    document.getElementById('run-btn').disabled = false;
    document.getElementById('submit-btn').disabled = false;
    pyodide_ready = true;
    update_prompt();
}

async function run_python_source(source) {
    pyodide.globals.set('_loop_guard_deadline', Date.now() + MAX_MS);
    pyodide.runPython('_install_guard()');

    try {
        await pyodide.runPythonAsync(source);
    } catch (e) {
        const msg = String(e);
        if (msg.includes('_LoopLimitExceeded') || msg.includes('Execution limit') || msg.includes('Execution timed out')) {
            const clean = msg.match(/_LoopLimitExceeded: (.+)/)?.[1] || 'Execution stopped: possible infinite loop.';
            print_err('⏹ ' + clean);
        } else {
            const trimmed = msg.split('File "<exec>"').pop() || msg;
            print_err(trimmed.trim());
        }
    } finally {
        pyodide.runPython('_remove_guard()');
        js_stdout_flush();
        js_stderr_flush();
    }

    sync_pyodide_to_vfs();
}

async function run_python_file(filename) {
    const abs = resolve_path(filename);
    const node = vfs_get(abs);
    let source;
    if (typeof node === 'string') {
        source = node;
    } else if (filename === 'script.py' || filename === './script.py') {
        source = window.editor ? window.editor.getValue() : '';
        vfs_set(abs, source);
    } else {
        print_err(`python3: can't open file '${filename}': No such file or directory`);
        return;
    }
    await run_python_source(source);
}

async function run_python_inline(code) {
    await run_python_source(code);
}
