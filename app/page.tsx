import { getCatalog } from '@/lib/catalog';
import CatalogApp from '@/components/CatalogApp';

export default async function HomePage() {
  const catalog = await getCatalog();
  return <CatalogApp initialCatalog={catalog} />;
}
