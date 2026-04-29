const vfs = { '/home/user': {} };
let cwd = '/home/user';

function vfs_get(path) {
    const parts = resolve_path(path).split('/').filter(Boolean);
    let node = vfs;
    for (const p of parts) {
        if (node[p] === undefined) return undefined;
        node = node[p];
    }
    return node;
}

function vfs_set(path, val) {
    const abs = resolve_path(path);
    const parts = abs.split('/').filter(Boolean);
    let node = vfs;
    for (let i = 0; i < parts.length - 1; i++) {
        if (node[parts[i]] === undefined) node[parts[i]] = {};
        node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = val;
}

function vfs_delete(path) {
    const abs = resolve_path(path);
    const parts = abs.split('/').filter(Boolean);
    let node = vfs;
    for (let i = 0; i < parts.length - 1; i++) {
        if (node[parts[i]] === undefined) return false;
        node = node[parts[i]];
    }
    const key = parts[parts.length - 1];
    if (node[key] === undefined) return false;
    delete node[key];
    return true;
}

function vfs_ls(path) {
    const node = vfs_get(path);
    if (node === undefined || typeof node !== 'object') return null;
    return Object.keys(node);
}

function resolve_path(p) {
    if (!p || p === '.') return cwd;
    if (!p.startsWith('/')) p = cwd + '/' + p;
    const parts = p.split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
        if (part === '..') { if (stack.length) stack.pop(); }
        else if (part !== '.') stack.push(part);
    }
    return '/' + stack.join('/');
}

function prompt_str() {
    const display = cwd === '/home/user' ? '~' : cwd.replace('/home/user', '~');
    return `user@pyenv:${display}$`;
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function sync_vfs_to_pyodide() {
    if (!pyodide_ready) return;
    function walk(node, path) {
        for (const [name, val] of Object.entries(node)) {
            const full = path + '/' + name;
            if (typeof val === 'string') {
                pyodide.FS.writeFile(full, val);
            } else {
                try { pyodide.FS.mkdir(full); } catch (_) {}
                walk(val, full);
            }
        }
    }
    try { pyodide.FS.mkdir('/home'); } catch (_) {}
    try { pyodide.FS.mkdir('/home/user'); } catch (_) {}
    walk(vfs['/home/user'] || {}, '/home/user');
}

function sync_pyodide_to_vfs() {
    if (!pyodide_ready) return;
    function read_dir(path) {
        const result = {};
        let entries;
        try { entries = pyodide.FS.readdir(path); } catch (_) { return result; }
        for (const entry of entries) {
            if (entry === '.' || entry === '..') continue;
            const full = path + '/' + entry;
            const stat = pyodide.FS.stat(full);
            if (pyodide.FS.isDir(stat.mode)) {
                result[entry] = read_dir(full);
            } else {
                try { result[entry] = pyodide.FS.readFile(full, { encoding: 'utf8' }); } catch (_) { result[entry] = ''; }
            }
        }
        return result;
    }
    try {
        vfs['/home/user'] = read_dir('/home/user');
    } catch (_) {}
}

const terminal_body = document.getElementById('terminal-body');
const terminal_output = document.getElementById('terminal-output');
const term_input = document.getElementById('term-input');
const term_input_prompt = document.getElementById('term-input-prompt');

function scroll_bottom() {
    terminal_body.scrollTop = terminal_body.scrollHeight;
}

function print_line(html, cls) {
    const span = document.createElement('span');
    span.className = 'term-line' + (cls ? ' ' + cls : '');
    span.innerHTML = html;
    terminal_output.appendChild(span);
    scroll_bottom();
}

function print_cmd_echo(prompt_text, cmd_text) {
    print_line(`<span class="term-prompt">${esc(prompt_text)}</span> <span class="term-cmd-echo">${esc(cmd_text)}</span>`);
}

function print_out(text) {
    if (text) print_line(esc(text), 'term-out');
}

function print_err(text) {
    print_line(esc(text), 'term-err');
}

function print_info(text) {
    print_line(esc(text), 'term-info');
}

function update_prompt() {
    term_input_prompt.textContent = prompt_str();
}

function tokenize(raw) {
    const tokens = [];
    let current = '';
    let in_quote = null;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (in_quote) {
            if (ch === in_quote) { in_quote = null; tokens.push(current); current = ''; }
            else current += ch;
        } else if (ch === '"' || ch === "'") {
            in_quote = ch;
        } else if (ch === ' ') {
            if (current) { tokens.push(current); current = ''; }
        } else {
            current += ch;
        }
    }
    if (current) tokens.push(current);
    return tokens;
}

