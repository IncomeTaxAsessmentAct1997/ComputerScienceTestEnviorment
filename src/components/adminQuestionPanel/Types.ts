export interface Problem {
  id: string;
  title: string;
  content: string | null;
}

export interface AdminQuestionPanelProps {
  problem: Problem | null;
  problemId: string;
}

export interface TableData {
  id: string;
  rows: number;
  cols: number;
  colWidths: number[];
  cells: string[][];
}

export type ColorPickerTarget = 'text' | 'highlight';
