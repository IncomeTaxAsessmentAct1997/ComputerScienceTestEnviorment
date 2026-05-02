'use client';

import { createContext, useContext } from 'react';
import { usePython } from 'react-py';
import type { RefObject } from 'react';
import type { TerminalHandle } from './TerminalPanel';
import { useEffect } from 'react';

interface PythonRunnerContextValue {
  runPython: (code: string) => Promise<void>;
  isLoading: boolean;
  isRunning: boolean;
}

const PythonRunnerContext = createContext<PythonRunnerContextValue | null>(null);

export function usePythonRunner(): PythonRunnerContextValue {
  const ctx = useContext(PythonRunnerContext);
  if (!ctx) throw new Error('usePythonRunner must be used within PythonRunnerProvider');
  return ctx;
}

interface PythonRunnerProviderProps {
  children: React.ReactNode;
  terminalRef: RefObject<TerminalHandle | null>;
}

export default function PythonRunnerProvider({ children, terminalRef }: PythonRunnerProviderProps) {
  const { runPython, stdout, stderr, isLoading, isRunning } = usePython();

  useEffect(() => {
    if (isLoading) {
      terminalRef.current?.printInfo('Initializing Python...');
    } else {
      terminalRef.current?.printOut('Python ready.');
      terminalRef.current?.printLine('');
    }
  }, [isLoading]);

  useEffect(() => {
    if (stdout) {
      stdout.split('\n').forEach(line => {
        if (line) terminalRef.current?.printOut(line);
      });
    }
  }, [stdout]);

  useEffect(() => {
    if (stderr) {
      stderr.split('\n').forEach(line => {
        if (line) terminalRef.current?.printErr(line);
      });
    }
  }, [stderr]);

  return (
    <PythonRunnerContext.Provider value={{ runPython, isLoading, isRunning }}>
      {children}
    </PythonRunnerContext.Provider>
  );
}
