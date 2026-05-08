'use client';

import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { ColorPickerTarget } from './Types';
import { FONT_FAMILIES, FONT_SIZES, BLOCK_TYPES } from './Constants';
import TbDropdown from './TbDropdown';
import ColorPicker from './ColorPicker';
import LinkDialog from './LinkDialog';

interface RichTextToolbarProps {
  editor: Editor;
}

export default function RichTextToolbar({ editor }: RichTextToolbarProps) {
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
