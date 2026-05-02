'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import Navbar from '@/components/Navbar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CIRCUMFERENCE = 119.4;

interface Problem {
  id: string;
  number: number | null;
  title: string;
  is_honors: boolean;
  status: string | null;
}

const EXAMPLE_PROBLEMS: Problem[] = [
  { id: 'ex-1', number: 1, title: 'Hello, World!',        is_honors: false, status: 'solved'  },
  { id: 'ex-2', number: 2, title: 'FizzBuzz',             is_honors: false, status: 'solved'  },
  { id: 'ex-3', number: 3, title: 'Fibonacci Sequence',   is_honors: false, status: 'solved'  },
  { id: 'ex-4', number: 4, title: 'Binary Search',        is_honors: true,  status: null      },
  { id: 'ex-5', number: 5, title: 'Linked List Reversal', is_honors: true,  status: null      },
  { id: 'ex-6', number: 6, title: 'Palindrome Checker',   is_honors: false, status: null      },
  { id: 'ex-7', number: 7, title: 'Merge Sort',           is_honors: true,  status: null      },
  { id: 'ex-8', number: 8, title: 'Two Sum',              is_honors: false, status: null      },
];

export default function HomePage() {
  const router = useRouter();
  const email = useRequireAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [currentClass, setCurrentClass] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [useExamples, setUseExamples] = useState(false);

  useEffect(() => {
    if (email) init(email);
  }, [email]);

  async function init(sessionEmail: string) {
    const { data: student, error } = await supabase
      .from('Students')
      .select('Courses, Admin')
      .eq('Email', sessionEmail)
      .maybeSingle();

    if (error || !student) { loadExamples(); return; }

    const admin = student.Admin === true;
    setIsAdmin(admin);
    const courses: string[] = Array.isArray(student.Courses) ? student.Courses : [];

    if (courses.length === 0) { loadExamples(); return; }

    setAllClasses(courses);
    const saved = localStorage.getItem('selectedClass');
    const match = saved && courses.includes(saved) ? saved : null;
    await selectClass(match || courses[0], sessionEmail, admin, false, courses);
  }

  function loadExamples() {
    setUseExamples(true);
    const classes = ['Computer Science Principles — S1', 'AP Computer Science A — S2', 'Data Structures & Algorithms'];
    setAllClasses(classes);
    setCurrentClass(classes[0]);
    setProblems(EXAMPLE_PROBLEMS);
  }

  async function selectClass(
    cls: string,
    userEmail?: string,
    adminOverride?: boolean,
    examplesOverride?: boolean,
    _classesOverride?: string[]
  ) {
    const resolvedEmail = userEmail || email;
    const resolvedAdmin = adminOverride !== undefined ? adminOverride : isAdmin;
    const resolvedExamples = examplesOverride !== undefined ? examplesOverride : useExamples;

    setCurrentClass(cls);
    localStorage.setItem('selectedClass', cls);

    if (resolvedExamples) { setProblems(EXAMPLE_PROBLEMS); return; }

    const { data: probs, error } = await supabase
      .from('problems')
      .select('id, title, is_honors, number')
      .eq('class_name', cls)
      .order('number');

    if (error || !probs || probs.length === 0) {
      setUseExamples(true);
      setProblems(EXAMPLE_PROBLEMS);
      return;
    }

    let submissions: { problem_id: string; status: string }[] = [];
    if (!resolvedAdmin) {
      const { data: subs } = await supabase
        .from('submissions')
        .select('problem_id, status')
        .eq('user_email', resolvedEmail);
      submissions = subs || [];
    }

    const subMap: Record<string, string> = {};
    submissions.forEach(s => { subMap[s.problem_id] = s.status; });

    setProblems(probs.map((p: { id: string; title: string; is_honors: boolean; number: number | null }) => ({
      ...p,
      status: subMap[p.id] || null,
    })));
  }

  function handleRowClick(p: Problem) {
    router.push(`/ide/${p.id}`);
  }

  const solved = problems.filter(p => p.status === 'solved').length;
  const total = problems.length;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  const strokeOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <>
      <Navbar email={email} />
      <div className="home-container">
        <div className="class-header">
          <div className="class-header-inner">
            <div className="class-meta">
              <span className="class-label">Current Class</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="class-switcher">
                  <h1 className="class-name">{currentClass || 'Loading...'}</h1>
                  <svg className="class-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    {allClasses.map(cls => (
                      <DropdownMenuItem
                        key={cls}
                        className={cls === currentClass ? 'active' : ''}
                        onClick={() => {
                          if (useExamples) { setCurrentClass(cls); setProblems(EXAMPLE_PROBLEMS); }
                          else selectClass(cls);
                        }}
                      >
                        {cls}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    style={{ strokeDashoffset: strokeOffset }}
                  />
                </svg>
                <span className="progress-pct">{pct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="problem-list-wrap">
          <div className="problem-list-header" style={{ gridTemplateColumns: '48px 52px 1fr 110px' }}>
            <span className="col-status" />
            <span className="col-num-h">#</span>
            <span className="col-title">Title</span>
            <span className="col-honors-h">Type</span>
          </div>

          <div className="problem-list">
            {problems.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><path d="M8 12h8" />
                </svg>
                <p>No assignments found.</p>
              </div>
            ) : (
              problems.map((p, i) => (
                <div
                  key={p.id}
                  className="problem-row"
                  style={{
                    animationDelay: `${i * 0.03}s`,
                    gridTemplateColumns: '48px 52px 1fr 110px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleRowClick(p)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') handleRowClick(p); }}
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
                  <span className="col-num-val">{p.number ?? i + 1}</span>
                  <span className="col-title-text">{p.title}</span>
                  <span>
                    <Badge variant={p.is_honors ? 'default' : 'secondary'}>
                      {p.is_honors ? 'Honors' : 'Standard'}
                    </Badge>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}