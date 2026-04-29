import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../App';
import { getSession } from '../App';
import './Assignment.css';

const MAX_OPS = 500_000;
const MAX_MS  = 10_000;

const PYTHON_LOGO = (
  <svg width="16" height="16" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: 6 }}>
    <defs>
      <linearGradient id="pyBl" x1="12%" y1="12%" x2="83%" y2="88%">
        <stop offset="0" stopColor="#387EB8" /><stop offset="1" stopColor="#366994" />
      </linearGradient>
      <linearGradient id="pyYe" x1="19%" y1="20%" x2="90%" y2="88%">
        <stop offset="0" stopColor="#FFE052" /><stop offset="1" stopColor="#FFC331" />
      </linearGradient>
    </defs>
    <path fill="url(#pyBl)" d="M126.9.9c-64.2 0-60.2 27.9-60.2 27.9l.1 28.9h61.3v8.7H43.3S5.2 61.8 5.2 126.6c0 64.8 35.8 62.5 35.8 62.5h21.4v-30s-1.2-35.8 35.2-35.8h60.7s34.1.6 34.1-32.9V35.6S197.1.9 126.9.9zm-33.8 19.6a11 11 0 1 1 0 22 11 11 0 0 1 0-22z"/>
    <path fill="url(#pyYe)" d="M128.8 254.1c64.2 0 60.2-27.9 60.2-27.9l-.1-28.9h-61.3v-8.7h84.8s38.2 4.6 38.2-60.2c0-64.8-35.8-62.5-35.8-62.5h-21.4v30s1.2 35.8-35.2 35.8H97.5S63.4 121.1 63.4 154.6v88.8s-5.3 10.7 65.4 10.7zm33.8-19.6a11 11 0 1 1 0-22 11 11 0 0 1 0 22z"/>
  </svg>
);

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function Assignment() {
  const navigate = useNavigate();
  const email = getSession();
  const EDITOR_KEY = 'py_challenge_editor_' + (email || 'guest');

  const termOutputRef = useRef(null);
  const termBodyRef = useRef(null);
  const termInputRef = useRef(null);
  const editorContainerRef = useRef(null);
  const splitRef = useRef(null);
  const rightSplitRef = useRef(null);
  const pyodideRef = useRef(null);
  const vfsRef = useRef({ '/home/user': {} });
  const cwdRef = useRef('/home/user');
  const cmdHistoryRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const prevRightSizesRef = useRef([70, 30]);

  const [pyReady, setPyReady] = useState(false);
  const [termClosed, setTermClosed] = useState(false);
  const [promptStr, setPromptStr] = useState('user@pyenv:~$');
  const [editorTab, setEditorTab] = useState('script.py');

  function getPromptStr() {
    const cwd = cwdRef.current;
    const display = cwd === '/home/user' ? '~' : cwd.replace('/home/user', '~');
    return `user@pyenv:${display}$`;
  }

  function updatePrompt() {
    setPromptStr(getPromptStr());
  }

  function scrollBottom() {
    if (termBodyRef.current) termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
  }

  function printLine(html, cls) {
    const span = document.createElement('span');
    span.className = 'term-line' + (cls ? ' ' + cls : '');
    span.innerHTML = html;
    termOutputRef.current?.appendChild(span);
    scrollBottom();
  }

  function printCmdEcho(prompt, cmd) {
    printLine(`<span class="term-prompt">${esc(prompt)}</span> <span class="term-cmd-echo">${esc(cmd)}</span>`);
  }

  function printOut(text) { if (text) printLine(esc(text), 'term-out'); }
  function printErr(text) { printLine(esc(text), 'term-err'); }
  function printInfo(text) { printLine(esc(text), 'term-info'); }

  function vfsGet(path) {
    const parts = resolvePath(path).split('/').filter(Boolean);
    let node = vfsRef.current;
    for (const p of parts) {
      if (node[p] === undefined) return undefined;
      node = node[p];
    }
    return node;
  }

  function vfsSet(path, val) {
    const abs = resolvePath(path);
    const parts = abs.split('/').filter(Boolean);
    let node = vfsRef.current;
    for (let i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] === undefined) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = val;
  }

  function vfsDelete(path) {
    const abs = resolvePath(path);
    const parts = abs.split('/').filter(Boolean);
    let node = vfsRef.current;
    for (let i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] === undefined) return false;
      node = node[parts[i]];
    }
    const key = parts[parts.length - 1];
    if (node[key] === undefined) return false;
    delete node[key];
    return true;
  }

  function vfsLs(path) {
    const node = vfsGet(path);
    if (node === undefined || typeof node !== 'object') return null;
    return Object.keys(node);
  }

  function resolvePath(p) {
    const cwd = cwdRef.current;
    if (!p || p === '.') return cwd;
    if (!p.startsWith('/')) p = cwd + '/' + p;
    const parts = p.split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '..') { if (stack.length) stack.pop(); }
      else if (part !== '.') stack.push(part);
    }
    return '/' + stack.join('/');
  }

  function tokenize(raw) {
    const tokens = [];
    let current = '';
    let inQuote = null;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inQuote) {
        if (ch === inQuote) { inQuote = null; tokens.push(current); current = ''; }
        else current += ch;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ') {
        if (current) { tokens.push(current); current = ''; }
      } else { current += ch; }
    }
    if (current) tokens.push(current);
    return tokens;
  }

  function syncPyodideToVfs() {
    const py = pyodideRef.current;
    if (!py) return;
    function readDir(path) {
      const result = {};
      let entries;
      try { entries = py.FS.readdir(path); } catch (_) { return result; }
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        const full = path + '/' + entry;
        const stat = py.FS.stat(full);
        if (py.FS.isDir(stat.mode)) {
          result[entry] = readDir(full);
        } else {
          try { result[entry] = py.FS.readFile(full, { encoding: 'utf8' }); } catch (_) { result[entry] = ''; }
        }
      }
      return result;
    }
    try { vfsRef.current['/home/user'] = readDir('/home/user'); } catch (_) {}
  }

  const stdoutBuf = useRef('');
  const stderrBuf = useRef('');

  function jsStdoutWrite(text) {
    if (!text) return;
    stdoutBuf.current += text;
    const lines = stdoutBuf.current.split('\n');
    stdoutBuf.current = lines.pop();
    for (const line of lines) printOut(line);
  }

  function jsStdoutFlush() {
    if (stdoutBuf.current) { printOut(stdoutBuf.current); stdoutBuf.current = ''; }
  }

  function jsStderrWrite(text) {
    if (!text) return;
    stderrBuf.current += text;
    const lines = stderrBuf.current.split('\n');
    stderrBuf.current = lines.pop();
    for (const line of lines) printErr(line);
  }

  function jsStderrFlush() {
    if (stderrBuf.current) { printErr(stderrBuf.current); stderrBuf.current = ''; }
  }

  function installRealtimeIO(py) {
    py.globals.set('_js_stdout_write', jsStdoutWrite);
    py.globals.set('_js_stderr_write', jsStderrWrite);
    py.runPython(`
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
        for l in lines: self.write(l)
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

  function installLoopGuard(py) {
    py.globals.set('_loop_guard_max_ops', MAX_OPS);
    py.globals.set('_loop_guard_deadline', Date.now() + MAX_MS);
    py.globals.set('_loop_guard_now', () => Date.now());
    py.runPython(`
import sys as _sys
_loop_guard_ops = 0
class _LoopLimitExceeded(Exception): pass
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

  async function runPythonSource(source) {
    const py = pyodideRef.current;
    if (!py) return;
    py.globals.set('_loop_guard_deadline', Date.now() + MAX_MS);
    py.runPython('_install_guard()');
    try {
      await py.runPythonAsync(source);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('_LoopLimitExceeded') || msg.includes('Execution limit') || msg.includes('Execution timed out')) {
        const clean = msg.match(/_LoopLimitExceeded: (.+)/)?.[1] || 'Execution stopped: possible infinite loop.';
        printErr('⏹ ' + clean);
      } else {
        const trimmed = msg.split('File "<exec>"').pop() || msg;
        printErr(trimmed.trim());
      }
    } finally {
      py.runPython('_remove_guard()');
      jsStdoutFlush();
      jsStderrFlush();
    }
    syncPyodideToVfs();
  }

  async function runPythonFile(filename) {
    const abs = resolvePath(filename);
    const node = vfsGet(abs);
    let source;
    if (typeof node === 'string') {
      source = node;
    } else if (filename === 'script.py' || filename === './script.py') {
      source = window.editor ? window.editor.getValue() : '';
      vfsSet(abs, source);
    } else {
      printErr(`python3: can't open file '${filename}': No such file or directory`);
      return;
    }
    await runPythonSource(source);
  }

  async function handleCommand(raw) {
    raw = raw.trim();
    if (!raw) return;

    cmdHistoryRef.current.unshift(raw);
    if (cmdHistoryRef.current.length > 200) cmdHistoryRef.current.pop();
    historyIdxRef.current = -1;

    printCmdEcho(getPromptStr(), raw);

    const args = tokenize(raw);
    const cmd = args[0];

    if (cmd === 'clear') { termOutputRef.current.innerHTML = ''; return; }

    if (cmd === 'python3' || cmd === 'python') {
      if (!pyReady) { printErr('Python not ready yet.'); return; }
      if (args[1] === '-c' && args[2]) {
        await runPythonSource(args.slice(2).join(' '));
      } else if (args[1]) {
        await runPythonFile(args[1]);
      } else {
        printErr('Interactive Python REPL not supported. Use: python3 script.py or python3 -c "code"');
      }
      return;
    }

    if (cmd === 'open') {
      if (!args[1]) { printErr('open: missing file operand'); return; }
      const target = resolvePath(args[1]);
      const node = vfsGet(target);
      if (args[1] === 'script.py' || args[1] === './script.py') {
        printInfo(`'${args[1]}' is already open in the editor.`); return;
      }
      if (node === undefined) { printErr(`open: ${args[1]}: No such file or directory`); return; }
      if (typeof node !== 'object') {
        if (!window.editor) { printErr('open: editor not ready yet'); return; }
        const ext = args[1].split('.').pop().toLowerCase();
        const langMap = { py: 'python', js: 'javascript', ts: 'typescript', json: 'json', html: 'html', css: 'css', md: 'markdown', sh: 'shell', txt: 'plaintext' };
        window.monaco?.editor.setModelLanguage(window.editor.getModel(), langMap[ext] || 'plaintext');
        window.editor.setValue(node);
        setEditorTab(args[1].split('/').pop());
        printInfo(`Opened '${args[1]}' in editor.`);
      } else { printErr(`open: ${args[1]}: Is a directory`); }
      return;
    }

    if (cmd === 'ls') {
      const target = args[1] ? resolvePath(args[1]) : cwdRef.current;
      const entries = vfsLs(target);
      if (entries === null) { printErr(`ls: cannot access '${args[1] || '.'}': No such file or directory`); return; }
      if (entries.length === 0) return;
      const node = vfsGet(target);
      const parts = entries.map(e => {
        const isDir = typeof node[e] === 'object';
        return `<span class="${isDir ? 'term-dir' : 'term-file'}">${esc(e)}${isDir ? '/' : ''}</span>`;
      });
      printLine(parts.join('  '));
      return;
    }

    if (cmd === 'pwd') { printOut(cwdRef.current); return; }

    if (cmd === 'cd') {
      const target = args[1] ? resolvePath(args[1]) : '/home/user';
      const node = vfsGet(target);
      if (node === undefined) { printErr(`cd: ${args[1]}: No such file or directory`); return; }
      if (typeof node !== 'object') { printErr(`cd: ${args[1]}: Not a directory`); return; }
      cwdRef.current = target;
      updatePrompt();
      if (pyodideRef.current) {
        try { await pyodideRef.current.runPythonAsync(`os.chdir('${target}')`); } catch (_) {}
      }
      return;
    }

    if (cmd === 'mkdir') {
      if (!args[1]) { printErr('mkdir: missing operand'); return; }
      const target = resolvePath(args[1]);
      if (vfsGet(target) !== undefined) { printErr(`mkdir: cannot create directory '${args[1]}': File exists`); return; }
      vfsSet(target, {});
      return;
    }

    if (cmd === 'touch') {
      if (!args[1]) { printErr('touch: missing file operand'); return; }
      const target = resolvePath(args[1]);
      if (vfsGet(target) === undefined) vfsSet(target, '');
      return;
    }

    if (cmd === 'cat') {
      if (!args[1]) { printErr('cat: missing operand'); return; }
      const target = resolvePath(args[1]);
      const node = vfsGet(target);
      if (node === undefined) {
        if (args[1] === 'script.py') { printOut(window.editor ? window.editor.getValue() : ''); return; }
        printErr(`cat: ${args[1]}: No such file or directory`); return;
      }
      if (typeof node === 'object') { printErr(`cat: ${args[1]}: Is a directory`); return; }
      printOut(node);
      return;
    }

    if (cmd === 'mv') {
      if (!args[1] || !args[2]) { printErr('mv: missing operand'); return; }
      const src = resolvePath(args[1]);
      const dstRaw = resolvePath(args[2]);
      const dstNode = vfsGet(dstRaw);
      const dst = (typeof dstNode === 'object') ? dstRaw + '/' + args[1].split('/').pop() : dstRaw;
      const srcNode = vfsGet(src);
      if (srcNode === undefined) { printErr(`mv: cannot stat '${args[1]}': No such file or directory`); return; }
      vfsSet(dst, srcNode);
      vfsDelete(src);
      return;
    }

    if (cmd === 'cp') {
      if (!args[1] || !args[2]) { printErr('cp: missing operand'); return; }
      const src = resolvePath(args[1]);
      const dstRaw = resolvePath(args[2]);
      const dstNode = vfsGet(dstRaw);
      const dst = (typeof dstNode === 'object') ? dstRaw + '/' + args[1].split('/').pop() : dstRaw;
      const srcNode = vfsGet(src);
      if (srcNode === undefined) { printErr(`cp: cannot stat '${args[1]}': No such file or directory`); return; }
      vfsSet(dst, JSON.parse(JSON.stringify(srcNode)));
      return;
    }

    if (cmd === 'rm') {
      if (!args[1]) { printErr('rm: missing operand'); return; }
      if (!vfsDelete(resolvePath(args[1]))) { printErr(`rm: cannot remove '${args[1]}': No such file or directory`); return; }
      return;
    }

    if (cmd === 'echo') { printOut(args.slice(1).join(' ')); return; }
    if (cmd === 'whoami') { printOut('user'); return; }
    if (cmd === 'hostname') { printOut('pyenv'); return; }
    if (cmd === 'uname') { printOut(args.includes('-a') ? 'Linux pyenv 5.15.0 #1 SMP x86_64 GNU/Linux' : 'Linux'); return; }
    if (cmd === 'date') { printOut(new Date().toString()); return; }
    if (cmd === 'env') { printOut('USER=user\nHOME=/home/user\nSHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin'); return; }
    if (cmd === 'which') {
      const cmds = { python3: '/usr/bin/python3', python: '/usr/bin/python3', ls: '/bin/ls', mv: '/bin/mv', cp: '/bin/cp', rm: '/bin/rm', mkdir: '/bin/mkdir', touch: '/bin/touch', cat: '/bin/cat', pwd: '/bin/pwd', cd: '/usr/bin/cd', echo: '/bin/echo', clear: '/usr/bin/clear', open: '/usr/bin/open' };
      if (args[1] && cmds[args[1]]) printOut(cmds[args[1]]);
      else if (args[1]) printErr(`${args[1]}: not found`);
      return;
    }
    if (cmd === 'help' || cmd === 'man') {
      printInfo('Available: python3, python, ls, cd, pwd, mkdir, touch, cat, mv, cp, rm, echo, clear, open, whoami, hostname, uname, date, env, which, help');
      return;
    }

    printErr(`${cmd}: command not found`);
  }

  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
    script1.onload = async () => {
      printInfo('Initializing Python 3.11 (Pyodide)...');
      const py = await window.loadPyodide();
      pyodideRef.current = py;
      installRealtimeIO(py);
      installLoopGuard(py);
      const ver = py.runPython(`import sys; sys.version.split()[0]`);
      const infoLine = termOutputRef.current?.querySelector('.term-line.term-info');
      if (infoLine) infoLine.remove();
      printOut('Python ' + ver + ' ready.');
      printLine('');
      setPyReady(true);
      updatePrompt();
    };
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js';
    script2.onload = () => {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        const saved = localStorage.getItem(EDITOR_KEY) || '';
        window.editor = window.monaco.editor.create(document.getElementById('monaco-editor'), {
          value: saved,
          language: 'python',
          theme: 'vs-dark',
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'Fira Code', 'ui-monospace', 'SFMono-Regular', Consolas, monospace",
          automaticLayout: true,
          padding: { top: 15 },
          scrollBeyondLastLine: false,
        });
        window.editor.onDidChangeModelContent(() => {
          localStorage.setItem(EDITOR_KEY, window.editor.getValue());
        });
      });
    };
    document.head.appendChild(script2);

    const splitScript = document.createElement('script');
    splitScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/split.js/1.6.0/split.min.js';
    splitScript.onload = () => {
      window.Split(['#left-split', '#right-split'], { sizes: [45, 55], minSize: 200, gutterSize: 8 });
      window.Split(['#problem-panel', '#canvas-panel'], { direction: 'vertical', sizes: [0, 100], minSize: [0, 41], gutterSize: 8 });
      rightSplitRef.current = window.Split(['#editor-panel', '#terminal-panel'], { direction: 'vertical', sizes: [70, 30], minSize: [100, 38], gutterSize: 8 });
    };
    document.head.appendChild(splitScript);

    return () => {
      if (window.editor) { window.editor.dispose(); window.editor = null; }
    };
  }, []);

  useEffect(() => {
    const input = termInputRef.current;
    if (!input) return;

    async function onKeyDown(e) {
      if (e.key === 'Enter') {
        const val = input.value;
        input.value = '';
        await handleCommand(val);
        updatePrompt();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const hist = cmdHistoryRef.current;
        if (historyIdxRef.current < hist.length - 1) {
          historyIdxRef.current++;
          input.value = hist[historyIdxRef.current];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdxRef.current > 0) { historyIdxRef.current--; input.value = cmdHistoryRef.current[historyIdxRef.current]; }
        else { historyIdxRef.current = -1; input.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = input.value;
        const args = tokenize(val);
        if (args.length === 0) return;
        const last = args[args.length - 1];
        const dirPart = last.includes('/') ? last.substring(0, last.lastIndexOf('/') + 1) : '';
        const namePart = last.includes('/') ? last.substring(last.lastIndexOf('/') + 1) : last;
        const searchDir = dirPart ? resolvePath(dirPart) : cwdRef.current;
        const entries = vfsLs(searchDir) || [];
        const matches = entries.filter(e => e.startsWith(namePart));
        if (matches.length === 1) { args[args.length - 1] = dirPart + matches[0]; input.value = args.join(' '); }
        else if (matches.length > 1) { printCmdEcho(getPromptStr(), val); printLine(matches.map(m => esc(m)).join('  ')); }
      } else if (e.key === 'c' && e.ctrlKey) {
        printCmdEcho(getPromptStr(), input.value + '^C');
        input.value = '';
        historyIdxRef.current = -1;
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        termOutputRef.current.innerHTML = '';
      }
    }

    input.addEventListener('keydown', onKeyDown);
    return () => input.removeEventListener('keydown', onKeyDown);
  }, [pyReady]);

  async function executeFromButton() {
    if (!pyReady) return;
    if (termClosed) {
      document.getElementById('terminal-panel').style.display = '';
      if (rightSplitRef.current) rightSplitRef.current.setSizes(prevRightSizesRef.current);
      setTermClosed(false);
    }
    termInputRef.current?.focus();
    const source = window.editor ? window.editor.getValue() : '';
    vfsSet(resolvePath('script.py'), source);
    printCmdEcho(getPromptStr(), 'python3 script.py');
    await runPythonFile('script.py');
    printLine('');
    updatePrompt();
    termInputRef.current?.focus();
  }

  function handleTermClose() {
    if (rightSplitRef.current) prevRightSizesRef.current = rightSplitRef.current.getSizes();
    document.getElementById('terminal-panel').style.display = 'none';
    if (rightSplitRef.current) rightSplitRef.current.setSizes([100, 0]);
    setTermClosed(true);
  }

  return (
    <div className="assignment-page">
      <Navbar onHome={() => navigate('/')} />
      <div className="main-container">
        <div id="left-split" className="split">
          <div id="problem-panel" className="panel">
            <div className="panel-content" />
          </div>
          <div id="canvas-panel" className="panel">
            <div className="panel-header">
              <span>Visualization Canvas</span>
            </div>
            <div id="canvas-container" className="panel-content canvas-container">
              <canvas id="myCanvas" />
            </div>
          </div>
        </div>
        <div id="right-split" className="split">
          <div id="editor-panel" className="panel">
            <div className="panel-header">
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {editorTab.endsWith('.py') && PYTHON_LOGO}
                {editorTab}
              </span>
            </div>
            <div id="editor-container" className="panel-content" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div id="monaco-editor" style={{ width: '100%', height: '100%', flexGrow: 1 }} />
            </div>
            <div className="editor-action-bar">
              <button className="btn-run" disabled={!pyReady} onClick={executeFromButton}>
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
                Run
              </button>
              <button className="btn-submit" disabled={!pyReady} onClick={executeFromButton}>
                Submit answer
              </button>
            </div>
          </div>
          <div id="terminal-panel" className="panel terminal-override">
            <div className="terminal-titlebar">
              <span className="terminal-title">bash — python3</span>
              <button className="terminal-close-btn" onClick={handleTermClose}>&#x2715;</button>
            </div>
            <div className="terminal-body" ref={termBodyRef} onClick={() => termInputRef.current?.focus()}>
              <div id="terminal-output" ref={termOutputRef} />
              <div className="term-input-line">
                <span className="term-prompt">{promptStr}</span>
                <input
                  ref={termInputRef}
                  type="text"
                  className="term-input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}