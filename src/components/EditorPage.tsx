'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import Navbar from './Navbar';

interface Problem {
  id: string;
  title: string;
  content: string | null;
  class_name: string;
  number: number | null;
  is_honors: boolean;
}

const COMPONENT_OPTIONS = [
  { label: 'Heading 1',    icon: 'H1',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',    icon: 'H2',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',    icon: 'H3',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List',  icon: '•—',  action: (editor: any) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List',icon: '1—',  action: (editor: any) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Code Block',   icon: '</>',  action: (editor: any) => editor.chain().focus().toggleCodeBlock().run() },
  { label: 'Blockquote',   icon: '❝',   action: (editor: any) => editor.chain().focus().toggleBlockquote().run() },
  { label: 'Text Block',   icon: 'T',   action: (editor: any) => editor.chain().focus().setParagraph().run() },
];

function reorderBlocks(
  editor: any,
  blockPos: number,
  transform: (blocks: any[], idx: number) => any[] | null
) {
  const { state } = editor;
  const { doc } = state;
  const blocks: any[] = [];
  const positions: number[] = [];
  doc.forEach((node: any, pos: number) => { blocks.push(node); positions.push(pos); });
  const currentIdx = blocks.findIndex((_: any, i: number) =>
    blockPos >= positions[i] && blockPos < positions[i] + blocks[i].nodeSize
  );
  if (currentIdx === -1) return;
  const reordered = transform(blocks, currentIdx);
  if (!reordered) return;
  const tr = state.tr.replaceWith(0, doc.content.size, reordered);
  editor.view.dispatch(tr);
}

export default function EditorPage() {
  const router = useRouter();
  const email = useRequireAuth();
  const searchParams = useSearchParams();
  const problemId = searchParams.get('id') || '';

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const [title, setTitle] = useState('');
  const [hoveredInfo, setHoveredInfo] = useState<{ top: number; centerX: number; blockPos: number } | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onUpdate: () => {
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => autoSave(), 1500);
    },
  });

  useEffect(() => {
    if (email) init(email);
  }, [email, problemId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setShowComponentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function init(userEmail: string) {
    const { data: student } = await supabase
      .from('Students')
      .select('Admin')
      .eq('Email', userEmail)
      .maybeSingle();

    if (!student?.Admin) { router.replace('/home'); return; }
    setIsAdmin(true);

    if (!problemId) return;

    const { data: prob } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .maybeSingle();

    if (!prob) return;
    setProblem(prob);
    setTitle(prob.title || '');
  }

  useEffect(() => {
    if (editor && problem?.content) {
      try { editor.commands.setContent(JSON.parse(problem.content)); }
      catch { editor.commands.setContent(problem.content); }
    }
  }, [editor, problem]);

  async function autoSave() {
    if (!problemId || !editor) return;
    setSaving(true);
    const content = JSON.stringify(editor.getJSON());
    await supabase.from('problems').update({ content, title }).eq('id', problemId);
    setSaving(false);
    setSaved(true);
  }

  async function manualSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await autoSave();
  }

  function isEditorEmpty() {
    if (!editor) return true;
    const doc = editor.state.doc;
    return doc.childCount === 0 || (
      doc.childCount === 1 &&
      doc.firstChild?.type.name === 'paragraph' &&
      doc.firstChild?.textContent === ''
    );
  }

  function handleContentMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!editor) return;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    const contentEl = e.currentTarget as HTMLElement;
    const editorEl = contentEl.querySelector('.tiptap-editor') as HTMLElement | null;
    if (!editorEl) return;

    if (isEditorEmpty()) {
      const rect = editorEl.getBoundingClientRect();
      setHoveredInfo({ top: rect.top + 16, centerX: rect.left + rect.width / 2, blockPos: 0 });
      setControlsVisible(true);
      return;
    }

    const view = editor.view;
    const posInfo = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!posInfo) { setControlsVisible(false); return; }

    const { state } = editor;
    let blockPos = -1;
    state.doc.forEach((node: any, pos: number) => {
      if (blockPos !== -1) return;
      if (posInfo.pos >= pos && posInfo.pos < pos + node.nodeSize) {
        blockPos = pos;
      }
    });
    if (blockPos === -1) { setControlsVisible(false); return; }

    try {
      let domNode = view.domAtPos(blockPos + 1).node as Node;
      let el = (domNode.nodeType === Node.TEXT_NODE ? domNode.parentElement : domNode) as HTMLElement;
      while (el && el.parentElement && !el.parentElement.classList.contains('tiptap-editor')) {
        el = el.parentElement as HTMLElement;
      }
      if (!el?.parentElement?.classList.contains('tiptap-editor')) { setControlsVisible(false); return; }

      const rect = el.getBoundingClientRect();
      setHoveredInfo({ top: rect.bottom + 5, centerX: rect.left + rect.width / 2, blockPos });
      setControlsVisible(true);
    } catch {
      setControlsVisible(false);
    }
  }

  function handleContentMouseLeave() {
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      setShowComponentMenu(false);
    }, 600);
  }

  function handleControlsMouseEnter() {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }

  function handleControlsMouseLeave() {
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      setShowComponentMenu(false);
    }, 600);
  }

  function moveUp() {
    if (!editor || !hoveredInfo) return;
    reorderBlocks(editor, hoveredInfo.blockPos, (blocks, idx) => {
      if (idx === 0) return null;
      const arr = [...blocks];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveDown() {
    if (!editor || !hoveredInfo) return;
    reorderBlocks(editor, hoveredInfo.blockPos, (blocks, idx) => {
      if (idx === blocks.length - 1) return null;
      const arr = [...blocks];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  if (!isAdmin) return null;

  return (
    <>
      <Navbar email={email} />
      <div className="editor-page-container">
        <div className="editor-topbar">
          <div className="editor-topbar-left">
            <button className="editor-back-btn" onClick={() => router.push('/home')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>
            <input
              className="editor-title-input"
              value={title}
              onChange={e => { setTitle(e.target.value); setSaved(false); }}
              onBlur={manualSave}
              placeholder="Problem title..."
            />
          </div>
          <div className="editor-topbar-right">
            <span className={`editor-save-status ${saving ? 'saving' : saved ? 'saved' : ''}`}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Unsaved'}
            </span>
            <button className="editor-save-btn" onClick={manualSave}>Save</button>
          </div>
        </div>

        <div className="editor-main">
          <div className="editor-left-panel">
            <div className="editor-content-wrapper">
              <div
                className="editor-content-area"
                onMouseMove={handleContentMouseMove}
                onMouseLeave={handleContentMouseLeave}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <div className="editor-right-panel">
            <div className="editor-right-header">Preview</div>
            <div className="editor-preview-content tiptap-preview">
              <div dangerouslySetInnerHTML={{
                __html: editor?.getHTML() || '<p style="color:#555">Nothing to preview yet.</p>'
              }} />
            </div>
          </div>
        </div>
      </div>

      {controlsVisible && hoveredInfo && (
        <div
          ref={controlsRef}
          onMouseEnter={handleControlsMouseEnter}
          onMouseLeave={handleControlsMouseLeave}
          style={{
            position: 'fixed',
            top: hoveredInfo.top,
            left: hoveredInfo.centerX,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 200,
            pointerEvents: 'auto',
            padding: '6px',
          }}
        >
          <button className="ctrl-btn" title="Move up" onClick={moveUp}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="ctrl-btn ctrl-add-btn"
              title="Insert component"
              onClick={() => setShowComponentMenu(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {showComponentMenu && (
              <div
                className="component-menu"
                style={{
                  bottom: 'calc(100% + 8px)',
                  top: 'auto',
                  left: '50%',
                  right: 'auto',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="component-menu-header">Insert Component</div>
                {COMPONENT_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    className="component-menu-item"
                    onClick={() => { opt.action(editor); setShowComponentMenu(false); }}
                  >
                    <span className="component-menu-icon">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="ctrl-btn" title="Move down" onClick={moveDown}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
