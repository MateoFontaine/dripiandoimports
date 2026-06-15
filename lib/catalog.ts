import { createClient } from '@/lib/supabase/server';
import { groupProductsByBrand } from '@/lib/product-utils';
import type { Catalog } from '@/types/catalog';
import { unstable_noStore as noStore } from 'next/cache';

export async function getCatalog(): Promise<Catalog> {
  noStore();
  const supabase = createClient();

  const [{ data: brands, error: brandsError }, { data: products, error: productsError }, { data: meta }] =
    await Promise.all([
      supabase.from('brands').select('slug, name, sort_order').order('sort_order'),
      supabase.from('public_catalog').select('*'),
      supabase.from('catalog_meta').select('generated_at, scraped_at').eq('id', 1).maybeSingle(),
    ]);

  if (brandsError) throw brandsError;
  if (productsError) throw productsError;

  return {
    brands: groupProductsByBrand(brands || [], products || []),
    generatedAt: meta?.generated_at || null,
    scrapedAt: meta?.scraped_at || null,
  };
}
