import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');

const SHEET_ID = '1pSuRSWrSNaNhdMITduM5yp8jG1x6u03j28e4DfvoijA';
const GID = '1701484990';
const AFFCODE = 'rjts7';
const SPIDER_TOKEN = 'bd73';

const TARGET_BRANDS = [
  { slug: 'corteiz', name: 'Corteiz', patterns: [/\bcorteiz\b/i] },
  { slug: 'balenciaga', name: 'Balenciaga', patterns: [/\bbalenciaga\b/i] },
  { slug: 'sp5der', name: 'Sp5der', patterns: [/\bspider\b/i, /\bsp5der\b/i] },
  { slug: 'off-white', name: 'Off-White', patterns: [/\boff-?white\b/i] },
  { slug: 'mixed-emotions', name: 'Mixed Emotions', patterns: [/\bmixed emotions\b/i] },
  { slug: 'supreme', name: 'Supreme', patterns: [/\bsupreme\b/i] },
  { slug: 'bape', name: 'Bape', patterns: [/\bbape\b/i] },
  { slug: 'casablanca', name: 'Casablanca', patterns: [/\bcasablanca\b/i] },
  { slug: 'stussy', name: 'Stüssy', patterns: [/\bstussy\b/i] },
  { slug: 'hellstar', name: 'Hellstar', patterns: [/\bhellstar\b/i] },
  { slug: 'chrome-hearts', name: 'Chrome Hearts', patterns: [/\bchrome hearts\b/i] },
  { slug: 'trapstar', name: 'Trapstar', patterns: [/\btrapstar\b/i] },
  { slug: 'essentials', name: 'Essentials', patterns: [/\bessentials\b/i] },
];

const PRODUCT_BLOCKS = [
  { name: 0, price: 1, photo: 2, extractId: 3, itemId: 4, link: 5 },
  { name: 8, price: 9, photo: 10, extractId: 11, itemId: 12, link: 13 },
  { name: 16, price: 17, photo: 18, extractId: 19, itemId: 20, link: 21 },
];

function cellValue(cells, index) {
  const cell = cells[index];
  if (cell == null) return null;
  if (cell.f != null && cell.f !== '') return String(cell.f).trim();
  if (cell.v != null && cell.v !== '') return String(cell.v).trim();
  return null;
}

function normalizePrice(price) {
  if (!price) return null;
  const cleaned = price.replace(/\s+/g, ' ').trim();
  if (!/EUR/i.test(cleaned) && /^\d/.test(cleaned)) return `EUR ${cleaned}`;
  return cleaned;
}

function buildKakobuyUrl(itemId) {
  const weidianUrl = `https://weidian.com/item.html?itemID=${itemId}`;
  const params = new URLSearchParams({
    url: weidianUrl,
    spider_token: SPIDER_TOKEN,
    affcode: AFFCODE,
  });
  return `https://www.kakobuy.com/item/details?${params.toString()}`;
}

function detectBrand(name, sectionBrand) {
  const text = (name || '').trim();
  if (!text) return sectionBrand ?? null;

  for (const brand of TARGET_BRANDS) {
    if (brand.patterns.some((p) => p.test(text))) return brand;
  }
  return sectionBrand ?? null;
}

function isHeaderRow(cells) {
  const first = cellValue(cells, 0)?.toLowerCase();
  return first === 'item name';
}

function isSectionBrandRow(cells) {
  const values = PRODUCT_BLOCKS.map((b) => cellValue(cells, b.name)).filter(Boolean);
  if (values.length !== 1) return null;

  const label = values[0].toLowerCase().trim();
  const match = TARGET_BRANDS.find((b) => b.slug === label.replace(/\s+/g, '-') || b.name.toLowerCase() === label);
  if (match) return match;

  if (label === 'mixed emotions') return TARGET_BRANDS.find((b) => b.slug === 'mixed-emotions');
  if (label === 'supreme') return TARGET_BRANDS.find((b) => b.slug === 'supreme');
  return null;
}

