'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Split from 'react-split';
import { idbGet, idbSet, idbGetLastFile, idbSetLastFile, idbEnsureMainPy } from '@/lib/vfs';
import PythonRunnerProvider, { usePythonRunner } from './PythonRunnerContext';
import QuestionPanel from './QuestionPanel';
import AdminQuestionPanel from './adminQuestionPanel/AdminQuestionPanel';
import type { TerminalHandle } from './TerminalPanel';

const TerminalPanel = dynamic(() => import('./TerminalPanel'), { ssr: false });
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const PYTHON_LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px"><defs><linearGradient id="pyBl" x1="12%" y1="12%" x2="83%" y2="88%"><stop offset="0" stop-color="#387EB8"/><stop offset="1" stop-color="#366994"/></linearGradient><linearGradient id="pyYe" x1="19%" y1="20%" x2="90%" y2="88%"><stop offset="0" stop-color="#FFE052"/><stop offset="1" stop-color="#FFC331"/></linearGradient></defs><path fill="url(#pyBl)" d="M126.9.9c-64.2 0-60.2 27.9-60.2 27.9l.1 28.9h61.3v8.7H43.3S5.2 61.8 5.2 126.6c0 64.8 35.8 62.5 35.8 62.5h21.4v-30s-1.2-35.8 35.2-35.8h60.7s34.1.6 34.1-32.9V35.6S197.1.9 126.9.9zm-33.8 19.6a11 11 0 1 1 0 22 11 11 0 0 1 0-22z"/><path fill="url(#pyYe)" d="M128.8 254.1c64.2 0 60.2-27.9 60.2-27.9l-.1-28.9h-61.3v-8.7h84.8s38.2 4.6 38.2-60.2c0-64.8-35.8-62.5-35.8-62.5h-21.4v30s1.2 35.8-35.2 35.8H97.5S63.4 121.1 63.4 154.6v88.8s-5.3 10.7 65.4 10.7zm33.8-19.6a11 11 0 1 1 0-22 11 11 0 0 1 0 22z"/></svg>`;

const DEFAULT_FILE = 'main.py';

const EXT_LANG: Record<string, string> = {
  py: 'python', js: 'javascript', ts: 'typescript',
  json: 'json', html: 'html', css: 'css',
  md: 'markdown', sh: 'shell', txt: 'plaintext',
};

function langForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_LANG[ext] || 'plaintext';
}

interface Problem {
  id: string;
  title: string;
  content: string | null;
}

interface EditorSectionProps {
  problemId: string;
  isAdmin: boolean;
  terminalRef: React.RefObject<TerminalHandle | null>;
  terminalVisible: boolean;
  setTerminalVisible: (v: boolean) => void;
}

