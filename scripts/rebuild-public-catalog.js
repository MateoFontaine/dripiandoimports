import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const catalog = JSON.parse(readFileSync(join(DATA, 'catalog.json'), 'utf8'));

function buildPublicProduct(product, detail) {
  const full = catalog.products.find((p) => p.id === product.id);
  return {
    id: product.id,
    name: full?.name || product.name,
    price: full?.price || product.price,
    scraped: true,
    title: detail.title || product.name,
    priceCny: detail.priceCny,
    priceUsd: detail.priceUsd,
    images: detail.images,
    options: detail.options,
  };
}

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
        return {
          id: product.id,
          name: full?.name || product.name,
          price: full?.price || product.price,
          scraped: false,
        };
      }
      const detail = JSON.parse(readFileSync(join(DATA, full.detailFile), 'utf8'));
      return buildPublicProduct(product, detail);
    }),
  })),
};

writeFileSync(join(DATA, 'catalog-public.json'), JSON.stringify(publicCatalog, null, 2));
console.log('catalog-public.json regenerado');

const { syncFromLocalFiles } = await import('./lib/supabase-sync.js');
const stats = await syncFromLocalFiles();
console.log(`Supabase sincronizado: ${stats.products} productos`);
