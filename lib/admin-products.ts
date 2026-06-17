import { createServiceClient } from '@/lib/supabase/server';
import { normalizePriceUsd } from '@/lib/price-utils';

export interface AdminBrand {
  id: string;
  slug: string;
  name: string;
}

export interface AdminProduct {
  id: string;
  brandId: string;
  brandSlug: string;
  brandName: string;
  name: string;
  displayName: string;
  catalogPrice: string | null;
  displayPrice: string | null;
  title: string | null;
  displayTitle: string | null;
  priceUsd: string | null;
  displayPriceUsd: string | null;
  priceCny: string | null;
  itemId: string;
  extractId: string | null;
  weidianUrl: string | null;
  kakobuyUrl: string | null;
  isHidden: boolean;
  isFeatured: boolean;
  isScraped: boolean;
  images: string[];
  options: import('@/types/catalog').ProductOption[];
  adminOverrides: Record<string, string>;
}

export interface AdminStats {
  total: number;
  visible: number;
  hidden: number;
  scraped: number;
}

function applyOverrides<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, string>,
  map: Record<string, keyof T>
) {
  const result = { ...base };
  for (const [overrideKey, field] of Object.entries(map)) {
    if (overrides[overrideKey] !== undefined) {
      result[field] = overrides[overrideKey] as T[keyof T];
    }
  }
  return result;
}

export async function getAdminBrands(): Promise<AdminBrand[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('brands')
    .select('id, slug, name')
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

export async function getAdminProducts(): Promise<{ products: AdminProduct[]; stats: AdminStats }> {
  const supabase = createServiceClient();

  const [{ data: brands, error: brandsError }, { data: rows, error: productsError }] =
    await Promise.all([
      supabase.from('brands').select('id, slug, name'),
      supabase.from('products').select('*').order('name'),
    ]);

  if (brandsError) throw brandsError;
  if (productsError) throw productsError;

  const brandMap = new Map((brands || []).map((b) => [b.id, b]));

  const products: AdminProduct[] = (rows || []).map((row) => {
    const brand = brandMap.get(row.brand_id);
    const overrides = (row.admin_overrides || {}) as Record<string, string>;

    const merged = applyOverrides(
      {
        name: row.name,
        catalogPrice: row.catalog_price,
        title: row.title,
        priceUsd: row.price_usd,
        priceCny: row.price_cny,
      },
      overrides,
      { name: 'name', price: 'catalogPrice', title: 'title', priceUsd: 'priceUsd', priceCny: 'priceCny' }
    );

    return {
      id: row.id,
      brandId: row.brand_id,
      brandSlug: brand?.slug || '',
      brandName: brand?.name || '',
      name: row.name,
      displayName: merged.name,
      catalogPrice: row.catalog_price,
      displayPrice: merged.catalogPrice,
      title: row.title,
      displayTitle: merged.title,
      priceUsd: row.price_usd,
      displayPriceUsd: normalizePriceUsd(row.price_usd),
      priceCny: row.price_cny,
      itemId: row.item_id,
      extractId: row.extract_id,
      weidianUrl: row.weidian_url,
      kakobuyUrl: row.kakobuy_url,
      isHidden: row.is_hidden,
      isFeatured: row.is_featured ?? false,
      isScraped: row.is_scraped,
      images: row.images || [],
      options: row.options || [],
      adminOverrides: overrides,
    };
  });

  const stats: AdminStats = {
    total: products.length,
    visible: products.filter((p) => !p.isHidden).length,
    hidden: products.filter((p) => p.isHidden).length,
    scraped: products.filter((p) => p.isScraped).length,
  };

  return { products, stats };
}

export async function getAffcode() {
  const supabase = createServiceClient();
  const { data } = await supabase.from('catalog_meta').select('affcode').eq('id', 1).maybeSingle();
  return data?.affcode || 'rjts7';
}

export function buildWeidianUrl(itemId: string) {
  return `https://weidian.com/item.html?itemID=${itemId}`;
}

export function buildKakobuyUrl(itemId: string, affcode: string) {
  const weidianUrl = buildWeidianUrl(itemId);
  const params = new URLSearchParams({
    url: weidianUrl,
    spider_token: 'bd73',
    affcode,
  });
  return `https://www.kakobuy.com/item/details?${params.toString()}`;
}

export function buildProductId(brandSlug: string, itemId: string) {
  return `${brandSlug}-${itemId}`;
}
