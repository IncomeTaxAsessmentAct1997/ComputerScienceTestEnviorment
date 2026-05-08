'use client';

import { useEffect, useRef } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { PRESET_COLORS } from './Constants';

interface ColorPickerProps {
  color: string;
  onChange: (c: string) => void;
  onClose: () => void;
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
      padding: 12, zIndex: 1000, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <HexColorPicker color={color} onChange={onChange} style={{ width: 180, height: 140 }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', width: 180 }}>
        {PRESET_COLORS.map(c => (
          <div key={c} onMouseDown={e => { e.preventDefault(); onChange(c); }}
            style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: c === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
        ))}
      </div>
      <HexColorInput color={color} onChange={onChange}
        style={{ background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', outline: 'none', width: '100%' }} />
    </div>
  );
}
