import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { scrapeKakobuyPage } from './lib/kakobuy-scraper.js';
import { getSupabase, touchScrapedAt, upsertScrapedProduct } from './lib/supabase-sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PRODUCTS_DIR = join(DATA_DIR, 'products');
const CATALOG_PATH = join(DATA_DIR, 'catalog.json');

const args = process.argv.slice(2);
const limit = getArgNumber('--limit');
const brandFilter = getArgValue('--brand');
const idFilter = getArgValue('--id');
const force = args.includes('--force');
const delayMs = getArgNumber('--delay') ?? 2000;

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

function getArgNumber(flag) {
  const value = getArgValue(flag);
  return value ? Number(value) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
}

function syncCatalogFromFiles(catalog) {
  for (const product of catalog.products) {
    const outPath = join(PRODUCTS_DIR, `${product.id}.json`);
    if (!existsSync(outPath)) continue;
    try {
      const detail = JSON.parse(readFileSync(outPath, 'utf8'));
      product.scraped = true;
      product.scrapedAt = detail.scrapedAt;
      product.detailFile = `products/${product.id}.json`;
    } catch {
      console.warn(`Archivo corrupto, se re-scrapeará: ${product.id}`);
    }
  }
}

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmpPath, filePath);
}

function saveCatalog(catalog) {
  writeJsonAtomic(CATALOG_PATH, catalog);
}

function buildPublicProduct(product, detail) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    scraped: true,
    title: detail.title || product.name,
    priceCny: detail.priceCny,
    priceUsd: detail.priceUsd,
    images: detail.images,
    options: detail.options,
  };
}

async function main() {
  mkdirSync(PRODUCTS_DIR, { recursive: true });

  const catalog = loadCatalog();
  syncCatalogFromFiles(catalog);
  let products = catalog.products.filter((p) => p.kakobuyUrl);

  if (brandFilter) products = products.filter((p) => p.brandSlug === brandFilter);
  if (idFilter) products = products.filter((p) => p.id === idFilter);
  if (limit) products = products.slice(0, limit);

  const pending = products.filter((p) => {
    const outPath = join(PRODUCTS_DIR, `${p.id}.json`);
    return force || !existsSync(outPath);
  });

  console.log(`Productos a scrapear: ${pending.length} / ${products.length}`);

  if (!pending.length) {
    console.log('Nada pendiente. Usa --force para volver a scrapear.');
    const { syncFromLocalFiles } = await import('./lib/supabase-sync.js');
    const stats = await syncFromLocalFiles();
    console.log(`Supabase sincronizado: ${stats.products} productos`);
    return;
  }

  const supabase = getSupabase();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < pending.length; i++) {
    const product = pending[i];
    const outPath = join(PRODUCTS_DIR, `${product.id}.json`);
    const progress = `[${i + 1}/${pending.length}]`;

    try {
      console.log(`${progress} Scrapeando ${product.id} (${product.name})...`);
      const detail = await scrapeKakobuyPage(page, product.kakobuyUrl);

      const payload = {
        id: product.id,
        brand: product.brand,
        brandSlug: product.brandSlug,
        catalogName: product.name,
        catalogPrice: product.price,
        itemId: product.itemId,
        scrapedAt: new Date().toISOString(),
        ...detail,
      };

      writeJsonAtomic(outPath, payload);

      const catalogProduct = catalog.products.find((p) => p.id === product.id);
      if (catalogProduct) {
        catalogProduct.scraped = true;
        catalogProduct.scrapedAt = payload.scrapedAt;
        catalogProduct.detailFile = `products/${product.id}.json`;
      }

      await upsertScrapedProduct(supabase, { ...product, ...catalogProduct }, payload);

      ok++;
      console.log(`${progress} OK - ${detail.images.length} imgs, ${detail.options.length} grupos de variantes`);
    } catch (err) {
      fail++;
      const errorPayload = {
        id: product.id,
        scrapedAt: new Date().toISOString(),
        error: err.message,
      };
      writeFileSync(outPath.replace('.json', '.error.json'), JSON.stringify(errorPayload, null, 2), 'utf8');
      console.error(`${progress} ERROR ${product.id}: ${err.message}`);
    }

    if (i < pending.length - 1) await sleep(delayMs);

    if ((i + 1) % 10 === 0 || i === pending.length - 1) {
      saveCatalog(catalog);
    }
  }

  saveCatalog(catalog);

  await browser.close();

  const publicCatalog = {
    generatedAt: catalog.generatedAt,
    scrapedAt: new Date().toISOString(),
    stats: {
      ...catalog.stats,
      scrapedProducts: catalog.products.filter((p) => p.scraped).length,
    },
    brands: catalog.brands.map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      products: brand.products.map((product) => {
        const full = catalog.products.find((p) => p.id === product.id);
        if (!full?.scraped) {
          return { id: product.id, name: product.name, price: product.price, scraped: false };
        }
        const detail = JSON.parse(readFileSync(join(DATA_DIR, full.detailFile), 'utf8'));
        return buildPublicProduct(product, detail);
      }),
    })),
  };

  writeFileSync(join(DATA_DIR, 'catalog-public.json'), JSON.stringify(publicCatalog, null, 2), 'utf8');

  await touchScrapedAt(supabase);
  const { syncFromLocalFiles } = await import('./lib/supabase-sync.js');
  const stats = await syncFromLocalFiles();
  console.log(`Supabase actualizado: ${stats.products} productos`);

  console.log(`\nFinalizado: ${ok} ok, ${fail} errores`);
  console.log(`Detalles en data/products/ y en Supabase`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
