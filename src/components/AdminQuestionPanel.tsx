'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '@/lib/supabase';

interface Problem {
  id: string;
  title: string;
  content: string | null;
}

interface AdminQuestionPanelProps {
  problem: Problem | null;
  problemId: string;
}

const COMPONENT_OPTIONS = [
  { label: 'Heading 1',     icon: 'H1',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',     icon: 'H2',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',     icon: 'H3',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List',   icon: '•—',  action: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List', icon: '1—',  action: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Code Block',    icon: '</>',  action: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Blockquote',    icon: '❝',   action: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Text Block',    icon: 'T',   action: (e: Editor) => e.chain().focus().setParagraph().run() },
];

function reorderBlocks(editor: Editor, transform: (blocks: any[], idx: number) => any[] | null) {
  const { state } = editor;
  const { doc, selection } = state;
  const { $from } = selection;

  const blocks: any[] = [];
  const positions: number[] = [];
  doc.forEach((node, pos) => {
    blocks.push(node);
    positions.push(pos);
  });

  const currentIdx = blocks.findIndex((_, i) =>
    $from.pos >= positions[i] && $from.pos < positions[i] + blocks[i].nodeSize
  );
  if (currentIdx === -1) return;

  const reordered = transform(blocks, currentIdx);
  if (!reordered) return;

  const tr = state.tr.replaceWith(0, doc.content.size, reordered);
  editor.view.dispatch(tr);
}

export default function AdminQuestionPanel({ problem, problemId }: AdminQuestionPanelProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onUpdate: () => {
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(autoSave, 1500);
    },
  });

  useEffect(() => {
    if (editor && problem?.content) {
      try {
        editor.commands.setContent(JSON.parse(problem.content));
      } catch {
        editor.commands.setContent(problem.content);
      }
    }
  }, [editor, problem?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowComponentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function autoSave() {
    if (!problemId || !editor) return;
    setSaving(true);
    const content = JSON.stringify(editor.getJSON());
    const title = problem?.title || '';
    await supabase.from('problems').update({ content, title }).eq('id', problemId);
    setSaving(false);
    setSaved(true);
  }

  function moveUp() {
    if (!editor) return;
    reorderBlocks(editor, (blocks, idx) => {
      if (idx === 0) return null;
      const arr = [...blocks];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveDown() {
    if (!editor) return;
    reorderBlocks(editor, (blocks, idx) => {
      if (idx === blocks.length - 1) return null;
      const arr = [...blocks];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  function moveTop() {
    if (!editor) return;
    reorderBlocks(editor, (blocks, idx) => {
      if (idx === 0) return null;
      const arr = [...blocks];
      const [item] = arr.splice(idx, 1);
      arr.unshift(item);
      return arr;
    });
  }

  function moveBottom() {
    if (!editor) return;
    reorderBlocks(editor, (blocks, idx) => {
      if (idx === blocks.length - 1) return null;
      const arr = [...blocks];
      const [item] = arr.splice(idx, 1);
      arr.push(item);
      return arr;
    });
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="panel-header flex-header">
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600,
          color: 'var(--text-heading)', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {problem?.title || 'Problem'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '12px', flexShrink: 0,
          color: saving ? '#f59e0b' : saved ? 'var(--accent-green)' : '#555',
          transition: 'color 0.2s',
        }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : ''}
        </span>
      </div>

      <div
        className="editor-content-wrapper"
        style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}
      >
        <div
          className="editor-content-area"
          style={{ flex: 1, overflowY: 'auto', padding: '20px 56px 32px 20px' }}
        >
          <EditorContent editor={editor} />
        </div>

        <div
          className="editor-floating-controls"
          ref={menuRef}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.15s',
            zIndex: 10,
          }}
        >
          <button className="ctrl-btn" title="Move to top" onClick={moveTop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <polyline points="18 8 12 2 6 8" /><polyline points="18 14 12 8 6 14" />
            </svg>
          </button>
          <button className="ctrl-btn" title="Move up" onClick={moveUp}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className="ctrl-btn ctrl-add-btn" title="Insert component" onClick={() => setShowComponentMenu(v => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {showComponentMenu && (
              <div className="component-menu" style={{ right: '100%', left: 'auto', top: 0, marginRight: 8 }}>
                <div className="component-menu-header">Insert Component</div>
                {COMPONENT_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    className="component-menu-item"
                    onClick={() => { if (editor) opt.action(editor); setShowComponentMenu(false); }}
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
          <button className="ctrl-btn" title="Move to bottom" onClick={moveBottom}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <polyline points="6 10 12 16 18 10" /><polyline points="6 16 12 22 18 16" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .editor-content-wrapper:hover .editor-floating-controls {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}