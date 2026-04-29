import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { ENV, getSession, clearSession } from '../App';
import { Navbar } from '../App';
import './Home.css';

const client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
const CIRCUMFERENCE = 119.4;

const EXAMPLE_PROBLEMS = [
  { id: 'ex-1', number: 1, title: 'Hello, World!',        is_honors: false, status: 'solved'    },
  { id: 'ex-2', number: 2, title: 'FizzBuzz',             is_honors: false, status: 'solved'    },
  { id: 'ex-3', number: 3, title: 'Fibonacci Sequence',   is_honors: false, status: 'attempted' },
  { id: 'ex-4', number: 4, title: 'Binary Search',        is_honors: true,  status: null        },
  { id: 'ex-5', number: 5, title: 'Linked List Reversal', is_honors: true,  status: null        },
  { id: 'ex-6', number: 6, title: 'Palindrome Checker',   is_honors: false, status: null        },
  { id: 'ex-7', number: 7, title: 'Merge Sort',           is_honors: true,  status: null        },
  { id: 'ex-8', number: 8, title: 'Two Sum',              is_honors: false, status: null        },
];

export default function Home() {
  const navigate = useNavigate();
  const email = getSession();

  const [problems, setProblems] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [useExamples, setUseExamples] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const switcherRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: student, error } = await client
        .from('Students')
        .select('Courses, Admin')
        .eq('Email', email)
        .maybeSingle();

      if (error || !student) { loadExamples(); return; }

      setIsAdmin(student.Admin === true);

      const courses = Array.isArray(student.Courses) ? student.Courses : [];
      if (courses.length === 0) { loadExamples(); return; }

      setAllClasses(courses);
      const saved = localStorage.getItem('selectedClass');
      const match = saved && courses.includes(saved) ? saved : courses[0];
      await selectClass(match, courses, student.Admin === true, false);
    }
    init();
  }, []);

  useEffect(() => {
    function handleOutside(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  function loadExamples() {
    setUseExamples(true);
    const cls = ['Computer Science Principles — S1', 'AP Computer Science A — S2', 'Data Structures & Algorithms'];
    setAllClasses(cls);
    setCurrentClass(cls[0]);
    setProblems(EXAMPLE_PROBLEMS);
  }

  async function selectClass(cls, classes, admin, examples) {
    setCurrentClass(cls);
    localStorage.setItem('selectedClass', cls);
    if (examples) { setProblems(EXAMPLE_PROBLEMS); return; }

    const { data: probs, error } = await client
      .from('problems')
      .select('id, title, is_honors, number')
      .eq('class_name', cls)
      .order('number');

    if (error || !probs || probs.length === 0) {
      setUseExamples(true);
      setProblems(EXAMPLE_PROBLEMS);
      return;
    }

    let submissions = [];
    if (!admin) {
      const { data: subs } = await client
        .from('submissions')
        .select('problem_id, status')
        .eq('user_email', email);
      submissions = subs || [];
    }

    const subMap = {};
    submissions.forEach(s => { subMap[s.problem_id] = s.status; });

    setProblems(probs.map(p => ({ ...p, status: subMap[p.id] || null })));
  }

  const solved = problems.filter(p => p.status === 'solved').length;
  const total = problems.length;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  const ringOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="home-page">
      <Navbar onHome={() => navigate('/')} />
      <div className="home-container">
        <div className="class-header">
          <div className="class-header-inner">
            <div className="class-meta">
              <span className="class-label">Current Class</span>
              <div
                ref={switcherRef}
                className={`class-switcher${dropdownOpen ? ' open' : ''}`}
                onClick={e => { e.stopPropagation(); setDropdownOpen(o => !o); }}
              >
                <h1 className="class-name">{currentClass || 'Loading...'}</h1>
                <svg className="class-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <div className="class-dropdown">
                  {allClasses.map(cls => (
                    <div
                      key={cls}
                      className={`class-dropdown-item${cls === currentClass ? ' active' : ''}`}
                      onClick={e => {
                        e.stopPropagation();
                        setDropdownOpen(false);
                        if (useExamples) {
                          setCurrentClass(cls);
                          setProblems(EXAMPLE_PROBLEMS);
                        } else {
                          selectClass(cls, allClasses, isAdmin, false);
                        }
                      }}
                    >
                      {cls}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="class-stats">
              <div className="stat-pill">
                <span className="stat-num">{solved}</span>
                <span className="stat-label">Solved</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-pill">
                <span className="stat-num">{total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="progress-ring-wrap">
                <svg className="progress-ring" width="48" height="48" viewBox="0 0 48 48">
                  <circle className="progress-ring-bg" cx="24" cy="24" r="19" fill="none" strokeWidth="4" />
                  <circle
                    className="progress-ring-fill"
                    cx="24" cy="24" r="19" fill="none" strokeWidth="4" strokeLinecap="round"
                    style={{ strokeDashoffset: ringOffset }}
                  />
                </svg>
                <span className="progress-pct">{pct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="problem-list-wrap">
          <div className="problem-list-header">
            <span />
            <span>#</span>
            <span>Title</span>
            <span>Type</span>
            <span>{isAdmin ? 'Edit' : ''}</span>
          </div>
          <div className="problem-list">
            {problems.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                </svg>
                <p>No assignments found.</p>
              </div>
            ) : problems.map((p, i) => (
              <div
                key={p.id}
                className="problem-row"
                style={{ animationDelay: `${i * 0.03}s`, cursor: 'pointer' }}
                onClick={() => !useExamples && navigate(`/assignment?id=${p.id}`)}
              >
                <div className="col-status">
                  {p.status === 'solved' && (
                    <svg className="status-icon solved" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {p.status === 'attempted' && (
                    <svg className="status-icon attempted" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  )}
                </div>
                <span className="col-num-val">{p.number != null ? p.number : i + 1}</span>
                <span className="col-title-text">{p.title}</span>
                <span>
                  <span className={`honors-badge ${p.is_honors ? 'honors' : 'standard'}`}>
                    {p.is_honors ? 'Honors' : 'Standard'}
                  </span>
                </span>
                {isAdmin ? (
                  <button
                    className="col-edit-btn"
                    onClick={e => { e.stopPropagation(); navigate(`/editor?id=${p.id}`); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}