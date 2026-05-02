const DB_NAME = 'py-challenge-fs';
const DB_VERSION = 2; // bumped to add 'meta' store
const FILES_STORE = 'files';
const META_STORE = 'meta';

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const d = req.result;
      if (!d.objectStoreNames.contains(FILES_STORE)) d.createObjectStore(FILES_STORE);
      if (!d.objectStoreNames.contains(META_STORE)) d.createObjectStore(META_STORE);
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function fileKey(problemId: string, filename: string): string {
  return `${problemId}:${filename}`;
}

function readonlyKey(problemId: string, filename: string): string {
  return `readonly:${problemId}:${filename}`;
}

export async function idbGet(problemId: string, filename: string): Promise<string | undefined> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(FILES_STORE, 'readonly').objectStore(FILES_STORE).get(fileKey(problemId, filename));
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(problemId: string, filename: string, content: string): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(content, fileKey(problemId, filename));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(problemId: string, filename: string): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).delete(fileKey(problemId, filename));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbList(problemId: string): Promise<string[]> {
  const d = await openDB();
  const prefix = `${problemId}:`;
  return new Promise((resolve, reject) => {
    const req = d.transaction(FILES_STORE, 'readonly').objectStore(FILES_STORE).getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[])
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
      resolve(keys);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetLastFile(problemId: string): Promise<string | undefined> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(`lastFile:${problemId}`);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetLastFile(problemId: string, filename: string): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(filename, `lastFile:${problemId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns true if the file has been marked readonly */
export async function idbIsReadonly(problemId: string, filename: string): Promise<boolean> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(readonlyKey(problemId, filename));
    req.onsuccess = () => resolve(req.result === true);
    req.onerror = () => reject(req.error);
  });
}

/** Sets or clears the readonly flag for a file */
export async function idbSetReadonly(problemId: string, filename: string, value: boolean): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readwrite');
    if (value) {
      tx.objectStore(META_STORE).put(true, readonlyKey(problemId, filename));
    } else {
      tx.objectStore(META_STORE).delete(readonlyKey(problemId, filename));
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Ensures main.py exists for a problem. Call this once during initProblem.
 * Creates the file only if it doesn't already exist.
 */
export async function idbEnsureMainPy(problemId: string): Promise<void> {
  const existing = await idbGet(problemId, 'main.py');
  if (existing === undefined) {
    await idbSet(problemId, 'main.py', '');
  }
}

export function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
