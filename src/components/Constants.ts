import type { Editor } from '@tiptap/react';

export const BUFFER = 20;

export const COMPONENT_OPTIONS = [
  {
    label: 'Heading 1', icon: 'H1',
    action: (editor: Editor, blockPos: number) => {
      editor.chain().focus().insertContentAt(blockPos, {
        type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '' }],
      }).run();
    },
  },
  {
    label: 'Heading 2', icon: 'H2',
    action: (editor: Editor, blockPos: number) => {
      editor.chain().focus().insertContentAt(blockPos, {
        type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '' }],
      }).run();
    },
  },
  {
    label: 'Heading 3', icon: 'H3',
    action: (editor: Editor, blockPos: number) => {
      editor.chain().focus().insertContentAt(blockPos, {
        type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '' }],
      }).run();
    },
  },
  {
    label: 'Paragraph', icon: '¶',
    action: (editor: Editor, blockPos: number) => {
      editor.chain().focus().insertContentAt(blockPos, {
        type: 'paragraph', content: [],
      }).run();
    },
  },
  {
    label: 'Bullet List', icon: '•—',
    action: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered List', icon: '1—',
    action: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Task List', icon: '☑',
    action: (editor: Editor) => (editor.chain().focus() as any).toggleTaskList().run(),
  },
  {
    label: 'Code Block', icon: '</>',
    action: (editor: Editor) => {
      const { state } = editor;
      const { from, to } = state.selection;
      if (from !== to) {
        const selectedText = state.doc.textBetween(from, to, '\n');
        (editor.chain().focus() as any)
          .deleteSelection()
          .insertContent({ type: 'codeBlock', content: [{ type: 'text', text: selectedText }] })
          .run();
      } else {
        editor.chain().focus().toggleCodeBlock().run();
      }
    },
  },
  {
    label: 'Blockquote', icon: '❝',
    action: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  { label: 'Table', icon: '⊞', action: null },
  { label: 'Image', icon: '🖼', action: null },
];

export const FONT_FAMILIES = [
  { label: 'Default',   value: '' },
  { label: 'Inter',     value: 'Inter, sans-serif' },
  { label: 'Fira Code', value: '"Fira Code", monospace' },
  { label: 'Georgia',   value: 'Georgia, serif' },
  { label: 'Arial',     value: 'Arial, sans-serif' },
  { label: 'Times',     value: '"Times New Roman", serif' },
];

export const FONT_SIZES = [
  { label: 'Tiny',   value: '11px' },
  { label: 'Small',  value: '13px' },
  { label: 'Medium', value: '15px' },
  { label: 'Large',  value: '18px' },
  { label: 'XL',     value: '24px' },
  { label: 'XXL',    value: '32px' },
  { label: 'Huge',   value: '48px' },
];

export const PRESET_COLORS = [
  '#ffffff', '#cccccc', '#888888', '#444444', '#000000',
  '#ff7b72', '#f59e0b', '#fbbf24', '#34d399', '#2ecc71',
  '#60a5fa', '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
];

export const BLOCK_TYPES = [
  {
    label: 'Paragraph', symbol: '¶',
    action: (e: Editor) => e.chain().focus().setParagraph().run(),
    active: (e: Editor) => e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList'),
  },
  {
    label: 'Heading 1', symbol: 'H1',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e: Editor) => e.isActive('heading', { level: 1 }),
  },
  {
    label: 'Heading 2', symbol: 'H2',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e: Editor) => e.isActive('heading', { level: 2 }),
  },
  {
    label: 'Heading 3', symbol: 'H3',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e: Editor) => e.isActive('heading', { level: 3 }),
  },
  {
    label: 'Bullet', symbol: '•—',
    action: (e: Editor) => e.chain().focus().toggleBulletList().run(),
    active: (e: Editor) => e.isActive('bulletList'),
  },
  {
    label: 'Numbered', symbol: '1—',
    action: (e: Editor) => e.chain().focus().toggleOrderedList().run(),
    active: (e: Editor) => e.isActive('orderedList'),
  },
  {
    label: 'Task', symbol: '☑',
    action: (e: Editor) => (e.chain().focus() as any).toggleTaskList().run(),
    active: (e: Editor) => e.isActive('taskList'),
  },
  {
    label: 'Code', symbol: '</>',
    action: (e: Editor) => e.chain().focus().toggleCodeBlock().run(),
    active: (e: Editor) => e.isActive('codeBlock'),
  },
  {
    label: 'Quote', symbol: '❝',
    action: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
    active: (e: Editor) => e.isActive('blockquote'),
  },
];
