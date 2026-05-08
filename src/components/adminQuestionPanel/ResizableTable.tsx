'use client';

import { useRef } from 'react';
import type { TableData } from './Types';
import { MIN_COL_WIDTH } from './Helpers';

interface ResizableTableProps {
  tableData: TableData;
  onChange: (updated: TableData) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ResizableTable({ tableData, onChange, containerRef }: ResizableTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const { rows, cols, colWidths, cells } = tableData;

  function getContainerWidth() {
    return containerRef.current?.offsetWidth ?? 600;
  }

  function startColResize(colIndex: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const table = tableRef.current;
    if (!table) return;

    const containerWidth = getContainerWidth();
    const startX = e.clientX;
    const startWidths = [...colWidths];

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const newWidths = [...startWidths];

      const leftCol = colIndex;
      const rightCol = colIndex + 1;

      if (rightCol >= cols) return;

      const leftNew = Math.max(MIN_COL_WIDTH, startWidths[leftCol] + dx);
      const rightNew = Math.max(MIN_COL_WIDTH, startWidths[leftCol] + startWidths[rightCol] - leftNew);

      const totalOthers = newWidths.reduce((s, w, i) => i !== leftCol && i !== rightCol ? s + w : s, 0);
      const maxLeft = containerWidth - totalOthers - MIN_COL_WIDTH;
      newWidths[leftCol] = Math.min(leftNew, maxLeft);
      newWidths[rightCol] = Math.max(MIN_COL_WIDTH, startWidths[leftCol] + startWidths[rightCol] - newWidths[leftCol]);

      onChange({ ...tableData, colWidths: newWidths });
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    }

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function updateCell(row: number, col: number, value: string) {
    const newCells = cells.map(r => [...r]);
    newCells[row][col] = value;
    onChange({ ...tableData, cells: newCells });
  }

  const totalWidth = colWidths.reduce((s, w) => s + w, 0);

  return (
    <div style={{ width: '100%', overflowX: 'hidden', margin: '12px 0', userSelect: 'none' }}>
      <table
        ref={tableRef}
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid var(--border-color)',
        }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: `${(w / totalWidth) * 100}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cells[0]?.map((cell, colIdx) => (
              <th
                key={colIdx}
                style={{
                  border: '1px solid var(--border-color)',
                  borderTop: 'none',
                  borderLeft: colIdx === 0 ? 'none' : '1px solid var(--border-color)',
                  borderRight: colIdx === cols - 1 ? 'none' : '1px solid var(--border-color)',
                  padding: 0,
                  background: 'rgba(255,255,255,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => updateCell(0, colIdx, e.currentTarget.textContent || '')}
                  style={{
                    outline: 'none', padding: '6px 10px', minHeight: 32,
                    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-heading)', wordBreak: 'break-word',
                    whiteSpace: 'normal', userSelect: 'text', width: '100%', boxSizing: 'border-box',
                  }}
                >
                  {cell}
                </div>
                {colIdx < cols - 1 && (
                  <div
                    onMouseDown={e => startColResize(colIdx, e)}
                    style={{
                      position: 'absolute', right: -3, top: 0, bottom: 0,
                      width: 6, cursor: 'col-resize', zIndex: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget.querySelector('.resize-line') as HTMLElement | null)!.style.background = 'var(--accent-green)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget.querySelector('.resize-line') as HTMLElement | null)!.style.background = 'transparent';
                    }}
                  >
                    <div className="resize-line" style={{ width: 2, height: '100%', background: 'transparent', transition: 'background 0.15s', pointerEvents: 'none' }} />
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.slice(1).map((row, rowIdx) => (
            <tr key={rowIdx + 1}>
              {row.map((cell, colIdx) => (
                <td
                  key={colIdx}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderBottom: rowIdx === rows - 2 ? 'none' : '1px solid var(--border-color)',
                    borderLeft: colIdx === 0 ? 'none' : '1px solid var(--border-color)',
                    borderRight: colIdx === cols - 1 ? 'none' : '1px solid var(--border-color)',
                    padding: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    verticalAlign: 'top',
                  }}
                >
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => updateCell(rowIdx + 1, colIdx, e.currentTarget.textContent || '')}
                    style={{
                      outline: 'none', padding: '6px 10px', minHeight: 32,
                      fontFamily: 'var(--font-ui)', fontSize: 13,
                      color: 'var(--text-main)', wordBreak: 'break-word',
                      whiteSpace: 'normal', userSelect: 'text', width: '100%', boxSizing: 'border-box',
                    }}
                  >
                    {cell}
                  </div>
                  {colIdx < cols - 1 && (
                    <div
                      onMouseDown={e => startColResize(colIdx, e)}
                      style={{
                        position: 'absolute', right: -3, top: 0, bottom: 0,
                        width: 6, cursor: 'col-resize', zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget.querySelector('.resize-line') as HTMLElement | null)!.style.background = 'var(--accent-green)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget.querySelector('.resize-line') as HTMLElement | null)!.style.background = 'transparent';
                      }}
                    >
                      <div className="resize-line" style={{ width: 2, height: '100%', background: 'transparent', transition: 'background 0.15s', pointerEvents: 'none' }} />
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
