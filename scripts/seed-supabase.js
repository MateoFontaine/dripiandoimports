import { syncFromLocalFiles } from './lib/supabase-sync.js';

async function main() {
  console.log('Sincronizando JSON → Supabase...');

  const stats = await syncFromLocalFiles({ useJsonOverrides: true });

  console.log(`\nListo:`);
  console.log(`  ${stats.products} productos`);
  console.log(`  ${stats.brands} marcas`);
  console.log(`  ${stats.hidden} ocultos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
