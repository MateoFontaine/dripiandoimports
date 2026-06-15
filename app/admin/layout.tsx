import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth';
import '../admin.css';

export const metadata: Metadata = {
  title: 'Admin — Dripeando Imports',
  robots: 'noindex',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    redirect('/login?next=/admin');
  }

  return <div className="admin-shell">{children}</div>;
}
