import { readFileSync, writeFileSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'data', 'catalog.json');

const NEW_PRODUCTS = [
  {
    itemId: '7514152156',
    brand: 'Trapstar',
    brandSlug: 'trapstar',
    name: 'Trapstar Set',
    affcode: 'thejuanchy',
  },
  {
    itemId: '7734583946',
    brand: 'Supreme',
    brandSlug: 'supreme',
    name: 'Supreme Tee',
    affcode: 'thejuanchy',
  },
  {
    itemId: '7515237290',
    brand: 'Essentials',
    brandSlug: 'essentials',
    name: 'Essentials Set',
    affcode: 'thejuanchy',
  },
];

function buildKakobuyUrl(itemId, affcode) {
  const weidian = `https://weidian.com/item.html?itemID=${itemId}`;
  return `https://www.kakobuy.com/item/details?url=${encodeURIComponent(weidian)}&affcode=${affcode}`;
}

function buildProduct(entry) {
  const { itemId, brand, brandSlug, name, affcode } = entry;
  return {
    id: `${brandSlug}-${itemId}`,
    brand,
    brandSlug,
    name,
    price: '',
    itemId,
    weidianUrl: `https://weidian.com/item.html?itemID=${itemId}`,
    kakobuyUrl: buildKakobuyUrl(itemId, affcode),
    scraped: false,
  };
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, filePath);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
let added = 0;

for (const entry of NEW_PRODUCTS) {
  const product = buildProduct(entry);
  const exists = catalog.products.some((p) => p.id === product.id);
  if (exists) {
    console.log(`Ya existe: ${product.id}`);
    continue;
  }

  const brand = catalog.brands.find((b) => b.slug === entry.brandSlug);
  if (!brand) {
    console.error(`Marca no encontrada: ${entry.brandSlug}`);
    process.exit(1);
  }

  const brandProduct = { id: product.id, name: product.name, price: product.price, scraped: false };
  brand.products.push(brandProduct);
  catalog.products.push(product);

  catalog.stats.byBrand[entry.brandSlug] = (catalog.stats.byBrand[entry.brandSlug] || 0) + 1;
  catalog.stats.totalProducts += 1;
  added++;
  console.log(`Agregado: ${product.id} (${product.name})`);
}

writeJsonAtomic(CATALOG_PATH, catalog);
console.log(`\n${added} producto(s) agregados al catálogo.`);
