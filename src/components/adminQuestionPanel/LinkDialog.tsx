'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface LinkDialogProps {
  editor: Editor;
  onClose: () => void;
}

export default function LinkDialog({ editor, onClose }: LinkDialogProps) {
  const existing = (editor.getAttributes('link') as any).href as string | undefined;
  const [url, setUrl] = useState(existing || 'https://');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
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
        {existing && (
          <button onClick={() => { (editor.chain().focus() as any).unsetLink().run(); onClose(); }}
            style={{ flex: 1, background: 'rgba(255,123,114,0.1)', border: '1px solid rgba(255,123,114,0.25)', color: '#ff7b72', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