function parseGvizResponse(text) {
  const jsonText = text.replace(/^\s*\/\*O_o\*\/\s*/, '').replace(/^google\.visualization\.Query\.setResponse\(/, '').replace(/\);\s*$/, '');
  return JSON.parse(jsonText);
}

async function fetchSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

function extractProducts(table) {
  const products = [];
  const seenItemIds = new Set();
  let sectionBrand = null;

  for (const row of table.rows) {
    const cells = row.c ?? [];

    if (isHeaderRow(cells)) continue;

    const brandRow = isSectionBrandRow(cells);
    if (brandRow) {
      sectionBrand = brandRow;
      continue;
    }

    for (const block of PRODUCT_BLOCKS) {
      const name = cellValue(cells, block.name);
      const price = normalizePrice(cellValue(cells, block.price));
      const extractId = cellValue(cells, block.extractId);
      const itemId = cellValue(cells, block.itemId);

      if (!name || !price) continue;
      if (!itemId || itemId === '#REF!' || itemId === 'null') continue;
      if (/^EUR/i.test(name) || /link/i.test(name)) continue;

      const brand = detectBrand(name, sectionBrand);
      if (!brand) continue;

      if (seenItemIds.has(itemId)) continue;
      seenItemIds.add(itemId);

      products.push({
        id: `${brand.slug}-${itemId}`,
        brand: brand.name,
        brandSlug: brand.slug,
        name: name.replace(/\s+/g, ' ').trim(),
        price,
        extractId: extractId || null,
        itemId,
        weidianUrl: `https://weidian.com/item.html?itemID=${itemId}`,
        kakobuyUrl: buildKakobuyUrl(itemId),
        scraped: false,
      });
    }
  }

  return products;
}

function groupByBrand(products) {
  const brandMap = new Map(TARGET_BRANDS.map((b) => [b.slug, { slug: b.slug, name: b.name, products: [] }]));

  for (const product of products) {
    brandMap.get(product.brandSlug)?.products.push(product);
  }

  return TARGET_BRANDS.map((b) => brandMap.get(b.slug)).filter((b) => b.products.length > 0);
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  console.log('Descargando spreadsheet...');
  const raw = await fetchSheet();
  writeFileSync(join(DATA_DIR, 'sheet_raw.json'), raw, 'utf8');

  const data = parseGvizResponse(raw);
  const products = extractProducts(data.table);
  const brands = groupByBrand(products);

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: {
      sheetId: SHEET_ID,
      gid: GID,
      affcode: AFFCODE,
    },
    stats: {
      totalProducts: products.length,
      totalBrands: brands.length,
      byBrand: Object.fromEntries(brands.map((b) => [b.slug, b.products.length])),
    },
    brands,
    products,
  };

  writeFileSync(join(DATA_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

  const publicCatalog = {
    generatedAt: catalog.generatedAt,
    stats: catalog.stats,
    brands: brands.map((b) => ({
      slug: b.slug,
      name: b.name,
      products: b.products.map(({ id, name, price, scraped }) => ({ id, name, price, scraped })),
    })),
  };
  writeFileSync(join(DATA_DIR, 'catalog-public.json'), JSON.stringify(publicCatalog, null, 2), 'utf8');

  console.log(`Listo: ${products.length} productos en ${brands.length} marcas`);
  for (const b of brands) {
    console.log(`  - ${b.name}: ${b.products.length}`);
  }
  console.log(`\nArchivos generados:`);
  console.log(`  data/catalog.json`);
  console.log(`  data/catalog-public.json`);

  console.log('\nSincronizando con Supabase...');
  const { syncFromLocalFiles } = await import('./lib/supabase-sync.js');
  const stats = await syncFromLocalFiles();
  console.log(`Supabase actualizado: ${stats.products} productos, ${stats.brands} marcas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
