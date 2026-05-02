'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { idbGet, idbSet, idbDelete, idbList, idbIsReadonly, idbSetReadonly, esc } from '@/lib/vfs';

interface TermLine {
  id: number;
  html: string;
  cls: string;
}

export interface TerminalHandle {
  printOut: (text: string) => void;
  printErr: (text: string) => void;
  printInfo: (text: string) => void;
  printLine: (html: string, cls?: string) => void;
  printCmdEcho: (cmd: string) => void;
  focus: () => void;
  getPrompt: () => string;
}

interface TerminalPanelProps {
  problemId: string;
  isAdmin?: boolean;
  isReady: boolean;
  isRunning: boolean;
  runPython: (code: string) => Promise<void>;
  currentFile: string;
  onGetEditorValue: () => string;
  onOpenFile: (filename: string, content: string) => void;
  onClose: () => void;
}

const PROMPT = 'py-env $';
let lineId = 0;

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  color: 'var(--text-main)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  lineHeight: '20px',
  height: '20px',
  padding: '0',
  margin: '0',
  borderRadius: '0',
  caretColor: '#ffffff',
  width: '100%',
};

const TerminalPanel = forwardRef<TerminalHandle, TerminalPanelProps>(function TerminalPanel(
  { problemId, isAdmin = false, isReady, isRunning, runPython, currentFile, onGetEditorValue, onOpenFile, onClose },
  ref
) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollBottom() {
    setTimeout(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, 0);
  }

  function addLine(html: string, cls = '') {
    setLines(prev => [...prev, { id: lineId++, html, cls }]);
    scrollBottom();
  }

  function printLine(html: string, cls = '') { addLine(html, cls); }
  function printOut(text: string) { if (text) addLine(esc(text), 'term-out'); }
  function printErr(text: string) { addLine(esc(text), 'term-err'); }
  function printInfo(text: string) { addLine(esc(text), 'term-info'); }
  function printCmdEcho(cmd: string) {
    addLine(`<span class="term-prompt">${esc(PROMPT)}</span> <span class="term-cmd-echo">${esc(cmd)}</span>`);
  }

  useImperativeHandle(ref, () => ({
    printOut, printErr, printInfo, printLine, printCmdEcho,
    focus: () => inputRef.current?.focus(),
    getPrompt: () => PROMPT,
  }));

  function tokenize(raw: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    for (const ch of raw) {
      if (inQuote) {
        if (ch === inQuote) { inQuote = null; tokens.push(current); current = ''; }
        else current += ch;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ') {
        if (current) { tokens.push(current); current = ''; }
      } else {
        current += ch;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }

  async function runPythonFile(filename: string) {
    if (!isReady) { printErr('Python not ready yet.'); return; }
    if (isRunning) { printErr('Python is already running.'); return; }
    let source: string;
    if (filename === currentFile) {
      source = onGetEditorValue();
      await idbSet(problemId, filename, source);
    } else {
      const content = await idbGet(problemId, filename);
      if (content === undefined) { printErr(`python3: '${filename}': no such file`); return; }
      source = content;
    }
    await runPython(source);
    printLine('');
  }

  async function handleCommand(raw: string) {
    raw = raw.trim();
    if (!raw) return;

    setCmdHistory(prev => [raw, ...prev.slice(0, 199)]);
    setHistoryIdx(-1);
    printCmdEcho(raw);

    const args = tokenize(raw);
    const cmd = args[0];

    if (cmd === 'clear' && !args[1]) { setLines([]); return; }

    if (cmd === 'help') {
      const studentCommands: [string, string][] = [
        ['list', 'List all files in the workspace'],
        ['open <file>', 'Open a file in the editor'],
        ['python3 <file>', 'Run a Python file'],
        ['python3 -c "code"', 'Execute Python inline'],
        ['clear', 'Clear terminal output'],
        ['help', 'Show this help'],
      ];
      const adminCommands: [string, string][] = [
        ['create <file>', 'Create a new empty file'],
        ['create <file> readonly', 'Create a file students cannot edit'],
        ['set <file> readonly true|false', 'Toggle readonly on a file'],
        ['delete <file>', 'Permanently delete a file'],
        ['clear <file>', 'Empty a file\'s contents'],
      ];
      const allCommands = isAdmin ? [...studentCommands, ...adminCommands] : studentCommands;
      allCommands.forEach(([name, desc]) => {
        addLine(
          `<span style="color:var(--accent-green);font-family:var(--font-mono);font-size:12px;">${esc(name)}</span>` +
          `<span style="color:#555;font-size:12px;margin-left:12px;">${esc(desc)}</span>`,
          'term-info'
        );
      });
      return;
    }

    if (cmd === 'list') {
      try {
        const files = await idbList(problemId);
        if (files.length === 0) {
          printInfo('No files.');
        } else {
          files.sort().forEach(f => addLine(`<span class="term-file">${esc(f)}</span>`));
        }
      } catch (e: any) {
        printErr(e?.message || 'list failed');
      }
      return;
    }

    if (cmd === 'open') {
      if (!args[1]) { printErr('open: missing filename'); return; }
      try {
        const content = await idbGet(problemId, args[1]);
        if (content === undefined) { printErr(`open: '${args[1]}' not found`); return; }
        onOpenFile(args[1], content);
      } catch (e: any) {
        printErr(e?.message || 'open failed');
      }
      return;
    }

    if (cmd === 'python3' || cmd === 'python') {
      if (!isReady) { printErr('Python not ready yet.'); return; }
      if (args[1] === '-c' && args[2]) {
        if (isRunning) { printErr('Python is already running.'); return; }
        await runPython(args.slice(2).join(' '));
        printLine('');
      } else if (args[1]) {
        await runPythonFile(args[1]);
      } else {
        printErr('Usage: python3 <file>  or  python3 -c "code"');
      }
      return;
    }

    if (cmd === 'create') {
      if (!isAdmin) { printErr(`${cmd}: command not found`); return; }
      if (!args[1]) { printErr('create: missing filename'); return; }
      const makeReadonly = args[2] === 'readonly';
      try {
        const existing = await idbGet(problemId, args[1]);
        if (existing === undefined) await idbSet(problemId, args[1], '');
        if (makeReadonly) await idbSetReadonly(problemId, args[1], true);
      } catch (e: any) {
        printErr(e?.message || 'create failed');
      }
      return;
    }

    if (cmd === 'set') {
      if (!isAdmin) { printErr(`${cmd}: command not found`); return; }
      const name = args[1];
      const prop = args[2];
      const val = args[3];
      if (!name || prop !== 'readonly' || (val !== 'true' && val !== 'false')) {
        printErr('Usage: set <file> readonly true|false');
        return;
      }
      try {
        const existing = await idbGet(problemId, name);
        if (existing === undefined) { printErr(`set: '${name}' not found`); return; }
        await idbSetReadonly(problemId, name, val === 'true');
      } catch (e: any) {
        printErr(e?.message || 'set failed');
      }
      return;
    }

    if (cmd === 'delete') {
      if (!isAdmin) { printErr(`${cmd}: command not found`); return; }
      if (!args[1]) { printErr('delete: missing filename'); return; }
      try {
        const ro = await idbIsReadonly(problemId, args[1]);
        if (ro) { printErr(`delete: '${args[1]}' is readonly`); return; }
        const existing = await idbGet(problemId, args[1]);
        if (existing === undefined) { printErr(`delete: '${args[1]}' not found`); return; }
        await idbDelete(problemId, args[1]);
      } catch (e: any) {
        printErr(e?.message || 'delete failed');
      }
      return;
    }

    if (cmd === 'clear' && args[1]) {
      if (!isAdmin) { printErr(`${cmd}: command not found`); return; }
      try {
        const ro = await idbIsReadonly(problemId, args[1]);
        if (ro) { printErr(`clear: '${args[1]}' is readonly`); return; }
        const existing = await idbGet(problemId, args[1]);
        if (existing === undefined) { printErr(`clear: '${args[1]}' not found`); return; }
        await idbSet(problemId, args[1], '');
        onOpenFile(args[1], '');
      } catch (e: any) {
        printErr(e?.message || 'clear failed');
      }
      return;
    }

    printErr(`${cmd}: command not found`);
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputVal;
      setInputVal('');
      await handleCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCmdHistory(prev => {
        const newIdx = Math.min(historyIdx + 1, prev.length - 1);
        setHistoryIdx(newIdx);
        if (prev[newIdx] !== undefined) setInputVal(prev[newIdx]);
        return prev;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = historyIdx - 1;
      if (newIdx < 0) { setHistoryIdx(-1); setInputVal(''); }
      else { setHistoryIdx(newIdx); setInputVal(cmdHistory[newIdx] || ''); }
    } else if (e.key === 'c' && e.ctrlKey) {
      printCmdEcho(inputVal + '^C');
      setInputVal('');
      setHistoryIdx(-1);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  function handleClose() {
    setLines([]);
    onClose();
  }

  return (
    <div className="panel terminal-override" id="terminal-panel">
      <div className="terminal-titlebar">
        <span className="terminal-title">terminal</span>
        <button
          title="Close"
          onClick={handleClose}
          onMouseEnter={e => { e.currentTarget.style.background = '#c42b1c'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-main)'; }}
          style={{
            background: 'none', border: 'none', color: 'var(--text-main)',
            fontSize: '14px', lineHeight: '1', width: '38px', height: '38px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: '0', borderRadius: '0',
          }}
        >
          ✕
        </button>
      </div>

      <div className="terminal-body" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
        <div id="terminal-output">
          {lines.map(l => (
            <span
              key={l.id}
              className={`term-line${l.cls ? ' ' + l.cls : ''}`}
              dangerouslySetInnerHTML={{ __html: l.html }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px', lineHeight: '20px' }}>
          <span style={{
            color: '#2ecc71', fontWeight: 600, fontFamily: 'var(--font-mono)',
            fontSize: '13px', lineHeight: '20px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {PROMPT}
          </span>
          <input
            ref={inputRef}
            type="text"
            style={inputStyle}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  );
});

export default TerminalPanel;
