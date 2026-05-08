'use client';

import { useEffect, useRef, useState } from 'react';

interface ImageUploadModalProps {
  onClose: () => void;
  onInsert: (src: string) => void;
}

export default function ImageUploadModal({ onClose, onInsert }: ImageUploadModalProps) {
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
