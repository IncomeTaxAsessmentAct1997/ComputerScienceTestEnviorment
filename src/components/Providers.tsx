'use client';

import { PythonProvider } from 'react-py';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PythonProvider
      packages={{ official: [], micropip: [] }}
      autoImportPackages={false}
    >
      {children}
    </PythonProvider>
  );
}
