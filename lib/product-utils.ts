import type { Brand, Catalog, Product } from '@/types/catalog';
import { formatPriceUsd, normalizePriceUsd, resolvePriceUsd } from '@/lib/price-utils';

export function normalizeLabel(label: string) {
  return (label || '').trim();
}

export function getProductType(name: string) {
  const n = (name || '').toLowerCase();
  const types: Array<[string, string]> = [
    ['set', 'Set'],
    ['shorts', 'Shorts'],
    ['short', 'Shorts'],
    ['hoodie', 'Hoodie'],
    ['sweater', 'Sweater'],
    ['vest', 'Vest'],
    ['polo', 'Polo'],
    ['shirt', 'Shirt'],
    ['tee', 'Tee'],
  ];

  for (const [key, label] of types) {
    if (n.includes(key)) return label;
  }

  return 'Otro';
}

export function flattenProducts(catalog: Catalog): Product[] {
  return catalog.brands.flatMap((brand) =>
    brand.products.map((product) => ({
      ...product,
      brandName: brand.name,
      brandSlug: brand.slug,
      productType: getProductType(product.name),
    }))
  );
}

export function formatPrice(product: Product) {
  const usd = resolvePriceUsd(product.priceUsd);
  if (usd) return formatPriceUsd(usd);
  return product.price || '';
}

export function getCoverImage(product: Product) {
  if (product.images?.length) return product.images[0];
  const styleGroup = product.options?.find((o) =>
    /estilo|style|color/i.test(normalizeLabel(o.label))
  );
  return styleGroup?.values?.find((v) => v.image)?.image || null;
}

export function groupProductsByBrand(
  brands: Array<{ slug: string; name: string; sort_order: number }>,
  rows: Array<Record<string, unknown>>
): Brand[] {
  const byBrand = new Map<string, Product[]>();

  for (const row of rows) {
    const slug = String(row.brand_slug);
    const product: Product = {
      id: String(row.id),
      name: String(row.name),
      price: String(row.price || ''),
      title: (row.title as string) || null,
      priceCny: (row.price_cny as string) || null,
      priceUsd: normalizePriceUsd(row.price_usd as string | null),
      extractId: (row.extract_id as string) || null,
      itemId: (row.item_id as string) || null,
      weidianUrl: (row.weidian_url as string) || null,
      kakobuyUrl: (row.kakobuy_url as string) || null,
      scraped: Boolean(row.scraped),
      featured: Boolean(row.featured),
      images: (row.images as string[]) || [],
      options: (row.options as Product['options']) || [],
      variants: (row.variants as Product['variants']) || [],
    };

    if (!byBrand.has(slug)) byBrand.set(slug, []);
    byBrand.get(slug)!.push(product);
  }

  return brands.map((brand) => ({
    slug: brand.slug,
    name: brand.name,
    products: byBrand.get(brand.slug) || [],
  }));
}
