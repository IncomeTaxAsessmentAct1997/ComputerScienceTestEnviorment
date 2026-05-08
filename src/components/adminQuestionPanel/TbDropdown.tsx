'use client';

import { useEffect, useRef, useState } from 'react';

interface TbDropdownProps {
  label: React.ReactNode;
  items: { label: string; value?: string; action?: () => void }[];
  onSelect: (item: { label: string; value?: string; action?: () => void }) => void;
}

export default function TbDropdown({ label, items, onSelect }: TbDropdownProps) {
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
          background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, minWidth: 130, zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden',
        }}>
          {items.map(item => (
            <button
              key={item.label}
              onMouseDown={e => { e.preventDefault(); onSelect(item); setOpen(false); }}
              style={{
                width: '100%', display: 'block', padding: '7px 12px',
                background: 'none', border: 'none', color: '#ccc',
                textAlign: 'left', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
