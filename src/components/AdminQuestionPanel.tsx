'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Link from '@tiptap/extension-link';
import { Extension } from '@tiptap/core';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image as TiptapImage } from '@tiptap/extension-image';
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

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: { chain: () => any }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: { chain: () => any }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

function ImageResizeWrapper({ node, updateAttributes, selected, editor: editorInstance }: any) {
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const width = node.attrs.width ? parseInt(node.attrs.width) : null;
  const height = node.attrs.height ? parseInt(node.attrs.height) : null;
  const align = node.attrs.align || 'left';
  const showHandles = selected || hovered;
  const justifyMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };

  function onHandleMouseDown(e: React.MouseEvent, handle: string) {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startW = img.offsetWidth;
    const startH = img.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    setResizing(handle);

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const MIN = 40;

      if (handle === 'tc') {
        const newH = Math.max(MIN, startH - dy);
        updateAttributes({ height: String(Math.round(newH)) });
      } else if (handle === 'bc') {
        const newH = Math.max(MIN, startH + dy);
        updateAttributes({ height: String(Math.round(newH)) });
      } else if (handle === 'ml') {
        const newW = Math.max(MIN, startW - dx);
        updateAttributes({ width: String(Math.round(newW)) });
      } else if (handle === 'mr') {
        const newW = Math.max(MIN, startW + dx);
        updateAttributes({ width: String(Math.round(newW)) });
      } else {
        let newW = startW;
        let newH = startH;
        const aspect = startW / (startH || 1);
        switch (handle) {
          case 'br': newW = Math.max(MIN, startW + dx); newH = Math.round(newW / aspect); break;
          case 'bl': newW = Math.max(MIN, startW - dx); newH = Math.round(newW / aspect); break;
          case 'tr': newW = Math.max(MIN, startW + dx); newH = Math.round(newW / aspect); break;
          case 'tl': newW = Math.max(MIN, startW - dx); newH = Math.round(newW / aspect); break;
        }
        updateAttributes({ width: String(Math.round(newW)), height: String(Math.round(newH)) });
      }
    }

    function onUp() {
      setResizing(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onImgMouseDown(e: React.MouseEvent) {
    const startX = e.clientX;
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 12) {
        const parentW = wrapRef.current?.offsetWidth || 600;
        const ratio = dx / parentW;
        if (ratio > 0.15) updateAttributes({ align: 'right' });
        else if (ratio < -0.15) updateAttributes({ align: 'left' });
        else updateAttributes({ align: 'center' });
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const HANDLES = [
    { id: 'tl', pos: { top: -5, left: -5 } as React.CSSProperties, cursor: 'nwse-resize' },
    { id: 'tc', pos: { top: -5, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties, cursor: 'n-resize' },
    { id: 'tr', pos: { top: -5, right: -5 } as React.CSSProperties, cursor: 'nesw-resize' },
    { id: 'ml', pos: { top: '50%', left: -5, transform: 'translateY(-50%)' } as React.CSSProperties, cursor: 'w-resize' },
    { id: 'mr', pos: { top: '50%', right: -5, transform: 'translateY(-50%)' } as React.CSSProperties, cursor: 'e-resize' },
    { id: 'bl', pos: { bottom: -5, left: -5 } as React.CSSProperties, cursor: 'nesw-resize' },
    { id: 'bc', pos: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } as React.CSSProperties, cursor: 's-resize' },
    { id: 'br', pos: { bottom: -5, right: -5 } as React.CSSProperties, cursor: 'nwse-resize' },
  ];

  return (
    <NodeViewWrapper>
      <div
        ref={wrapRef}
        contentEditable={false}
        data-image-wrapper="true"
        style={{ display: 'flex', justifyContent: justifyMap[align] || 'flex-start', margin: '8px 0', userSelect: 'none' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { if (!resizing) setHovered(false); }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            ref={imgRef}
            src={node.attrs.src}
            alt={node.attrs.alt || ''}
            style={{
              width: width ? `${width}px` : 'auto',
              height: height ? `${height}px` : 'auto',
              maxWidth: '100%',
              borderRadius: 8,
              display: 'block',
              cursor: 'grab',
              outline: showHandles ? '2px solid #1a73e8' : 'none',
              outlineOffset: 1,
              userSelect: 'none',
              objectFit: 'fill',
            }}
            onMouseDown={onImgMouseDown}
            draggable={false}
          />
          {showHandles && HANDLES.map(h => (
            <div
              key={h.id}
              onMouseDown={e => onHandleMouseDown(e, h.id)}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                background: 'white',
                border: '2px solid #1a73e8',
                borderRadius: 1,
                zIndex: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                cursor: h.cursor,
                ...h.pos,
              }}
            />
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.getAttribute('width'), renderHTML: attrs => attrs.width ? { width: attrs.width } : {} },
      height: { default: null, parseHTML: el => el.getAttribute('height'), renderHTML: attrs => attrs.height ? { height: attrs.height } : {} },
      align: { default: 'left', parseHTML: el => el.getAttribute('data-align') || 'left', renderHTML: attrs => ({ 'data-align': attrs.align }) },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeWrapper);
  },
});

const COMPONENT_OPTIONS = [
  { label: 'Heading 1',     icon: 'H1',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',     icon: 'H2',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',     icon: 'H3',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Paragraph',     icon: '¶',   action: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: 'Bullet List',   icon: '•—',  action: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List', icon: '1—',  action: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Task List',     icon: '☑',   action: (e: Editor) => (e.chain().focus() as any).toggleTaskList().run() },
  { label: 'Code Block',    icon: '</>',  action: (e: Editor) => {
    const { state } = e;
    const { from, to } = state.selection;
    if (from !== to) {
      const selectedText = state.doc.textBetween(from, to, '\n');
      (e.chain().focus() as any)
        .deleteSelection()
        .insertContent({ type: 'codeBlock', content: [{ type: 'text', text: selectedText }] })
        .run();
    } else {
      e.chain().focus().toggleCodeBlock().run();
    }
  }},
  { label: 'Blockquote',    icon: '❝',   action: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Table',         icon: '⊞',   action: (e: Editor) => (e.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: 'Image',         icon: '🖼',   action: (_e: Editor, openImageModal?: () => void) => {
    if (openImageModal) openImageModal();
  }},
];

const FONT_FAMILIES = [
  { label: 'Default',   value: '' },
  { label: 'Inter',     value: 'Inter, sans-serif' },
  { label: 'Fira Code', value: '"Fira Code", monospace' },
  { label: 'Georgia',   value: 'Georgia, serif' },
  { label: 'Arial',     value: 'Arial, sans-serif' },
  { label: 'Times',     value: '"Times New Roman", serif' },
];

const FONT_SIZES = [
  { label: 'Tiny',   value: '11px' },
  { label: 'Small',  value: '13px' },
  { label: 'Medium', value: '15px' },
  { label: 'Large',  value: '18px' },
  { label: 'XL',     value: '24px' },
  { label: 'XXL',    value: '32px' },
  { label: 'Huge',   value: '48px' },
];

const PRESET_COLORS = [
  '#ffffff','#cccccc','#888888','#444444','#000000',
  '#ff7b72','#f59e0b','#fbbf24','#34d399','#2ecc71',
  '#60a5fa','#818cf8','#a78bfa','#f472b6','#fb7185',
];

const BLOCK_TYPES = [
  { label: 'Paragraph', symbol: '¶',   action: (e: Editor) => e.chain().focus().setParagraph().run(),                   active: (e: Editor) => e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') },
  { label: 'Heading 1', symbol: 'H1',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),       active: (e: Editor) => e.isActive('heading', { level: 1 }) },
  { label: 'Heading 2', symbol: 'H2',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),       active: (e: Editor) => e.isActive('heading', { level: 2 }) },
  { label: 'Heading 3', symbol: 'H3',  action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(),       active: (e: Editor) => e.isActive('heading', { level: 3 }) },
  { label: 'Bullet',    symbol: '•—',  action: (e: Editor) => e.chain().focus().toggleBulletList().run(),                active: (e: Editor) => e.isActive('bulletList') },
  { label: 'Numbered',  symbol: '1—',  action: (e: Editor) => e.chain().focus().toggleOrderedList().run(),               active: (e: Editor) => e.isActive('orderedList') },
  { label: 'Task',      symbol: '☑',   action: (e: Editor) => (e.chain().focus() as any).toggleTaskList().run(),         active: (e: Editor) => e.isActive('taskList') },
  { label: 'Code',      symbol: '</>',  action: (e: Editor) => e.chain().focus().toggleCodeBlock().run(),                active: (e: Editor) => e.isActive('codeBlock') },
  { label: 'Quote',     symbol: '❝',   action: (e: Editor) => e.chain().focus().toggleBlockquote().run(),                active: (e: Editor) => e.isActive('blockquote') },
];

function reorderBlocks(
  editor: Editor,
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

function TbDropdown({ label, items, onSelect }: {
  label: React.ReactNode;
  items: { label: string; value?: string; action?: () => void }[];
  onSelect: (item: { label: string; value?: string; action?: () => void }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onMouseDown={e => { e.preventDefault(); setOpen(v => !v); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '1px solid transparent',
          color: '#bbb', borderRadius: 6, padding: '3px 5px',
          cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.1s',
        }}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.45, flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)', zIndex: 999,
          minWidth: 110, overflow: 'hidden',
        }}>
          {items.map(item => (
            <button
              key={item.label}
              onMouseDown={e => { e.preventDefault(); onSelect(item); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                color: '#bbb', padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', display: 'block', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.09)'; (e.currentTarget as HTMLElement).style.color = '#2ecc71'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#bbb'; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ColorPickerTarget = 'text' | 'highlight';

function ColorPicker({ color, onChange, onClose }: {
  color: string; onChange: (c: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
      padding: 14, zIndex: 1000, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', minWidth: 240,
    }}>
      <HexColorPicker color={safe} onChange={onChange} style={{ width: '100%', height: 160 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onMouseDown={e => { e.preventDefault(); onChange(c); }} style={{
            width: 20, height: 20, borderRadius: 4, background: c,
            border: color === c ? '2px solid #2ecc71' : '1px solid #555',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>#</span>
        <HexColorInput color={safe} onChange={onChange} prefixed={false} style={{
          flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6,
          color: '#fff', fontFamily: 'monospace', fontSize: 13, padding: '4px 8px', outline: 'none',
        }} />
        <div style={{ width: 22, height: 22, borderRadius: 4, background: safe, border: '1px solid #444', flexShrink: 0 }} />
      </div>
    </div>
  );
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = editor.getAttributes('link').href as string | undefined;
  const [url, setUrl] = useState(existing || 'https://');
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  function apply() {
    const t = url.trim();
    if (!t || t === 'https://') (editor.chain().focus() as any).unsetLink().run();
    else (editor.chain().focus() as any).setLink({ href: t, target: '_blank' }).run();
    onClose();
  }
  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
      padding: '12px 14px', zIndex: 1000, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      minWidth: 280, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>URL</span>
      <input ref={inputRef} value={url} onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
        style={{ background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontFamily: 'monospace', fontSize: 13, padding: '6px 10px', outline: 'none' }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={apply} style={{ flex: 1, background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.35)', color: '#2ecc71', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Apply</button>
        {existing && <button onClick={() => { (editor.chain().focus() as any).unsetLink().run(); onClose(); }} style={{ flex: 1, background: 'rgba(255,123,114,0.1)', border: '1px solid rgba(255,123,114,0.25)', color: '#ff7b72', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Remove</button>}
      </div>
    </div>
  );
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  const [colorTarget, setColorTarget] = useState<ColorPickerTarget | null>(null);
  const [showLink, setShowLink] = useState(false);

  const textColor = (editor.getAttributes('textStyle').color as string | undefined) || '#ffffff';
  const hlColor   = (editor.getAttributes('highlight').color as string | undefined) || '#fbbf24';
  const fontVal   = (editor.getAttributes('textStyle').fontFamily as string | undefined) || '';
  const sizeVal   = (editor.getAttributes('textStyle').fontSize as string | undefined) || '15px';

  const fontLabel  = FONT_FAMILIES.find(f => f.value === fontVal)?.label || 'Default';
  const sizeLabel  = FONT_SIZES.find(s => s.value === sizeVal)?.label   || 'Medium';
  const blockLabel = BLOCK_TYPES.find(b => b.active(editor))?.symbol    || '¶';

  const setColor = useCallback((c: string) => editor.chain().focus().setColor(c).run(), [editor]);
  const setHl    = useCallback((c: string) => (editor.chain().focus() as any).setHighlight({ color: c }).run(), [editor]);

  const btn = (active?: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(46,204,113,0.13)' : 'transparent',
    border: '1px solid transparent',
    color: active ? '#2ecc71' : '#bbb',
    borderRadius: 5, padding: '3px 7px',
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
    flexShrink: 0, transition: 'color 0.1s, background 0.1s', whiteSpace: 'nowrap',
    lineHeight: 1,
  });

  const sep: React.CSSProperties = {
    width: 1, height: 14, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 1,
      background: '#18181a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '3px 6px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
      flexWrap: 'nowrap',
      width: 'max-content',
      userSelect: 'none',
    }}>
      <TbDropdown
        label={<span style={{ fontSize: 13, minWidth: 16, textAlign: 'center' }}>{blockLabel}</span>}
        items={BLOCK_TYPES.map(b => ({ label: b.label, action: () => b.action(editor) }))}
        onSelect={item => item.action && item.action()}
      />
      <div style={sep} />
      <TbDropdown
        label={<span style={{ fontSize: 13 }}>{fontLabel}</span>}
        items={FONT_FAMILIES.map(f => ({ label: f.label, value: f.value }))}
        onSelect={item => {
          if (item.value) editor.chain().focus().setFontFamily(item.value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      />
      <div style={sep} />
      <TbDropdown
        label={<span style={{ fontSize: 13 }}>{sizeLabel}</span>}
        items={FONT_SIZES.map(s => ({ label: s.label, value: s.value }))}
        onSelect={item => { if (item.value) (editor.chain().focus() as any).setFontSize(item.value).run(); }}
      />
      <div style={sep} />
      <button style={btn(editor.isActive('bold'))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} title="Bold">
        <b>B</b>
      </button>
      <button style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} title="Italic">
        <i>I</i>
      </button>
      <button style={{ ...btn(editor.isActive('underline')), textDecoration: 'underline' }}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} title="Underline">
        U
      </button>
      <button style={btn(editor.isActive('strike'))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} title="Strikethrough">
        <s>S</s>
      </button>
      <button style={btn(editor.isActive('code'))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} title="Code">
        {'<>'}
      </button>
      <div style={sep} />
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onMouseDown={e => { e.preventDefault(); setColorTarget(t => t === 'text' ? null : 'text'); setShowLink(false); }}
          style={{ ...btn(false), flexDirection: 'column', gap: 1, padding: '3px 6px' }} title="Text color">
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: '#bbb' }}>A</span>
          <span style={{ width: 13, height: 2, background: textColor, borderRadius: 1 }} />
        </button>
        {colorTarget === 'text' && <ColorPicker color={textColor} onChange={setColor} onClose={() => setColorTarget(null)} />}
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onMouseDown={e => { e.preventDefault(); setColorTarget(t => t === 'highlight' ? null : 'highlight'); setShowLink(false); }}
          style={{ ...btn(editor.isActive('highlight')), flexDirection: 'column', gap: 1, padding: '3px 6px' }} title="Highlight">
          <svg width="13" height="11" viewBox="0 0 20 16" fill="none" stroke="#bbb" strokeWidth="1.8">
            <path d="M2 13h16M6 13L3 7l7-5 7 5-3 6" />
          </svg>
          <span style={{ width: 13, height: 2, background: hlColor, borderRadius: 1 }} />
        </button>
        {colorTarget === 'highlight' && <ColorPicker color={hlColor} onChange={setHl} onClose={() => setColorTarget(null)} />}
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onMouseDown={e => { e.preventDefault(); setShowLink(v => !v); setColorTarget(null); }}
          style={btn(editor.isActive('link'))} title="Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        {showLink && <LinkDialog editor={editor} onClose={() => setShowLink(false)} />}
      </div>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetAllMarks().run(); }}
        style={btn(false)} title="Clear formatting">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14" />
          <path d="m15 3 6 6" /><path d="m3 21 9-9" />
        </svg>
      </button>
    </div>
  );
}

function ImageUploadModal({ onClose, onInsert }: { onClose: () => void; onInsert: (src: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) readFile(file);
          break;
        }
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      if (src) onInsert(src);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#1e1e20', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
        padding: 32, width: 480, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, color: '#fff', fontSize: 15 }}>Insert Image</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent-green)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 12, padding: '40px 20px', textAlign: 'center',
            background: dragging ? 'rgba(46,204,113,0.05)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ marginBottom: 12, opacity: 0.4 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <p style={{ margin: '0 0 12px', color: '#999', fontFamily: 'var(--font-ui)', fontSize: 14 }}>Drag and drop or</p>
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            style={{
              background: '#000', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontFamily: 'var(--font-ui)', fontWeight: 600,
              fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload an image
          </button>
          <p style={{ margin: '12px 0 0', color: '#555', fontFamily: 'var(--font-ui)', fontSize: 12 }}>or paste an image with Ctrl+V</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    </div>
  );
}

function TableSizeModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (rows: number, cols: number) => void }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#1e1e20', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
        padding: 28, width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 15, fontFamily: 'var(--font-ui)' }}>Set Table Size</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ color: '#aaa', fontSize: 12, fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            Rows
            <input type="number" min={1} max={20} value={rows} onChange={e => setRows(Number(e.target.value))}
              style={{ background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 14, padding: '6px 10px', outline: 'none', fontFamily: 'inherit' }} />
          </label>
          <label style={{ color: '#aaa', fontSize: 12, fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            Columns
            <input type="number" min={1} max={20} value={cols} onChange={e => setCols(Number(e.target.value))}
              style={{ background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 14, padding: '6px 10px', outline: 'none', fontFamily: 'inherit' }} />
          </label>
          <button onClick={() => onConfirm(rows, cols)}
            style={{
              background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.35)',
              color: 'var(--accent-green)', borderRadius: 8, padding: '8px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, marginTop: 4,
            }}>
            Insert Table
          </button>
        </div>
      </div>
    </div>
  );
}

const BUFFER = 20;
const MIN_COL_WIDTH = 40;

function getBlockDomElement(editor: Editor, blockPos: number): HTMLElement | null {
  const view = editor.view;
  try {
    let domNode = view.domAtPos(blockPos + 1).node as Node;
    let el = (domNode.nodeType === Node.TEXT_NODE ? domNode.parentElement : domNode) as HTMLElement;
    while (el && el.parentElement && !el.parentElement.classList.contains('tiptap-editor')) {
      el = el.parentElement as HTMLElement;
    }
    if (!el?.parentElement?.classList.contains('tiptap-editor')) return null;
    return el;
  } catch {
    return null;
  }
}

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const fadeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredBlockPosRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);

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
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImage,
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const target = event.target as HTMLElement;
          const cell = target.closest('td, th') as HTMLElement | null;
          if (!cell) return false;
          const table = cell.closest('table') as HTMLElement | null;
          if (!table) return false;

          const resizeHandle = target.closest('.column-resize-handle');
          if (!resizeHandle) return false;

          event.preventDefault();
          event.stopPropagation();

          const cells = Array.from(table.querySelectorAll('tr:first-child td, tr:first-child th')) as HTMLElement[];
          const cellIndex = cells.indexOf(cell);
          if (cellIndex === -1) return false;

          const tableWidth = table.offsetWidth;
          const startX = event.clientX;
          const startWidths = cells.map(c => c.offsetWidth);
          const totalCols = cells.length;

          function onMove(ev: MouseEvent) {
            const dx = ev.clientX - startX;
            const newWidths = [...startWidths];
            const newW = Math.max(MIN_COL_WIDTH, startWidths[cellIndex] + dx);

            const rightUsed = newWidths.slice(cellIndex + 1).reduce((s, w) => s + Math.max(MIN_COL_WIDTH, w), 0);
            const maxAllowed = tableWidth - rightUsed - (cellIndex > 0 ? newWidths.slice(0, cellIndex).reduce((s, w) => s + w, 0) : 0);
            newWidths[cellIndex] = Math.min(newW, maxAllowed);

            const usedSoFar = newWidths.slice(0, cellIndex + 1).reduce((s, w) => s + w, 0);
            const remaining = tableWidth - usedSoFar;
            const rightCols = totalCols - cellIndex - 1;
            if (rightCols > 0) {
              const evenShare = remaining / rightCols;
              for (let i = cellIndex + 1; i < totalCols; i++) {
                newWidths[i] = Math.max(MIN_COL_WIDTH, evenShare);
              }
            }

            const allRows = Array.from(table.querySelectorAll('tr'));
            allRows.forEach(row => {
              const rowCells = Array.from(row.querySelectorAll('td, th')) as HTMLElement[];
              rowCells.forEach((rc, i) => {
                if (i < newWidths.length) {
                  rc.style.width = `${newWidths[i]}px`;
                  rc.style.minWidth = `${newWidths[i]}px`;
                }
              });
            });
          }

          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
          }

          document.body.style.cursor = 'col-resize';
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
          return true;
        },
      },
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
      try { editor.commands.setContent(JSON.parse(problem.content)); }
      catch { editor.commands.setContent(problem.content); }
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
    const content = JSON.stringify(editor.getJSON());
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

      const tableEl = target.closest('table') as HTMLElement | null;
      if (tableEl) {
        const rect = tableEl.getBoundingClientRect();
        const posInfo = view.posAtCoords({ left: rect.left + 4, top: rect.top + 4 });
        if (!posInfo) { concealControls(); return; }
        const { state } = editor;
        let blockPos = -1;
        state.doc.forEach((node: any, pos: number) => {
          if (blockPos !== -1) return;
          if (posInfo.pos >= pos && posInfo.pos < pos + node.nodeSize) blockPos = pos;
        });
        if (blockPos === -1) { concealControls(); return; }
        if (lastHoveredBlockPosRef.current === blockPos) return;
        lastHoveredBlockPosRef.current = blockPos;
        revealControls({ top: rect.bottom + 5, centerX: rect.left + rect.width / 2, blockPos });
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
    if (!editor) return;
    (editor.chain().focus() as any).insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableModal(false);
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
          className="editor-content-area"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 20px 32px 24px' }}
          onMouseMove={handleContentMouseMove}
          onMouseLeave={handleContentMouseLeave}
        >
          <EditorContent editor={editor} />
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
                        setShowTableModal(true);
                        setShowComponentMenu(false);
                      } else {
                        if (editor) opt.action(editor);
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
        .tiptap-editor .tableWrapper { overflow: hidden; max-width: 100%; position: relative; }
        .tiptap-editor table { border-collapse: collapse; table-layout: fixed; width: 100%; max-width: 100%; margin: 12px 0; }
        .tiptap-editor table td, .tiptap-editor table th { border: 1px solid var(--border-color); padding: 6px 10px; min-width: ${MIN_COL_WIDTH}px; vertical-align: top; position: relative; overflow-wrap: break-word; word-break: break-word; white-space: normal; }
        .tiptap-editor table th { background: rgba(255,255,255,0.05); font-weight: 600; color: var(--text-heading); }
        .tiptap-editor table .selectedCell { background: rgba(46,204,113,0.08); }
        .tiptap-editor table .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: var(--accent-green); pointer-events: none; cursor: col-resize; }
        .tiptap-editor .resize-cursor { cursor: col-resize; }
        .ctrl-add-btn { background: rgba(46,204,113,0.85) !important; color: #fff !important; border-color: rgba(46,204,113,0.9) !important; }
        .ctrl-add-btn:hover { background: rgba(46,204,113,1) !important; }
        .ctrl-add-btn svg { stroke: #fff !important; }
      `}</style>
    </div>
  );
}
