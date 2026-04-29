const client = supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

const CIRCUMFERENCE = 119.4;

const EXAMPLE_PROBLEMS = [
    { id: 'ex-1', number: 1, title: 'Hello, World!',        is_honors: false, status: 'solved'    },
    { id: 'ex-2', number: 2, title: 'FizzBuzz',             is_honors: false, status: 'solved'    },
    { id: 'ex-3', number: 3, title: 'Fibonacci Sequence',   is_honors: false, status: 'solved'    },
    { id: 'ex-4', number: 4, title: 'Binary Search',        is_honors: true,  status: null        },
    { id: 'ex-5', number: 5, title: 'Linked List Reversal', is_honors: true,  status: null        },
    { id: 'ex-6', number: 6, title: 'Palindrome Checker',   is_honors: false, status: null        },
    { id: 'ex-7', number: 7, title: 'Merge Sort',           is_honors: true,  status: null        },
    { id: 'ex-8', number: 8, title: 'Two Sum',              is_honors: false, status: null        },
];

let currentUser = null;
let allProblems = [];
let currentClass = null;
let allClasses = [];
let isAdmin = false;
let useExamples = false;

async function init() {
    const email = getSession();
    if (!email) {
        window.location.href = '../Login/login.html';
        return;
    }

    currentUser = email;
    initProfileUI(email);

    const switcher = document.getElementById('class-switcher');
    switcher.addEventListener('click', e => {
        e.stopPropagation();
        switcher.classList.toggle('open');
    });
    document.addEventListener('click', () => switcher.classList.remove('open'));

    const { data: student, error } = await client
        .from('Students')
        .select('Courses, Admin')
        .eq('Email', email)
        .maybeSingle();

    if (error || !student) {
        loadExamples();
        return;
    }

    isAdmin = student.Admin === true;

    if (isAdmin) {
        document.getElementById('col-edit-header').textContent = 'Edit';
    }

    const courses = Array.isArray(student.Courses) ? student.Courses : [];

    if (courses.length === 0) {
        loadExamples();
        return;
    }

    allClasses = courses;
    buildDropdown();

    const saved = localStorage.getItem('selectedClass');
    const match = saved && courses.includes(saved) ? saved : null;
    await selectClass(match || courses[0]);
}

function loadExamples() {
    useExamples = true;
    allClasses = ['Computer Science Principles — S1', 'AP Computer Science A — S2', 'Data Structures & Algorithms'];
    buildDropdown();
    currentClass = allClasses[0];
    document.getElementById('class-name').textContent = currentClass;
    highlightActiveClass();
    allProblems = EXAMPLE_PROBLEMS;
    renderList();
}

function buildDropdown() {
    const dropdown = document.getElementById('class-dropdown');
    dropdown.innerHTML = '';

    allClasses.forEach(cls => {
        const item = document.createElement('div');
        item.className = 'class-dropdown-item';
        item.textContent = cls;
        item.dataset.cls = cls;
        item.addEventListener('click', async e => {
            e.stopPropagation();
            document.getElementById('class-switcher').classList.remove('open');
            if (useExamples) {
                currentClass = cls;
                document.getElementById('class-name').textContent = cls;
                highlightActiveClass();
                allProblems = EXAMPLE_PROBLEMS;
                renderList();
            } else {
                await selectClass(cls);
            }
        });
        dropdown.appendChild(item);
    });
}

function highlightActiveClass() {
    document.querySelectorAll('.class-dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.cls === currentClass);
    });
}

async function selectClass(cls) {
    currentClass = cls;
    localStorage.setItem('selectedClass', cls);
    document.getElementById('class-name').textContent = cls;
    highlightActiveClass();
    await loadProblems();
}

async function loadProblems() {
    const list = document.getElementById('problem-list');
    list.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    const { data: problems, error } = await client
        .from('problems')
        .select('id, title, is_honors, number')
        .eq('class_name', currentClass)
        .order('number');

    if (error || !problems || problems.length === 0) {
        useExamples = true;
        allProblems = EXAMPLE_PROBLEMS;
        renderList();
        return;
    }

    let submissions = [];
    if (!isAdmin) {
        const { data: subs } = await client
            .from('submissions')
            .select('problem_id, status')
            .eq('user_email', currentUser);
        submissions = subs || [];
    }

    const subMap = {};
    submissions.forEach(s => { subMap[s.problem_id] = s.status; });

    allProblems = problems.map(p => ({
        ...p,
        status: subMap[p.id] || null
    }));

    renderList();
}

function renderList() {
    const list = document.getElementById('problem-list');
    list.innerHTML = '';

    let solved = 0;
    allProblems.forEach(p => { if (p.status === 'solved') solved++; });
    const total = allProblems.length;

    document.getElementById('stat-solved').textContent = solved;
    document.getElementById('stat-total').textContent = total;

    const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
    document.getElementById('progress-pct').textContent = pct + '%';
    const fill = document.getElementById('progress-ring-fill');
    fill.style.strokeDashoffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

    if (allProblems.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                </svg>
                <p>No assignments found.</p>
            </div>`;
        return;
    }

    allProblems.forEach((p, i) => {
        const row = document.createElement('a');
        row.className = 'problem-row';
        row.href = useExamples ? '#' : `../problem/problem.html?id=${p.id}`;
        row.style.animationDelay = `${i * 0.03}s`;

        const statusIcon = p.status === 'solved'
            ? `<svg class="status-icon solved" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`
            : p.status === 'attempted'
            ? `<svg class="status-icon attempted" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>`
            : '';

        const honorsCls = p.is_honors ? 'honors' : 'standard';
        const honorsLabel = p.is_honors ? 'Honors' : 'Standard';

        const editBtn = isAdmin
            ? `<button class="col-edit-btn" data-id="${p.id}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
               </button>`
            : '<span></span>';

        row.innerHTML = `
            <div class="col-status">${statusIcon}</div>
            <span class="col-num-val">${p.number != null ? p.number : i + 1}</span>
            <span class="col-title-text">${p.title}</span>
            <span><span class="honors-badge ${honorsCls}">${honorsLabel}</span></span>
            ${editBtn}
        `;

        if (isAdmin) {
            const btn = row.querySelector('.col-edit-btn');
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `../editor/editor.html?id=${p.id}`;
            });
        }

        list.appendChild(row);
    });
}

init();
