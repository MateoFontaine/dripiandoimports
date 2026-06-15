import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import '../admin.css';

export const metadata: Metadata = {
  title: 'Admin — Dripeando Imports',
  robots: 'noindex',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect('/login?next=/admin');

  return <div className="admin-shell">{children}</div>;
}
