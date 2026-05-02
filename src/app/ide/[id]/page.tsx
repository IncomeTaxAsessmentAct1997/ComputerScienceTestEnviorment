import { Suspense } from 'react';
import IdePage from './IdePage';

export default function Page() {
  return (
    <Suspense>
      <IdePage />
    </Suspense>
  );
}
