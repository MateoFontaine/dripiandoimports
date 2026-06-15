import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import LoginForm from '@/components/admin/LoginForm';

export default async function LoginPage() {
  const user = await requireAdmin();
  if (user) redirect('/admin');

  return (
    <Suspense
      fallback={
        <div className="login-page">
          <div className="login-card">Cargando...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
