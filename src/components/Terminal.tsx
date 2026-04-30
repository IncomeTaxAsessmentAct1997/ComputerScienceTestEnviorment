'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { vfs, cwd, setCwd, vfsGet, vfsSet, vfsDelete, vfsLs, resolvePath, promptStr, esc } from '@/lib/vfs';

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
  printCmdEcho: (prompt: string, cmd: string) => void;
  focus: () => void;
  updatePrompt: () => void;
  getPrompt: () => string;
}

interface TerminalProps {
  pyodideReady: boolean;
  pyodide: any;
  onRunFile: (filename: string) => Promise<void>;
  onRunInline: (code: string) => Promise<void>;
  onGetEditorValue: () => string;
  onSetEditorTab: (name: string) => void;
  onSetEditorLanguage: (lang: string) => void;
  onSetEditorValue: (val: string) => void;
  onClose: () => void;
}

let lineId = 0;

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { pyodideReady, pyodide, onRunFile, onRunInline, onGetEditorValue, onSetEditorTab, onSetEditorLanguage, onSetEditorValue, onClose },
  ref
) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [promptText, setPromptText] = useState(promptStr());
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollBottom() {
    setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, 0);
  }

  function addLine(html: string, cls = '') {
    setLines(prev => [...prev, { id: lineId++, html, cls }]);
    scrollBottom();
  }

  function printLine(html: string, cls = '') { addLine(html, cls); }
  function printOut(text: string) { if (text) addLine(esc(text), 'term-out'); }
  function printErr(text: string) { addLine(esc(text), 'term-err'); }
  function printInfo(text: string) { addLine(esc(text), 'term-info'); }
  function printCmdEcho(prompt: string, cmd: string) {
    addLine(`<span class="term-prompt">${esc(prompt)}</span> <span class="term-cmd-echo">${esc(cmd)}</span>`);
  }

  function updatePrompt() { setPromptText(promptStr()); }

  useImperativeHandle(ref, () => ({
    printOut, printErr, printInfo, printLine, printCmdEcho,
    focus: () => inputRef.current?.focus(),
    updatePrompt,
    getPrompt: () => promptStr(),
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

  async function handleCommand(raw: string) {
    raw = raw.trim();
    if (!raw) return;

    setCmdHistory(prev => [raw, ...prev.slice(0, 199)]);
    setHistoryIdx(-1);

    const currentPrompt = promptStr();
    printCmdEcho(currentPrompt, raw);

    const args = tokenize(raw);
    const cmd = args[0];

    if (cmd === 'clear') { setLines([]); return; }

    if (cmd === 'python3' || cmd === 'python') {
      if (!pyodideReady) { printErr('Python not ready yet.'); return; }
      if (args[1] === '-c' && args[2]) {
        await onRunInline(args.slice(2).join(' '));
      } else if (args[1]) {
        await onRunFile(args[1]);
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
      if (typeof node !== 'string') { printErr(`open: ${args[1]}: Is a directory`); return; }
      const ext = args[1].split('.').pop()?.toLowerCase() || '';
      const langMap: Record<string, string> = { py: 'python', js: 'javascript', ts: 'typescript', json: 'json', html: 'html', css: 'css', md: 'markdown', sh: 'shell', txt: 'plaintext' };
      onSetEditorLanguage(langMap[ext] || 'plaintext');
      onSetEditorValue(node);
      onSetEditorTab(args[1].split('/').pop() || args[1]);
      printInfo(`Opened '${args[1]}' in editor.`);
      return;
    }

    if (cmd === 'ls') {
      const target = args[1] ? resolvePath(args[1]) : cwd;
      const entries = vfsLs(target);
      if (entries === null) { printErr(`ls: cannot access '${args[1] || '.'}': No such file or directory`); return; }
      if (entries.length === 0) return;
      const node = vfsGet(target);
      if (typeof node === 'object') {
        const parts = entries.map(e => {
          const isDir = typeof (node as Record<string, unknown>)[e] === 'object';
          return `<span class="${isDir ? 'term-dir' : 'term-file'}">${esc(e)}${isDir ? '/' : ''}</span>`;
        });
        addLine(parts.join('  '));
      }
      return;
    }

    if (cmd === 'pwd') { printOut(cwd); return; }

    if (cmd === 'cd') {
      const target = args[1] ? resolvePath(args[1]) : '/home/user';
      const node = vfsGet(target);
      if (node === undefined) { printErr(`cd: ${args[1]}: No such file or directory`); return; }
      if (typeof node !== 'object') { printErr(`cd: ${args[1]}: Not a directory`); return; }
      setCwd(target);
      updatePrompt();
      if (pyodideReady && pyodide) {
        try { await pyodide.runPythonAsync(`os.chdir('${target}')`); } catch (_) {}
      }
      return;
    }

    if (cmd === 'mkdir') {
      if (!args[1]) { printErr('mkdir: missing operand'); return; }
      const target = resolvePath(args[1]);
      if (vfsGet(target) !== undefined) { printErr(`mkdir: cannot create directory '${args[1]}': File exists`); return; }
      vfsSet(target, {}); return;
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
        if (args[1] === 'script.py') { printOut(onGetEditorValue()); return; }
        printErr(`cat: ${args[1]}: No such file or directory`); return;
      }
      if (typeof node !== 'string') { printErr(`cat: ${args[1]}: Is a directory`); return; }
      printOut(node); return;
    }

    if (cmd === 'mv' || cmd === 'cp') {
      if (!args[1] || !args[2]) { printErr(`${cmd}: missing operand`); return; }
      const src = resolvePath(args[1]);
      const dstRaw = resolvePath(args[2]);
      const dstNode = vfsGet(dstRaw);
      const dst = (typeof dstNode === 'object') ? dstRaw + '/' + args[1].split('/').pop() : dstRaw;
      const srcNode = vfsGet(src);
      if (srcNode === undefined) {
        if (args[1] === 'script.py') { vfsSet(dst, onGetEditorValue()); return; }
        printErr(`${cmd}: cannot stat '${args[1]}': No such file or directory`); return;
      }
      vfsSet(dst, cmd === 'cp' ? JSON.parse(JSON.stringify(srcNode)) : srcNode);
      if (cmd === 'mv') vfsDelete(src);
      return;
    }

    if (cmd === 'rm') {
      if (!args[1]) { printErr('rm: missing operand'); return; }
      const target = resolvePath(args[1]);
      if (!vfsDelete(target)) { printErr(`rm: cannot remove '${args[1]}': No such file or directory`); return; }
      return;
    }

    if (cmd === 'echo') { printOut(args.slice(1).join(' ')); return; }
    if (cmd === 'whoami') { printOut('user'); return; }
    if (cmd === 'hostname') { printOut('pyenv'); return; }
    if (cmd === 'uname') { printOut(args.includes('-a') ? 'Linux pyenv 5.15.0 #1 SMP x86_64 GNU/Linux' : 'Linux'); return; }
    if (cmd === 'date') { printOut(new Date().toString()); return; }
    if (cmd === 'env') { printOut('USER=user\nHOME=/home/user\nSHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin'); return; }

    if (cmd === 'which') {
      const cmds: Record<string, string> = { python3: '/usr/bin/python3', python: '/usr/bin/python3', ls: '/bin/ls', mv: '/bin/mv', cp: '/bin/cp', rm: '/bin/rm', mkdir: '/bin/mkdir', touch: '/bin/touch', cat: '/bin/cat', pwd: '/bin/pwd', cd: '/usr/bin/cd', echo: '/bin/echo', clear: '/usr/bin/clear', open: '/usr/bin/open' };
      if (args[1] && cmds[args[1]]) printOut(cmds[args[1]]);
      else if (args[1]) printErr(`${args[1]}: not found`);
      return;
    }

    if (cmd === 'help' || cmd === 'man') {
      printInfo('Available commands: python3, python, ls, cd, pwd, mkdir, touch, cat, mv, cp, rm, echo, clear, open, whoami, hostname, uname, date, env, which, help');
      printInfo('  open <file>  — open a file from the filesystem into the editor');
      return;
    }

    printErr(`${cmd}: command not found`);
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputVal;
      setInputVal('');
      await handleCommand(val);
      updatePrompt();
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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const args = tokenize(inputVal);
      if (args.length === 0) return;
      const last = args[args.length - 1];
      const dirPart = last.includes('/') ? last.substring(0, last.lastIndexOf('/') + 1) : '';
      const namePart = last.includes('/') ? last.substring(last.lastIndexOf('/') + 1) : last;
      const searchDir = dirPart ? resolvePath(dirPart) : cwd;
      const entries = vfsLs(searchDir) || [];
      const matches = entries.filter(e => e.startsWith(namePart));
      if (matches.length === 1) {
        args[args.length - 1] = dirPart + matches[0];
        setInputVal(args.join(' '));
      } else if (matches.length > 1) {
        printCmdEcho(promptStr(), inputVal);
        addLine(matches.map(m => esc(m)).join('  '));
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      printCmdEcho(promptStr(), inputVal + '^C');
      setInputVal('');
      setHistoryIdx(-1);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div className="panel terminal-override" id="terminal-panel">
      <div className="terminal-titlebar">
        <span className="terminal-title">bash — python3</span>
        <button className="terminal-close-btn" title="Close" onClick={onClose}>&#x2715;</button>
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
        <div className="term-input-line">
          <span className="term-prompt">{promptText}</span>
          <input
            ref={inputRef}
            type="text"
            className="term-input"
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

export default Terminal;
