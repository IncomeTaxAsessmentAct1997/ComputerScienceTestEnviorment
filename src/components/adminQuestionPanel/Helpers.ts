import type { Editor } from '@tiptap/react';
import type { TableData } from './Types';

export const MIN_COL_WIDTH = 40;
export const BUFFER = 20;

export function insertBlockAfter(editor: Editor, blockPos: number, nodeJSON: any) {
  const { state } = editor;
  const { doc } = state;
  let insertAt = doc.content.size;
  doc.forEach((node: any, pos: number) => {
    if (blockPos >= pos && blockPos < pos + node.nodeSize) {
      insertAt = pos + node.nodeSize;
    }
  });
  const tr = state.tr.insert(insertAt, state.schema.nodeFromJSON(nodeJSON));
  editor.view.dispatch(tr);
  setTimeout(() => {
    editor.commands.focus();
    editor.commands.setTextSelection(insertAt + 1);
  }, 0);
}

export function getBlockDomElement(editor: Editor, blockPos: number): HTMLElement | null {
  const view = editor.view;
  try {
    let domNode = view.domAtPos(blockPos + 1).node as Node;
    let el = (domNode.nodeType === Node.TEXT_NODE ? domNode.parentElement : domNode) as HTMLElement;
    while (el && el.parentElement && !el.parentElement.classList.contains('tiptap-editor')) {
      el = el.parentElement as HTMLElement;
    }
    if (!el?.parentElement?.classList.contains('tiptap-editor')) return null;
    return el;
  } catch {
    return null;
  }
}

export function reorderBlocks(
  editor: Editor,
  blockPos: number,
  transform: (blocks: any[], idx: number) => any[] | null
) {
  const { state } = editor;
  const { doc } = state;
  const blocks: any[] = [];
  const positions: number[] = [];
  doc.forEach((node: any, pos: number) => { blocks.push(node); positions.push(pos); });
  const currentIdx = blocks.findIndex((_: any, i: number) =>
    blockPos >= positions[i] && blockPos < positions[i] + blocks[i].nodeSize
  );
  if (currentIdx === -1) return;
  const reordered = transform(blocks, currentIdx);
  if (!reordered) return;
  const tr = state.tr.replaceWith(0, doc.content.size, reordered);
  editor.view.dispatch(tr);
}

export function makeTableId() {
  return 'tbl_' + Math.random().toString(36).slice(2, 9);
}

export function makeTableData(rows: number, cols: number, containerWidth: number): TableData {
  const colW = Math.max(MIN_COL_WIDTH, Math.floor(containerWidth / cols));
  return {
    id: makeTableId(),
    rows,
    cols,
    colWidths: Array(cols).fill(colW),
    cells: Array.from({ length: rows }, () => Array(cols).fill('')),
  };
}
