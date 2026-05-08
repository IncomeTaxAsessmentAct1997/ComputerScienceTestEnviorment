'use client';

import { useRef, useState } from 'react';

interface TableSizeModalProps {
  onClose: () => void;
  onConfirm: (rows: number, cols: number) => void;
}

export default function TableSizeModal({ onClose, onConfirm }: TableSizeModalProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const overlayRef = useRef<HTMLDivElement>(null);
  const MAX = 10;
  const gridSize = MAX;

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
        padding: 28, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 15, fontFamily: 'var(--font-ui)' }}>Insert Table</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ marginBottom: 12, fontFamily: 'var(--font-ui)', fontSize: 13, color: '#888' }}>
          {rows} × {cols}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: 3, marginBottom: 16 }}
          onMouseLeave={() => { setRows(3); setCols(3); }}
        >
          {Array.from({ length: gridSize * gridSize }, (_, i) => {
            const r = Math.floor(i / gridSize) + 1;
            const c = (i % gridSize) + 1;
            const active = r <= rows && c <= cols;
            return (
              <div
                key={i}
                onMouseEnter={() => { setRows(r); setCols(c); }}
                onClick={() => onConfirm(rows, cols)}
                style={{
                  width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                  background: active ? 'rgba(46,204,113,0.4)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${active ? 'rgba(46,204,113,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'background 0.08s, border-color 0.08s',
                }}
              />
            );
          })}
        </div>
        <button
          onClick={() => onConfirm(rows, cols)}
          style={{
            width: '100%', background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.35)',
            color: 'var(--accent-green)', borderRadius: 8, padding: '9px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
          }}
        >
          Insert {rows} × {cols} Table
        </button>
      </div>
    </div>
  );
}
