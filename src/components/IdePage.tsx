'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Split from 'react-split';
import { getSession } from '@/lib/session';
import { vfsGet, vfsSet, resolvePath } from '@/lib/vfs';
import Navbar from './Navbar';
import type { TerminalHandle } from './Terminal';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

const Terminal = dynamic(() => import('./Terminal'), { ssr: false });

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const MAX_OPS = 500_000;
const MAX_MS = 10_000;

const PYTHON_LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px"><defs><linearGradient id="pyBl" x1="12%" y1="12%" x2="83%" y2="88%"><stop offset="0" stop-color="#387EB8"/><stop offset="1" stop-color="#366994"/></linearGradient><linearGradient id="pyYe" x1="19%" y1="20%" x2="90%" y2="88%"><stop offset="0" stop-color="#FFE052"/><stop offset="1" stop-color="#FFC331"/></linearGradient></defs><path fill="url(#pyBl)" d="M126.9.9c-64.2 0-60.2 27.9-60.2 27.9l.1 28.9h61.3v8.7H43.3S5.2 61.8 5.2 126.6c0 64.8 35.8 62.5 35.8 62.5h21.4v-30s-1.2-35.8 35.2-35.8h60.7s34.1.6 34.1-32.9V35.6S197.1.9 126.9.9zm-33.8 19.6a11 11 0 1 1 0 22 11 11 0 0 1 0-22z"/><path fill="url(#pyYe)" d="M128.8 254.1c64.2 0 60.2-27.9 60.2-27.9l-.1-28.9h-61.3v-8.7h84.8s38.2 4.6 38.2-60.2c0-64.8-35.8-62.5-35.8-62.5h-21.4v30s1.2 35.8-35.2 35.8H97.5S63.4 121.1 63.4 154.6v88.8s-5.3 10.7 65.4 10.7zm33.8-19.6a11 11 0 1 1 0-22 11 11 0 0 1 0 22z"/></svg>`;

