declare module 'pyodide' {
  export interface PyodideInterface {
    runPython(code: string): any;
    runPythonAsync(code: string): Promise<any>;
    globals: {
      set(name: string, value: any): void;
      get(name: string): any;
    };
    FS: {
      mkdir(path: string): void;
      writeFile(path: string, data: string | Uint8Array): void;
      readFile(path: string, opts?: { encoding: string }): string | Uint8Array;
      readdir(path: string): string[];
      stat(path: string): { mode: number };
      isDir(mode: number): boolean;
    };
  }
  export function loadPyodide(options?: { indexURL?: string }): Promise<PyodideInterface>;
}