function EditorSection({ problemId, isAdmin, terminalRef, terminalVisible, setTerminalVisible }: EditorSectionProps) {
  const { runPython, isLoading, isRunning } = usePythonRunner();
  const [editorValue, setEditorValue] = useState('');
  const [editorTabName, setEditorTabName] = useState(DEFAULT_FILE);
  const [editorLanguage, setEditorLanguage] = useState('python');
  const [ready, setReady] = useState(false);
  const editorRef = useRef<any>(null);
  const currentFileRef = useRef(DEFAULT_FILE);
  const problemIdRef = useRef(problemId);

  const isReady = !isLoading;
  const runBtnDisabled = !isReady || isRunning || !ready;

  useEffect(() => { problemIdRef.current = problemId; }, [problemId]);

  useEffect(() => { initVfs(); }, [problemId]);

  async function initVfs() {
    setReady(false);
    await idbEnsureMainPy(problemId);
    const lastFile = await idbGetLastFile(problemId);
    const filename = lastFile || DEFAULT_FILE;
    let content = await idbGet(problemId, filename);
    if (content === undefined) {
      content = '';
      await idbSet(problemId, filename, content);
    }
    currentFileRef.current = filename;
    setEditorTabName(filename);
    setEditorLanguage(langForFile(filename));
    setEditorValue(content);
    editorRef.current?.setValue(content);
    setReady(true);
  }

  function openFileInEditor(filename: string, content: string) {
    currentFileRef.current = filename;
    setEditorTabName(filename);
    setEditorLanguage(langForFile(filename));
    setEditorValue(content);
    editorRef.current?.setValue(content);
    idbSetLastFile(problemIdRef.current, filename);
  }

  async function executeFromButton() {
    if (!isReady || isRunning) return;
    setTerminalVisible(true);
    const source = editorRef.current?.getValue() ?? editorValue;
    const filename = currentFileRef.current;
    await idbSet(problemIdRef.current, filename, source);
    terminalRef.current?.printCmdEcho(`python3 ${filename}`);
    await runPython(source);
    terminalRef.current?.printLine('');
    terminalRef.current?.focus();
  }

  const getEditorTabHtml = () => {
    if (editorTabName.endsWith('.py')) return { __html: PYTHON_LOGO_SVG + editorTabName };
    return { __html: editorTabName };
  };

  return (
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
          <div
            id="editor-container"
            className="panel-content"
            style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <MonacoEditor
              height="100%"
              language={editorLanguage}
              theme="vs-dark"
              value={editorValue}
              onChange={val => {
                const v = val ?? '';
                setEditorValue(v);
                idbSet(problemIdRef.current, currentFileRef.current, v);
              }}
              onMount={editor => {
                editorRef.current = editor;
                if (editorValue) editor.setValue(editorValue);
              }}
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
            <button
              suppressHydrationWarning
              className="btn-run"
              disabled={runBtnDisabled}
              onClick={executeFromButton}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isLoading ? 'Loading...' : isRunning ? 'Running...' : 'Run'}
            </button>
            <button
              suppressHydrationWarning
              className="btn-submit"
              disabled={runBtnDisabled}
              onClick={executeFromButton}
            >
              Submit answer
            </button>
          </div>
        </div>
      </div>

      <div
        className="split-wrapper terminal-wrapper"
        style={{ display: terminalVisible ? '' : 'none' }}
      >
        <TerminalPanel
          ref={terminalRef}
          problemId={problemId}
          isAdmin={isAdmin}
          isReady={isReady}
          isRunning={isRunning}
          runPython={runPython}
          currentFile={currentFileRef.current}
          onGetEditorValue={() => editorRef.current?.getValue() ?? editorValue}
          onOpenFile={openFileInEditor}
          onClose={() => setTerminalVisible(false)}
        />
      </div>
    </Split>
  );
}

interface IdeLayoutProps {
  problem: Problem | null;
  problemId: string;
  isAdmin: boolean;
}

interface IdeContentProps extends IdeLayoutProps {
  terminalRef: React.RefObject<TerminalHandle | null>;
}

function IdeContent({ problem, problemId, isAdmin, terminalRef }: IdeContentProps) {
  const [terminalVisible, setTerminalVisible] = useState(true);

  return (
    <Split className="main-container" direction="horizontal" sizes={[45, 55]} minSize={250} gutterSize={8}>
      <div className="split-wrapper">
        {isAdmin
          ? <AdminQuestionPanel problem={problem} problemId={problemId} />
          : <QuestionPanel problem={problem} />
        }
      </div>
      <EditorSection
        problemId={problemId}
        isAdmin={isAdmin}
        terminalRef={terminalRef}
        terminalVisible={terminalVisible}
        setTerminalVisible={setTerminalVisible}
      />
    </Split>
  );
}

export default function IdeLayout({ problem, problemId, isAdmin }: IdeLayoutProps) {
  const terminalRef = useRef<TerminalHandle>(null);

  return (
    <PythonRunnerProvider terminalRef={terminalRef}>
      <style>{`
        .split-wrapper { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
        .split-wrapper > .panel { height: calc(100% - 8px); margin: 4px; }
        .terminal-wrapper > .panel { height: calc(100% - 8px); margin: 4px; }
        .editor-content-wrapper:hover .editor-topleft-controls { opacity: 1 !important; pointer-events: auto !important; }
      `}</style>
      <IdeContent
        problem={problem}
        problemId={problemId}
        isAdmin={isAdmin}
        terminalRef={terminalRef}
      />
    </PythonRunnerProvider>
  );
}
