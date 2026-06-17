-- ============================================================
-- Migración: agregar campo is_featured a products
-- Ejecutá esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. Agregar columna
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);

-- 2. Recrear vista public_catalog incluyendo is_featured
CREATE OR REPLACE VIEW public_catalog AS
SELECT
  p.id,
  b.slug  AS brand_slug,
  b.name  AS brand_name,
  COALESCE(p.admin_overrides->>'name',  p.name)            AS name,
  COALESCE(p.admin_overrides->>'title', p.title)           AS title,
  COALESCE(p.admin_overrides->>'price', p.catalog_price)   AS price,
  COALESCE(p.admin_overrides->>'priceUsd', p.price_usd)    AS price_usd,
  COALESCE(p.admin_overrides->>'priceCny', p.price_cny)    AS price_cny,
  p.extract_id,
  p.item_id,
  p.weidian_url,
  p.kakobuy_url,
  p.is_scraped  AS scraped,
  p.is_featured AS featured,
  p.images,
  p.options,
  p.variants,
  p.scraped_at
FROM products p
JOIN brands b ON b.id = p.brand_id
WHERE p.is_hidden = false;

-- 3. Recrear vista public_catalog_by_brand incluyendo featured
CREATE OR REPLACE VIEW public_catalog_by_brand AS
SELECT
  b.slug,
  b.name,
  b.sort_order,
  jsonb_agg(
    jsonb_build_object(
      'id',         v.id,
      'name',       v.name,
      'price',      v.price,
      'title',      v.title,
      'priceCny',   v.price_cny,
      'priceUsd',   v.price_usd,
      'extractId',  v.extract_id,
      'itemId',     v.item_id,
      'weidianUrl', v.weidian_url,
      'kakobuyUrl', v.kakobuy_url,
      'scraped',    v.scraped,
      'featured',   v.featured,
      'images',     v.images,
      'options',    v.options,
      'variants',   v.variants
    )
    ORDER BY v.name
  ) AS products
FROM brands b
JOIN public_catalog v ON v.brand_slug = b.slug
GROUP BY b.id, b.slug, b.name, b.sort_order
ORDER BY b.sort_order, b.name;
