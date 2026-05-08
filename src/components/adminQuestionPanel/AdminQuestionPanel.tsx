'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Link from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { supabase } from '@/lib/supabase';

import type { AdminQuestionPanelProps, TableData } from './Types';
import { BUFFER, COMPONENT_OPTIONS } from './Constants';
import { getBlockDomElement, reorderBlocks, makeTableData } from './Helpers';
import { FontSize, ResizableImage } from './Extensions';
import RichTextToolbar from './RichTextToolbar';
import ImageUploadModal from './ImageUploadModal';
import TableSizeModal from './TableSizeModal';
import ResizableTable from './ResizableTable';

export default function AdminQuestionPanel({ problem, problemId }: AdminQuestionPanelProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [hoveredInfo, setHoveredInfo] = useState<{ top: number; centerX: number; blockPos: number } | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [controlsFadedIn, setControlsFadedIn] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tables, setTables] = useState<TableData[]>([]);
  const [tableInsertPos, setTableInsertPos] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const fadeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredBlockPosRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage,
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    onUpdate: () => {
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(autoSave, 1500);
    },
    onSelectionUpdate: ({ editor: e }) => updateToolbar(e),
  });

  function updateToolbar(e: Editor) {
    const { selection } = e.state;
    const { from, to } = selection;

    if (from === to) { setToolbarVisible(false); return; }
    if ((selection as any).node) { setToolbarVisible(false); return; }

    const view = e.view;
    const startCoords = view.coordsAtPos(from);
    const endCoords   = view.coordsAtPos(to);

    const tbW = toolbarRef.current?.offsetWidth  || 480;
    const tbH = toolbarRef.current?.offsetHeight || 36;

    const midX = (startCoords.left + endCoords.left) / 2;
    const clampedLeft = Math.min(window.innerWidth - tbW / 2 - 8, Math.max(tbW / 2 + 8, midX));

    const rawTop = startCoords.top - tbH - 6;
    const clampedTop = Math.max(8, rawTop);

    setToolbarPos({ top: clampedTop, left: clampedLeft });
    setToolbarVisible(true);
  }

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) return;
      if (editor) setTimeout(() => updateToolbar(editor), 10);
    }
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setToolbarVisible(false);
    }
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    return () => { document.removeEventListener('mouseup', onMouseUp); document.removeEventListener('mousedown', onMouseDown); };
  }, [editor]);

  useEffect(() => {
    if (editor && problem?.content) {
      try {
        const parsed = JSON.parse(problem.content);
        if (parsed.tables) {
          setTables(parsed.tables);
          editor.commands.setContent(parsed.doc || '');
        } else {
          editor.commands.setContent(parsed);
        }
      } catch {
        editor.commands.setContent(problem.content);
      }
    }
  }, [editor, problem?.id]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setShowComponentMenu(false);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function autoSave() {
    if (!problemId || !editor) return;
    setSaving(true);
    const content = JSON.stringify({ doc: editor.getJSON(), tables });
    const title = problem?.title || '';
    await supabase.from('problems').update({ content, title }).eq('id', problemId);
    setSaving(false);
    setSaved(true);
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

  function revealControls(info: { top: number; centerX: number; blockPos: number }) {
    if (fadeInTimerRef.current) clearTimeout(fadeInTimerRef.current);
    setHoveredInfo(info);
    if (!controlsVisible) {
      setControlsVisible(true);
      setControlsFadedIn(false);
      fadeInTimerRef.current = setTimeout(() => setControlsFadedIn(true), 16);
    } else {
      setControlsFadedIn(true);
    }
  }

  function concealControls() {
    setControlsFadedIn(false);
    setTimeout(() => {
      setControlsVisible(false);
      setShowComponentMenu(false);
    }, 150);
  }

  function handleContentMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!editor) return;

    const contentEl = e.currentTarget as HTMLElement;
    const editorEl = contentEl.querySelector('.tiptap-editor') as HTMLElement | null;
    if (!editorEl) return;

    if (isEditorEmpty()) {
      const rect = editorEl.getBoundingClientRect();
      revealControls({ top: rect.top + 16, centerX: rect.left + rect.width / 2, blockPos: 0 });
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const clientX = e.clientX;
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      if (!editor) return;
      const view = editor.view;

      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (!target) { concealControls(); return; }

      const imageWrapper = target.closest('[data-image-wrapper="true"]') as HTMLElement | null;
      if (imageWrapper) {
        const rect = imageWrapper.getBoundingClientRect();
        const posInfo = view.posAtCoords({ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 });
        if (!posInfo) { concealControls(); return; }
        const { state } = editor;
        let blockPos = -1;
        state.doc.forEach((node: any, pos: number) => {
          if (blockPos !== -1) return;
          if (posInfo.pos >= pos && posInfo.pos < pos + node.nodeSize) blockPos = pos;
        });
        if (blockPos === -1) { concealControls(); return; }
        revealControls({ top: rect.bottom + 5, centerX: rect.left + rect.width / 2, blockPos });
        lastHoveredBlockPosRef.current = blockPos;
        return;
      }

      const posInfo = view.posAtCoords({ left: clientX, top: clientY });
      if (!posInfo) { concealControls(); return; }

      const { state } = editor;
      let blockPos = -1;
      state.doc.forEach((node: any, pos: number) => {
        if (blockPos !== -1) return;
        if (posInfo.pos >= pos && posInfo.pos < pos + node.nodeSize) blockPos = pos;
      });
      if (blockPos === -1) { concealControls(); return; }

      try {
        const el = getBlockDomElement(editor, blockPos);
        if (!el) { concealControls(); return; }
        if (lastHoveredBlockPosRef.current === blockPos) {
          const rect = el.getBoundingClientRect();
          revealControls({ top: rect.bottom + 5, centerX: rect.left + rect.width / 2, blockPos });
          return;
        }
        lastHoveredBlockPosRef.current = blockPos;
        const rect = el.getBoundingClientRect();
        revealControls({ top: rect.bottom + 5, centerX: rect.left + rect.width / 2, blockPos });
      } catch {
        concealControls();
      }
    });
  }

  function handleContentMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    if (controlsRef.current) {
      const ctrl = controlsRef.current.getBoundingClientRect();
      const { clientX, clientY } = e;
      if (
        clientX >= ctrl.left - BUFFER &&
        clientX <= ctrl.right + BUFFER &&
        clientY >= ctrl.top - BUFFER &&
        clientY <= ctrl.bottom + BUFFER
      ) return;
    }
    lastHoveredBlockPosRef.current = -1;
    concealControls();
  }

  function handleControlsMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const ctrl = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX >= ctrl.left - BUFFER &&
      clientX <= ctrl.right + BUFFER &&
      clientY >= ctrl.top - BUFFER &&
      clientY <= ctrl.bottom + BUFFER
    ) return;
    concealControls();
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

  function moveTop() {
    if (!editor || !hoveredInfo) return;
    reorderBlocks(editor, hoveredInfo.blockPos, (blocks, idx) => {
      if (idx === 0) return null;
      const arr = [...blocks];
      const [item] = arr.splice(idx, 1);
      arr.unshift(item);
      return arr;
    });
  }

  function moveBottom() {
    if (!editor || !hoveredInfo) return;
    reorderBlocks(editor, hoveredInfo.blockPos, (blocks, idx) => {
      if (idx === blocks.length - 1) return null;
      const arr = [...blocks];
      const [item] = arr.splice(idx, 1);
      arr.push(item);
      return arr;
    });
  }

  function handleInsertImage(src: string) {
    if (!editor) return;
    (editor.chain().focus() as any).setImage({ src }).run();
    setShowImageModal(false);
  }

  function handleInsertTable(rows: number, cols: number) {
    const containerWidth = contentAreaRef.current?.offsetWidth ?? 600;
    const newTable = makeTableData(rows, cols, containerWidth - 48);
    setTables(prev => [...prev, newTable]);
    setShowTableModal(false);
    setTableInsertPos(null);
    setTimeout(() => {
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(autoSave, 1500);
    }, 0);
  }

  function updateTable(updated: TableData) {
    setTables(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 1500);
  }

  const controlsTop = hoveredInfo ? hoveredInfo.top - BUFFER : 0;

  function getMenuTop() {
    const menuHeight = COMPONENT_OPTIONS.length * 38 + 38;
    const rawMenuTop = controlsTop - menuHeight - 8;
    const navbarHeight = 56;
    const clampedMenuTop = Math.max(navbarHeight + 8, rawMenuTop);
    return clampedMenuTop - controlsTop;
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="panel-header flex-header" style={{ position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600,
          color: 'var(--text-heading)', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {problem?.title || 'Problem'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '12px', flexShrink: 0,
          color: saving ? '#f59e0b' : saved ? 'var(--accent-green)' : '#555', transition: 'color 0.2s',
        }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : ''}
        </span>
      </div>

      <div className="editor-content-wrapper" ref={wrapperRef}
        style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>

        {editor && toolbarVisible && (
          <div ref={toolbarRef} style={{
            position: 'fixed',
            top: toolbarPos.top,
            left: toolbarPos.left,
            transform: 'translateX(-50%)',
            zIndex: 400,
            pointerEvents: 'auto',
          }}>
            <RichTextToolbar editor={editor} />
          </div>
        )}

        <div
          ref={contentAreaRef}
          className="editor-content-area"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 20px 32px 24px' }}
          onMouseMove={handleContentMouseMove}
          onMouseLeave={handleContentMouseLeave}
        >
          <EditorContent editor={editor} />
          {tables.map(t => (
            <ResizableTable
              key={t.id}
              tableData={t}
              onChange={updateTable}
              containerRef={contentAreaRef}
            />
          ))}
        </div>
      </div>

      {controlsVisible && hoveredInfo && (
        <div
          ref={controlsRef}
          onMouseLeave={handleControlsMouseLeave}
          style={{
            position: 'fixed',
            top: controlsTop,
            left: hoveredInfo.centerX,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 200,
            pointerEvents: 'auto',
            padding: `${BUFFER}px`,
            opacity: controlsFadedIn ? 1 : 0,
            transition: 'opacity 0.15s ease, top 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
              <div
                className="component-menu"
                style={{
                  top: getMenuTop(),
                  bottom: 'auto',
                  left: '50%',
                  right: 'auto',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="component-menu-header">Insert Component</div>
                {COMPONENT_OPTIONS.map(opt => (
                  <button key={opt.label} className="component-menu-item"
                    onClick={() => {
                      if (opt.label === 'Image') {
                        setShowImageModal(true);
                        setShowComponentMenu(false);
                      } else if (opt.label === 'Table') {
                        setTableInsertPos(hoveredInfo?.blockPos ?? null);
                        setShowTableModal(true);
                        setShowComponentMenu(false);
                      } else if (opt.action) {
                        if (editor) {
                          const blockPos = hoveredInfo?.blockPos ?? 0;
                          if (opt.label === 'Heading 1' || opt.label === 'Heading 2' || opt.label === 'Heading 3' || opt.label === 'Paragraph') {
                            (opt.action as (e: Editor, pos: number) => void)(editor, blockPos);
                          } else {
                            (opt.action as (e: Editor) => void)(editor);
                          }
                        }
                        setShowComponentMenu(false);
                      }
                    }}>
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
      )}

      {showImageModal && (
        <ImageUploadModal
          onClose={() => setShowImageModal(false)}
          onInsert={handleInsertImage}
        />
      )}

      {showTableModal && (
        <TableSizeModal
          onClose={() => setShowTableModal(false)}
          onConfirm={handleInsertTable}
        />
      )}

      <style>{`
        .tiptap-editor { word-wrap: break-word; overflow-wrap: break-word; width: 100%; max-width: 100%; }
        .tiptap-editor p { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; width: 100%; margin: 0; }
        .tiptap-editor ul { list-style-type: disc; }
        .tiptap-editor ol { list-style-type: decimal; }
        .tiptap-editor a { color: #60a5fa; text-decoration: underline; cursor: pointer; }
        .tiptap-editor a:hover { color: #93c5fd; }
        .tiptap-editor ul[data-type="taskList"] { list-style: none; padding-left: 4px; margin: 0; }
        .tiptap-editor ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .tiptap-editor ul[data-type="taskList"] li > label { display: flex; align-items: center; flex-shrink: 0; line-height: 1.6; margin-top: 0; }
        .tiptap-editor ul[data-type="taskList"] li > div { flex: 1; min-width: 0; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
        .tiptap-editor ul[data-type="taskList"] input[type="checkbox"] { accent-color: var(--accent-green); width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; margin: 0; }
        .ctrl-add-btn { background: rgba(46,204,113,0.85) !important; color: #fff !important; border-color: rgba(46,204,113,0.9) !important; }
        .ctrl-add-btn:hover { background: rgba(46,204,113,1) !important; }
        .ctrl-add-btn svg { stroke: #fff !important; }
      `}</style>
    </div>
  );
}
