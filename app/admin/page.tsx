import { getAdminBrands, getAdminProducts } from '@/lib/admin-products';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [{ products, stats }, brands] = await Promise.all([getAdminProducts(), getAdminBrands()]);

  return <AdminDashboard initialProducts={products} initialStats={stats} brands={brands} />;
}
