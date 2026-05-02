'use client';

import { useMemo } from 'react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

interface Problem {
  id: string;
  title: string;
  content: string | null;
}

interface QuestionPanelProps {
  problem: Problem | null;
}

export default function QuestionPanel({ problem }: QuestionPanelProps) {
  const html = useMemo(() => {
    if (!problem?.content) return '';
    try {
      const json = JSON.parse(problem.content);
      return generateHTML(json, [StarterKit]);
    } catch {
      return problem.content;
    }
  }, [problem?.id, problem?.content]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{problem?.title || 'Problem'}</span>
      </div>
      <div className="panel-content problem-panel-content">
        {html
          ? <div className="tiptap-preview" dangerouslySetInnerHTML={{ __html: html }} />
          : <p style={{ color: '#555', margin: 0 }}>No description available.</p>
        }
      </div>
    </div>
  );
}