async function handle_command(raw) {
    raw = raw.trim();
    if (!raw) return;

    cmd_history.unshift(raw);
    if (cmd_history.length > 200) cmd_history.pop();
    history_idx = -1;

    print_cmd_echo(prompt_str(), raw);

    const args = tokenize(raw);
    const cmd = args[0];

    if (cmd === 'clear') {
        terminal_output.innerHTML = '';
        return;
    }

    if (cmd === 'python3' || cmd === 'python') {
        if (!pyodide_ready) { print_err('Python not ready yet.'); return; }
        if (args[1] === '-c' && args[2]) {
            await run_python_inline(args.slice(2).join(' '));
        } else if (args[1]) {
            await run_python_file(args[1]);
        } else {
            print_err('Interactive Python REPL not supported. Use: python3 script.py or python3 -c "code"');
        }
        return;
    }

    if (cmd === 'open') {
        if (!args[1]) { print_err('open: missing file operand'); return; }
        const target = resolve_path(args[1]);
        const node = vfs_get(target);
        let content;
        if (typeof node === 'string') {
            content = node;
        } else if (args[1] === 'script.py' || args[1] === './script.py') {
            print_info(`'${args[1]}' is already open in the editor.`);
            return;
        } else if (node === undefined) {
            print_err(`open: ${args[1]}: No such file or directory`);
            return;
        } else {
            print_err(`open: ${args[1]}: Is a directory`);
            return;
        }

        if (!window.editor) { print_err('open: editor not ready yet'); return; }

        const ext = args[1].split('.').pop().toLowerCase();
        const lang_map = { py: 'python', js: 'javascript', ts: 'typescript', json: 'json', html: 'html', css: 'css', md: 'markdown', sh: 'shell', txt: 'plaintext' };
        const lang = lang_map[ext] || 'plaintext';

        monaco.editor.setModelLanguage(window.editor.getModel(), lang);
        window.editor.setValue(content);
        set_editor_tab(args[1].split('/').pop());
        print_info(`Opened '${args[1]}' in editor.`);
        return;
    }

    if (cmd === 'ls') {
        const target = args[1] ? resolve_path(args[1]) : cwd;
        const entries = vfs_ls(target);
        if (entries === null) { print_err(`ls: cannot access '${args[1] || '.'}': No such file or directory`); return; }
        if (entries.length === 0) return;
        const node = vfs_get(target);
        const parts = entries.map(e => {
            const is_dir = typeof node[e] === 'object';
            return `<span class="${is_dir ? 'term-dir' : 'term-file'}">${esc(e)}${is_dir ? '/' : ''}</span>`;
        });
        print_line(parts.join('  '));
        return;
    }

    if (cmd === 'pwd') { print_out(cwd); return; }

    if (cmd === 'cd') {
        const target = args[1] ? resolve_path(args[1]) : '/home/user';
        const node = vfs_get(target);
        if (node === undefined) { print_err(`cd: ${args[1]}: No such file or directory`); return; }
        if (typeof node !== 'object') { print_err(`cd: ${args[1]}: Not a directory`); return; }
        cwd = target;
        update_prompt();
        if (pyodide_ready) {
            try { await pyodide.runPythonAsync(`os.chdir('${target}')`); } catch (_) {}
        }
        return;
    }

    if (cmd === 'mkdir') {
        if (!args[1]) { print_err('mkdir: missing operand'); return; }
        const target = resolve_path(args[1]);
        if (vfs_get(target) !== undefined) { print_err(`mkdir: cannot create directory '${args[1]}': File exists`); return; }
        vfs_set(target, {});
        return;
    }

    if (cmd === 'touch') {
        if (!args[1]) { print_err('touch: missing file operand'); return; }
        const target = resolve_path(args[1]);
        if (vfs_get(target) === undefined) vfs_set(target, '');
        return;
    }

    if (cmd === 'cat') {
        if (!args[1]) { print_err('cat: missing operand'); return; }
        const target = resolve_path(args[1]);
        const node = vfs_get(target);
        if (node === undefined) {
            if (args[1] === 'script.py') { print_out(window.editor ? window.editor.getValue() : ''); return; }
            print_err(`cat: ${args[1]}: No such file or directory`); return;
        }
        if (typeof node === 'object') { print_err(`cat: ${args[1]}: Is a directory`); return; }
        print_out(node);
        return;
    }

    if (cmd === 'mv') {
        if (!args[1] || !args[2]) { print_err('mv: missing operand'); return; }
        const src = resolve_path(args[1]);
        const dst_raw = resolve_path(args[2]);
        const dst_node = vfs_get(dst_raw);
        const dst = (typeof dst_node === 'object') ? dst_raw + '/' + args[1].split('/').pop() : dst_raw;
        const src_node = vfs_get(src);
        if (src_node === undefined) {
            if (args[1] === 'script.py') { vfs_set(dst, window.editor ? window.editor.getValue() : ''); return; }
            print_err(`mv: cannot stat '${args[1]}': No such file or directory`); return;
        }
        vfs_set(dst, src_node);
        vfs_delete(src);
        return;
    }

    if (cmd === 'cp') {
        if (!args[1] || !args[2]) { print_err('cp: missing operand'); return; }
        const src = resolve_path(args[1]);
        const dst_raw = resolve_path(args[2]);
        const dst_node = vfs_get(dst_raw);
        const dst = (typeof dst_node === 'object') ? dst_raw + '/' + args[1].split('/').pop() : dst_raw;
        const src_node = vfs_get(src);
        if (src_node === undefined) {
            if (args[1] === 'script.py') { vfs_set(dst, window.editor ? window.editor.getValue() : ''); return; }
            print_err(`cp: cannot stat '${args[1]}': No such file or directory`); return;
        }
        vfs_set(dst, JSON.parse(JSON.stringify(src_node)));
        return;
    }

    if (cmd === 'rm') {
        if (!args[1]) { print_err('rm: missing operand'); return; }
        const target = resolve_path(args[1]);
        if (!vfs_delete(target)) { print_err(`rm: cannot remove '${args[1]}': No such file or directory`); return; }
        return;
    }

    if (cmd === 'echo') { print_out(args.slice(1).join(' ')); return; }
    if (cmd === 'whoami') { print_out('user'); return; }
    if (cmd === 'hostname') { print_out('pyenv'); return; }
    if (cmd === 'uname') { print_out(args.includes('-a') ? 'Linux pyenv 5.15.0 #1 SMP x86_64 GNU/Linux' : 'Linux'); return; }
    if (cmd === 'date') { print_out(new Date().toString()); return; }
    if (cmd === 'env') { print_out('USER=user\nHOME=/home/user\nSHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin'); return; }

    if (cmd === 'which') {
        const cmds = { python3: '/usr/bin/python3', python: '/usr/bin/python3', ls: '/bin/ls', mv: '/bin/mv', cp: '/bin/cp', rm: '/bin/rm', mkdir: '/bin/mkdir', touch: '/bin/touch', cat: '/bin/cat', pwd: '/bin/pwd', cd: '/usr/bin/cd', echo: '/bin/echo', clear: '/usr/bin/clear', open: '/usr/bin/open' };
        if (args[1] && cmds[args[1]]) print_out(cmds[args[1]]);
        else if (args[1]) print_err(`${args[1]}: not found`);
        return;
    }

    if (cmd === 'help' || cmd === 'man') {
        print_info('Available commands: python3, python, ls, cd, pwd, mkdir, touch, cat, mv, cp, rm, echo, clear, open, whoami, hostname, uname, date, env, which, help');
        print_info('  open <file>  — open a file from the filesystem into the editor');
        return;
    }

    print_err(`${cmd}: command not found`);
}

