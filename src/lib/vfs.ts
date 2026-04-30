type VFSNode = string | VFSDir;
interface VFSDir {
  [key: string]: VFSNode;
}

export const vfs: VFSDir = { '/home/user': {} };
export let cwd = '/home/user';

export function setCwd(path: string) {
  cwd = path;
}

export function vfsGet(path: string): VFSNode | undefined {
  const parts = resolvePath(path).split('/').filter(Boolean);
  let node: VFSNode = vfs;
  for (const p of parts) {
    if (typeof node !== 'object' || node[p] === undefined) return undefined;
    node = node[p];
  }
  return node;
}

export function vfsSet(path: string, val: VFSNode) {
  const abs = resolvePath(path);
  const parts = abs.split('/').filter(Boolean);
  let node = vfs as VFSDir;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === undefined) node[parts[i]] = {};
    node = node[parts[i]] as VFSDir;
  }
  node[parts[parts.length - 1]] = val;
}

export function vfsDelete(path: string): boolean {
  const abs = resolvePath(path);
  const parts = abs.split('/').filter(Boolean);
  let node = vfs as VFSDir;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === undefined) return false;
    node = node[parts[i]] as VFSDir;
  }
  const key = parts[parts.length - 1];
  if (node[key] === undefined) return false;
  delete node[key];
  return true;
}

export function vfsLs(path: string): string[] | null {
  const node = vfsGet(path);
  if (node === undefined || typeof node !== 'object') return null;
  return Object.keys(node);
}

export function resolvePath(p: string): string {
  if (!p || p === '.') return cwd;
  if (!p.startsWith('/')) p = cwd + '/' + p;
  const parts = p.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '..') { if (stack.length) stack.pop(); }
    else if (part !== '.') stack.push(part);
  }
  return '/' + stack.join('/');
}

export function promptStr(): string {
  const display = cwd === '/home/user' ? '~' : cwd.replace('/home/user', '~');
  return `user@pyenv:${display}$`;
}

export function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
