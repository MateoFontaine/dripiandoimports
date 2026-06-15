import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function optionsToVariants(options = []) {
  const variants = [];
  for (const group of options) {
    for (const value of group.values || []) {
      variants.push({
        group: group.label,
        name: value.name,
        image: value.image ?? null,
      });
    }
  }
  return variants;
}

export function buildProductRow({
  product,
  base,
  scrapedFile,
  brandId,
  isHidden = false,
  adminOverrides = {},
}) {
  const options = product.options || scrapedFile?.options || [];
  const variants = scrapedFile?.variants || optionsToVariants(options);

  return {
    id: product.id,
    brand_id: brandId,
    name: product.name,
    catalog_price: product.price || base?.price || null,
    extract_id: base?.extractId || null,
    item_id: base?.itemId || product.id.split('-').pop(),
    weidian_url: base?.weidianUrl || null,
    kakobuy_url: base?.kakobuyUrl || null,
    title: product.title || scrapedFile?.title || null,
    price_cny: product.priceCny || scrapedFile?.priceCny || null,
    price_usd: product.priceUsd || scrapedFile?.priceUsd || null,
    scraped_at: scrapedFile?.scrapedAt || product.scrapedAt || null,
    is_scraped: Boolean(product.scraped || scrapedFile),
    images: product.images || scrapedFile?.images || [],
    options,
    variants,
    is_hidden: isHidden,
    admin_overrides: adminOverrides,
  };
}

export async function fetchAdminStateFromDb(supabase) {
  const { data, error } = await supabase
    .from('products')
    .select('id, is_hidden, admin_overrides');

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    map.set(row.id, {
      is_hidden: row.is_hidden,
      admin_overrides: row.admin_overrides || {},
    });
  }
  return map;
}

export async function syncCatalogMeta(supabase, catalog, catalogPublic) {
  const { error } = await supabase.from('catalog_meta').upsert({
    id: 1,
    generated_at: catalog.generatedAt || catalogPublic?.generatedAt || null,
    scraped_at: catalogPublic?.scrapedAt || null,
    source_sheet_id: catalog.source?.sheetId || null,
    source_gid: catalog.source?.gid || null,
    affcode: catalog.source?.affcode || null,
  });

  if (error) throw error;
}

export async function syncAdminConfig(supabase, password) {
  const { error } = await supabase.from('admin_config').upsert({
    id: 1,
    password,
  });

  if (error) throw error;
}

export async function syncBrands(supabase, brands) {
  const brandIds = new Map();

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const { data, error } = await supabase
      .from('brands')
      .upsert(
        { slug: brand.slug, name: brand.name, sort_order: i },
        { onConflict: 'slug' }
      )
      .select('id, slug')
      .single();

    if (error) throw error;
    brandIds.set(brand.slug, data.id);
  }

  return brandIds;
}

export async function upsertProducts(supabase, rows) {
  const chunkSize = 50;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function upsertScrapedProduct(supabase, catalogProduct, scrapedDetail) {
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', catalogProduct.brandSlug)
    .maybeSingle();

  if (brandError) throw brandError;
  if (!brand) throw new Error(`Marca no encontrada: ${catalogProduct.brandSlug}`);

  const existing = await fetchAdminStateFromDb(supabase);
  const admin = existing.get(catalogProduct.id) || { is_hidden: false, admin_overrides: {} };

  const options = scrapedDetail.options || [];
  const row = buildProductRow({
    product: {
      id: catalogProduct.id,
      name: catalogProduct.name,
      price: catalogProduct.price,
      scraped: true,
      title: scrapedDetail.title,
      priceCny: scrapedDetail.priceCny,
      priceUsd: scrapedDetail.priceUsd,
      images: scrapedDetail.images,
      options,
      scrapedAt: scrapedDetail.scrapedAt,
    },
    base: catalogProduct,
    scrapedFile: { ...scrapedDetail, variants: optionsToVariants(options) },
    brandId: brand.id,
    isHidden: admin.is_hidden,
    adminOverrides: admin.admin_overrides,
  });

  const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function touchScrapedAt(supabase) {
  const { error } = await supabase
    .from('catalog_meta')
    .upsert({ id: 1, scraped_at: new Date().toISOString() });

  if (error) throw error;
}

export function loadProductFiles(dataDir) {
  const dir = join(dataDir, 'products');
  const map = new Map();

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file.includes('.error.')) continue;
    const product = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (product?.id) map.set(product.id, product);
  }

  return map;
}

export function buildCatalogIndex(catalog) {
  const index = new Map();

  for (const brand of catalog.brands) {
    for (const product of brand.products) {
      index.set(product.id, { ...product, brandSlug: brand.slug });
    }
  }

  if (catalog.products) {
    for (const product of catalog.products) {
      index.set(product.id, product);
    }
  }

  return index;
}

/**
 * Sincroniza catalog.json + catalog-public.json + data/products/ → Supabase.
 * Preserva is_hidden y admin_overrides que ya existan en la DB.
 */
export async function syncFromLocalFiles({
  dataDir,
  useJsonOverrides = false,
  adminPassword,
} = {}) {
  const root = dataDir || join(__dirname, '..', '..', 'data');
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
  const catalogPublic = JSON.parse(readFileSync(join(root, 'catalog-public.json'), 'utf8'));
  const productFiles = loadProductFiles(root);
  const catalogIndex = buildCatalogIndex(catalog);

  let jsonOverrides = { hidden: [], edits: {} };
  if (useJsonOverrides) {
    try {
      jsonOverrides = JSON.parse(readFileSync(join(root, 'admin-overrides.json'), 'utf8'));
    } catch {
      /* sin overrides en JSON */
    }
  }

  let adminConfigPassword = adminPassword;
  if (!adminConfigPassword) {
    try {
      const cfg = JSON.parse(readFileSync(join(root, 'admin-config.json'), 'utf8'));
      adminConfigPassword = cfg.password;
    } catch {
      /* ok */
    }
  }

  const supabase = getSupabase();
  const dbAdmin = await fetchAdminStateFromDb(supabase);
  const jsonHidden = new Set(jsonOverrides.hidden || []);
  const jsonEdits = jsonOverrides.edits || {};

  await syncCatalogMeta(supabase, catalog, catalogPublic);
  await syncAdminConfig(
    supabase,
    process.env.ADMIN_PASSWORD || adminConfigPassword || 'catalogo2026'
  );

  const brandIds = await syncBrands(supabase, catalogPublic.brands);
  const rows = [];

  for (const brand of catalogPublic.brands) {
    const brandId = brandIds.get(brand.slug);

    for (const product of brand.products) {
      const base = catalogIndex.get(product.id) || {};
      const scrapedFile = productFiles.get(product.id);
      const dbState = dbAdmin.get(product.id);

      const isHidden = dbState?.is_hidden ?? jsonHidden.has(product.id);
      const adminOverrides = Object.keys(dbState?.admin_overrides || {}).length
        ? dbState.admin_overrides
        : jsonEdits[product.id] || {};

      rows.push(
        buildProductRow({
          product,
          base,
          scrapedFile,
          brandId,
          isHidden,
          adminOverrides,
        })
      );
    }
  }

  await upsertProducts(supabase, rows);

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  return {
    products: count || 0,
    brands: catalogPublic.brands.length,
    hidden: rows.filter((r) => r.is_hidden).length,
  };
}
