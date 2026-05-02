'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import IdeLayout from '@/components/IdeLayout';

interface Problem {
  id: string;
  title: string;
  content: string | null;
}

export default function IdePage() {
  const email = useRequireAuth();
  const params = useParams<{ id: string }>();
  const problemId = params?.id || 'default';

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!email) return;
    loadProblem(email);
  }, [email, problemId]);

  async function loadProblem(userEmail: string) {
    const { data: student } = await supabase
      .from('Students')
      .select('Admin')
      .eq('Email', userEmail)
      .maybeSingle();

    setIsAdmin(student?.Admin === true);
    setAuthReady(true);

    if (!problemId || problemId === 'default') return;

    const { data: prob } = await supabase
      .from('problems')
      .select('id, title, content')
      .eq('id', problemId)
      .maybeSingle();

    if (prob) setProblem(prob);
  }

  if (!authReady) return <Navbar email={email} />;

  return (
    <>
      <Navbar email={email} />
      <IdeLayout
        problem={problem}
        problemId={problemId}
        isAdmin={isAdmin}
      />
    </>
  );
}
