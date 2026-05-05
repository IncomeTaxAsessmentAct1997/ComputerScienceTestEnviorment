'use client';

import { useMemo } from 'react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image as TiptapImage } from '@tiptap/extension-image';

interface Problem {
  id: string;
  title: string;
  content: string | null;
}

interface QuestionPanelProps {
  problem: Problem | null;
}

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('width'),
        renderHTML: attrs => attrs.width ? { width: attrs.width, style: `width: ${attrs.width}px; max-width: 100%;` } : { style: 'max-width: 100%;' },
      },
      align: {
        default: 'left',
        parseHTML: el => el.getAttribute('data-align') || 'left',
        renderHTML: attrs => ({ 'data-align': attrs.align }),
      },
    };
  },
});

export default function QuestionPanel({ problem }: QuestionPanelProps) {
  const html = useMemo(() => {
    if (!problem?.content) return '';
    try {
      const json = JSON.parse(problem.content);
      return generateHTML(json, [
        StarterKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
        ResizableImage,
      ]);
    } catch {
      return problem.content;
    }
  }, [problem?.id, problem?.content]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{problem?.title || 'Problem'}</span>
      </div>
      <div className="panel-content problem-panel-content" style={{ overflowX: 'hidden' }}>
        {html
          ? <div className="tiptap-preview" dangerouslySetInnerHTML={{ __html: html }} />
          : <p style={{ color: '#555', margin: 0 }}>No description available.</p>
        }
      </div>
      <style>{`
        .problem-panel-content { overflow-x: hidden; }
        .tiptap-preview ul[data-type="taskList"] { list-style: none; padding-left: 4px; margin: 0 0 10px; }
        .tiptap-preview ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .tiptap-preview ul[data-type="taskList"] li > label { display: flex; align-items: center; flex-shrink: 0; line-height: 1.6; }
        .tiptap-preview ul[data-type="taskList"] li > div { flex: 1; min-width: 0; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
        .tiptap-preview ul[data-type="taskList"] input[type="checkbox"] { accent-color: var(--accent-green); width: 14px; height: 14px; cursor: default; flex-shrink: 0; margin: 0; }
        .tiptap-preview .tableWrapper, .tiptap-preview table { max-width: 100%; overflow: hidden; }
        .tiptap-preview table { border-collapse: collapse; table-layout: fixed; width: 100%; max-width: 100%; margin: 12px 0; }
        .tiptap-preview table td, .tiptap-preview table th { border: 1px solid var(--border-color); padding: 6px 10px; min-width: 40px; vertical-align: top; overflow-wrap: break-word; word-break: break-word; white-space: normal; }
        .tiptap-preview table th { background: rgba(255,255,255,0.05); font-weight: 600; color: var(--text-heading); }
        .tiptap-preview img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; height: auto; }
        .tiptap-preview img[data-align="center"] { margin-left: auto; margin-right: auto; }
        .tiptap-preview img[data-align="right"] { margin-left: auto; margin-right: 0; }
        .tiptap-preview img[data-align="left"] { margin-left: 0; margin-right: auto; }
      `}</style>
    </div>
  );
}