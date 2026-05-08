'use client';

import { useState, useRef } from 'react';
import { Extension, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Image as TiptapImage } from '@tiptap/extension-image';

export const FontSize = Extension.create({
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

export const CustomTable = Node.create({
  name: 'customTable',
  group: 'block',
  content: 'customTableBody',
  tableRole: 'table',
  isolating: true,
  addAttributes() {
    return {
      colWidths: { default: null },
      rows: { default: 3 },
      cols: { default: 3 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-custom-table]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', { 'data-custom-table': 'true', ...HTMLAttributes }, 0];
  },
});

function ImageResizeWrapper({ node, updateAttributes, selected }: any) {
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

export const ResizableImage = TiptapImage.extend({
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
