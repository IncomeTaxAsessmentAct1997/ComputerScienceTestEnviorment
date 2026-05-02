import { Suspense } from 'react';
import EditorPage from '@/components/EditorPage';

export default function Page() {
  return (
    <Suspense>
      <EditorPage />
    </Suspense>
  );
}
