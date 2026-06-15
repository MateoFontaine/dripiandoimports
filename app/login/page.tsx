import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth';
import LoginForm from '@/components/admin/LoginForm';

export default async function LoginPage() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (verifyAdminToken(token)) redirect('/admin');

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
