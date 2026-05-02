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
  { label: 'Heading 1',      icon: 'H1',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',      icon: 'H2',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',      icon: 'H3',  action: (editor: any) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List',    icon: '•—',  action: (editor: any) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List',  icon: '1—',  action: (editor: any) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Code Block',     icon: '</>',  action: (editor: any) => editor.chain().focus().toggleCodeBlock().run() },
  { label: 'Blockquote',     icon: '❝',   action: (editor: any) => editor.chain().focus().toggleBlockquote().run() },
  { label: 'Text Block',     icon: 'T',   action: (editor: any) => editor.chain().focus().setParagraph().run() },
];

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

  const componentMenuRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
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
      if (componentMenuRef.current && !componentMenuRef.current.contains(e.target as Node)) {
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
      try {
        editor.commands.setContent(JSON.parse(problem.content));
      } catch {
        editor.commands.setContent(problem.content);
      }
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

  if (!isAdmin) return null;

  return (
    <>
      <Navbar email={email} />
      <div className="editor-page-container">
        {/* ── Top bar ──────────────────────────────────────────────────── */}
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

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <div className="editor-main">
          {/* Writing area — controls appear on hover, anchored to the right */}
          <div className="editor-left-panel">
            <div className="editor-content-wrapper">
              <div className="editor-content-area">
                <EditorContent editor={editor} />
              </div>

              {/* Floating controls: visible only when hovering the content wrapper */}
              <div className="editor-floating-controls" ref={componentMenuRef}>
                <button className="ctrl-btn" title="Move up"
                  onClick={() => editor?.chain().focus().liftEmptyBlock().run()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>

                <div className="ctrl-add-wrap">
                  <button
                    className="ctrl-btn ctrl-add-btn"
                    title="Insert component"
                    onClick={() => setShowComponentMenu(v => !v)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  {showComponentMenu && (
                    <div className="component-menu">
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

                <button className="ctrl-btn" title="Move down"
                  onClick={() => editor?.chain().focus().run()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Preview panel */}
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
    </>
  );
}
