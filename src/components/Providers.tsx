'use client';

import { PythonProvider } from 'react-py';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PythonProvider
      packages={{ official: ['pyodide-http'], micropip: [] }}
      autoImportPackages={false}
    >
      {children}
    </PythonProvider>
  );
}