let cmd_history = [];
let history_idx = -1;

term_input.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
        const val = term_input.value;
        term_input.value = '';
        await handle_command(val);
        update_prompt();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history_idx < cmd_history.length - 1) {
            history_idx++;
            term_input.value = cmd_history[history_idx];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (history_idx > 0) { history_idx--; term_input.value = cmd_history[history_idx]; }
        else { history_idx = -1; term_input.value = ''; }
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = term_input.value;
        const args = tokenize(val);
        if (args.length === 0) return;
        const last = args[args.length - 1];
        const dir_part = last.includes('/') ? last.substring(0, last.lastIndexOf('/') + 1) : '';
        const name_part = last.includes('/') ? last.substring(last.lastIndexOf('/') + 1) : last;
        const search_dir = dir_part ? resolve_path(dir_part) : cwd;
        const entries = vfs_ls(search_dir) || [];
        const matches = entries.filter(e => e.startsWith(name_part));
        if (matches.length === 1) {
            args[args.length - 1] = dir_part + matches[0];
            term_input.value = args.join(' ');
        } else if (matches.length > 1) {
            print_cmd_echo(prompt_str(), val);
            print_line(matches.map(m => esc(m)).join('  '));
        }
    } else if (e.key === 'c' && e.ctrlKey) {
        print_cmd_echo(prompt_str(), term_input.value + '^C');
        term_input.value = '';
        history_idx = -1;
    } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        terminal_output.innerHTML = '';
    }
});

terminal_body.addEventListener('click', () => term_input.focus());
