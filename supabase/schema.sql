-- ============================================================
-- China Ropa Nico — Esquema inicial para Supabase
-- Ejecutá esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Marcas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Productos (catálogo + datos scrapeados + admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,          -- ej: corteiz-7658403450
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- Datos del sheet / catálogo base
  name            TEXT NOT NULL,
  catalog_price   TEXT,                      -- ej: EUR10.03
  extract_id      TEXT,
  item_id         TEXT NOT NULL,
  weidian_url     TEXT,
  kakobuy_url     TEXT,

  -- Datos scrapeados de Weidian (nullable si scraped = false)
  title           TEXT,
  price_cny       TEXT,
  price_usd       TEXT,
  scraped_at      TIMESTAMPTZ,
  is_scraped      BOOLEAN NOT NULL DEFAULT false,

  -- Contenido rico (misma forma que tus JSON actuales)
  images          JSONB NOT NULL DEFAULT '[]'::jsonb,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Admin: ocultar producto o sobreescribir campos puntuales
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  admin_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_brand_id   ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_item_id    ON products(item_id);
CREATE INDEX IF NOT EXISTS idx_products_is_hidden  ON products(is_hidden);
CREATE INDEX IF NOT EXISTS idx_products_is_scraped ON products(is_scraped);

-- ------------------------------------------------------------
-- Metadata del catálogo (singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_meta (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  generated_at     TIMESTAMPTZ,
  scraped_at       TIMESTAMPTZ,
  source_sheet_id  TEXT,
  source_gid       TEXT,
  affcode          TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Admins (cuentas con acceso al panel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_profiles_read_own" ON admin_profiles;
CREATE POLICY "admin_profiles_read_own"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ------------------------------------------------------------
-- Config admin (legacy, ya no se usa para login)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_config (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password      TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Trigger updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_meta_updated_at ON catalog_meta;
CREATE TRIGGER trg_catalog_meta_updated_at
  BEFORE UPDATE ON catalog_meta
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_config_updated_at ON admin_config;
CREATE TRIGGER trg_admin_config_updated_at
  BEFORE UPDATE ON admin_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Vista pública: aplica overrides de admin y filtra ocultos
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public_catalog AS
SELECT
  p.id,
  b.slug  AS brand_slug,
  b.name  AS brand_name,
  COALESCE(p.admin_overrides->>'name',  p.name)            AS name,
  COALESCE(p.admin_overrides->>'title', p.title)           AS title,
  COALESCE(p.admin_overrides->>'price', p.catalog_price) AS price,
  COALESCE(p.admin_overrides->>'priceUsd', p.price_usd)    AS price_usd,
  COALESCE(p.admin_overrides->>'priceCny', p.price_cny)    AS price_cny,
  p.extract_id,
  p.item_id,
  p.weidian_url,
  p.kakobuy_url,
  p.is_scraped AS scraped,
  p.images,
  p.options,
  p.variants,
  p.scraped_at
FROM products p
JOIN brands b ON b.id = p.brand_id
WHERE p.is_hidden = false;

-- ------------------------------------------------------------
-- Vista agrupada por marca (equivalente a catalog-public.json)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------
ALTER TABLE brands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_meta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config  ENABLE ROW LEVEL SECURITY;

-- Lectura pública del catálogo
CREATE POLICY "brands_public_read"
  ON brands FOR SELECT
  USING (true);

CREATE POLICY "products_public_read"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "catalog_meta_public_read"
  ON catalog_meta FOR SELECT
  USING (true);

-- Escritura solo con service_role (API routes de Next.js con clave secreta)
-- No creamos policies de INSERT/UPDATE/DELETE para anon/authenticated.
-- Las mutaciones de admin van por server con SUPABASE_SERVICE_ROLE_KEY.

-- admin_config: sin acceso público
CREATE POLICY "admin_config_no_public"
  ON admin_config FOR ALL
  USING (false);