export default function IdePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [editorTabName, setEditorTabName] = useState('script.py');
  const [editorLanguage, setEditorLanguage] = useState('python');
  const [pyodideReady, setPyodideReady] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [runBtnDisabled, setRunBtnDisabled] = useState(true);
  const pyodideRef = useRef<any>(null);
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<any>(null);
  const currentFileRef = useRef('script.py');

  useEffect(() => {
    const sessionEmail = getSession();
    if (!sessionEmail) { router.replace('/login'); return; }
    setEmail(sessionEmail);
    const editorKey = 'py_challenge_editor_' + sessionEmail;
    const saved = localStorage.getItem(editorKey) || '';
    setEditorValue(saved);
    initPyodide();
  }, []);

  async function initPyodide() {
    terminalRef.current?.printInfo('Initializing Python 3.11 (Pyodide)...');
    
    if (!window.loadPyodide) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      document.head.appendChild(script);
      await new Promise((resolve) => { script.onload = resolve; });
    }

    const py = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
    });
    
    pyodideRef.current = py;

    installRealtimeIO(py);
    installLoopGuard(py);

    const ver = py.runPython(`import sys; sys.version.split()[0]`);
    terminalRef.current?.printOut('Python ' + ver + ' ready.');
    terminalRef.current?.printLine('');

    setPyodideReady(true);
    setRunBtnDisabled(false);
    terminalRef.current?.updatePrompt();
  }

  function installRealtimeIO(py: any) {
    const stdoutBuf = { buf: '' };
    const stderrBuf = { buf: '' };

    py.globals.set('_js_stdout_write', (text: string) => {
      if (!text) return;
      stdoutBuf.buf += text;
      const lines = stdoutBuf.buf.split('\n');
      stdoutBuf.buf = lines.pop() || '';
      for (const line of lines) terminalRef.current?.printOut(line);
    });

    py.globals.set('_js_stderr_write', (text: string) => {
      if (!text) return;
      stderrBuf.buf += text;
      const lines = stderrBuf.buf.split('\n');
      stderrBuf.buf = lines.pop() || '';
      for (const line of lines) terminalRef.current?.printErr(line);
    });

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

  function installLoopGuard(py: any) {
    py.globals.set('_loop_guard_max_ops', MAX_OPS);
    py.globals.set('_loop_guard_deadline', Date.now() + MAX_MS);
    py.globals.set('_loop_guard_now', () => Date.now());

    py.runPython(`
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

  async function runPythonSource(source: string) {
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
        terminalRef.current?.printErr('⏹ ' + clean);
      } else {
        const trimmed = msg.split('File "<exec>"').pop() || msg;
        terminalRef.current?.printErr(trimmed.trim());
      }
    } finally {
      py.runPython('_remove_guard()');
    }

    syncPyodideToVfs();
  }

  function syncPyodideToVfs() {
    const py = pyodideRef.current;
    if (!py) return;
    function readDir(path: string): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      let entries: string[];
      try { entries = py.FS.readdir(path); } catch { return result; }
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        const full = path + '/' + entry;
        const stat = py.FS.stat(full);
        if (py.FS.isDir(stat.mode)) {
          result[entry] = readDir(full);
        } else {
          try { result[entry] = py.FS.readFile(full, { encoding: 'utf8' }); } catch { result[entry] = ''; }
        }
      }
      return result;
    }
    try {
      (vfsGet('/home/user') as any);
      vfsSet('/home/user', readDir('/home/user') as any);
    } catch {}
  }

  async function runPythonFile(filename: string) {
    const abs = resolvePath(filename);
    const node = vfsGet(abs);
    let source: string;
    if (typeof node === 'string') {
      source = node;
    } else if (filename === 'script.py' || filename === './script.py') {
      source = editorRef.current?.getValue() || editorValue;
      vfsSet(abs, source);
    } else {
      terminalRef.current?.printErr(`python3: can't open file '${filename}': No such file or directory`);
      return;
    }
    await runPythonSource(source);
  }

  async function executeFromButton() {
    if (!pyodideReady) return;
    if (!terminalVisible) setTerminalVisible(true);
    const source = editorRef.current?.getValue() || editorValue;
    const filename = currentFileRef.current;
    vfsSet(resolvePath(filename), source);
    const prompt = terminalRef.current?.getPrompt() || 'user@pyenv:~$';
    terminalRef.current?.printCmdEcho(prompt, `python3 ${filename}`);
    await runPythonFile(filename);
    terminalRef.current?.printLine('');
    terminalRef.current?.updatePrompt();
    terminalRef.current?.focus();
  }

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (val: string | undefined) => {
    const v = val || '';
    setEditorValue(v);
    if (email) localStorage.setItem('py_challenge_editor_' + email, v);
  };

  const getEditorTabHtml = () => {
    if (editorTabName.endsWith('.py')) {
      return { __html: PYTHON_LOGO_SVG + editorTabName };
    }
    return { __html: editorTabName };
  };

  return (
    <>
      <style>{`
        .split-wrapper {
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .split-wrapper > .panel {
          height: calc(100% - 8px);
          margin: 4px;
        }
        .terminal-wrapper > .panel {
          height: calc(100% - 8px);
          margin: 4px;
        }
      `}</style>
      <Navbar email={email} />
      <Split
        className="main-container"
        direction="horizontal"
        sizes={[45, 55]}
        minSize={250}
        gutterSize={8}
      >
        <Split
          id="left-split"
          className="split"
          direction="vertical"
          sizes={canvasVisible ? [50, 50] : [100, 0]}
          minSize={canvasVisible ? [100, 100] : [100, 0]}
          gutterSize={canvasVisible ? 8 : 0}
        >
          <div className="split-wrapper">
            <div id="problem-panel" className="panel">
              <div className="panel-header flex-header" style={{ minHeight: '38px' }}>
                <span>Problem</span>
                {!canvasVisible && (
                  <button 
                    className="btn-run"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                    onClick={() => setCanvasVisible(true)}
                  >
                    Show Canvas
                  </button>
                )}
              </div>
              <div className="panel-content" />
            </div>
          </div>
          
          <div className="split-wrapper" style={{ display: canvasVisible ? '' : 'none' }}>
            <div id="canvas-panel" className="panel">
              <div className="terminal-titlebar">
                <span className="terminal-title">Visualization Canvas</span>
                <button 
                  className="terminal-close-btn" 
                  title="Close Canvas" 
                  onClick={() => setCanvasVisible(false)}
                >
                  &#x2715;
                </button>
              </div>
              <div className="panel-content canvas-container">
                <canvas id="myCanvas" />
              </div>
            </div>
          </div>
        </Split>

        <Split
          id="right-split"
          className="split"
          direction="vertical"
          sizes={terminalVisible ? [65, 35] : [100, 0]}
          minSize={terminalVisible ? [100, 100] : [100, 0]}
          gutterSize={terminalVisible ? 8 : 0}
        >
          <div className="split-wrapper">
            <div id="editor-panel" className="panel">
              <div className="panel-header flex-header" style={{ minHeight: '38px' }}>
                <span 
                  style={{ display: 'inline-flex', alignItems: 'center' }} 
                  dangerouslySetInnerHTML={getEditorTabHtml()} 
                />
              </div>
              <div id="editor-container" className="panel-content" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <MonacoEditor
                  height="100%"
                  language={editorLanguage}
                  theme="vs-dark"
                  value={editorValue}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'Fira Code', 'ui-monospace', 'SFMono-Regular', Consolas, monospace",
                    automaticLayout: true,
                    padding: { top: 15 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
              <div className="editor-action-bar">
                <button suppressHydrationWarning className="btn-run" id="run-btn" disabled={runBtnDisabled} onClick={executeFromButton}>
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
                  Run
                </button>
                <button suppressHydrationWarning className="btn-submit" id="submit-btn" disabled={runBtnDisabled} onClick={executeFromButton}>
                  Submit answer
                </button>
              </div>
            </div>
          </div>

          <div className="split-wrapper terminal-wrapper" style={{ display: terminalVisible ? '' : 'none' }}>
            <Terminal
              ref={terminalRef}
              pyodideReady={pyodideReady}
              pyodide={pyodideRef.current}
              onRunFile={runPythonFile}
              onRunInline={runPythonSource}
              onGetEditorValue={() => editorRef.current?.getValue() || editorValue}
              onSetEditorTab={(name) => {
                currentFileRef.current = name;
                setEditorTabName(name);
              }}
              onSetEditorLanguage={setEditorLanguage}
              onSetEditorValue={(val) => {
                setEditorValue(val);
                editorRef.current?.setValue(val);
              }}
              onClose={() => setTerminalVisible(false)}
            />
          </div>
        </Split>
      </Split>
    </>
  );
}