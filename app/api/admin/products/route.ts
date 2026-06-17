import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminRequest } from '@/lib/admin-auth';
import {
  buildKakobuyUrl,
  buildProductId,
  buildWeidianUrl,
  getAdminProducts,
  getAffcode,
} from '@/lib/admin-products';
import { normalizePriceUsd } from '@/lib/price-utils';
import { createServiceClient } from '@/lib/supabase/server';

function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const data = await getAdminProducts();
    const brands = await import('@/lib/admin-products').then((m) => m.getAdminBrands());
    return NextResponse.json({ ...data, brands });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = await request.json();
  const { brandSlug, name, itemId, extractId, weidianUrl, kakobuyUrl, title, priceUsd, images, options, isHidden, isFeatured } =
    body;

  if (!brandSlug || !name || !itemId) {
    return NextResponse.json({ error: 'Marca, nombre e item ID son obligatorios' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, slug')
    .eq('slug', brandSlug)
    .maybeSingle();

  if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
  if (!brand) return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });

  const id = buildProductId(brandSlug, String(itemId).trim());
  const affcode = await getAffcode();
  const item_id = String(itemId).trim();

  const row = {
    id,
    brand_id: brand.id,
    name: String(name).trim(),
    catalog_price: null,
    extract_id: extractId ? String(extractId).trim() : null,
    item_id,
    weidian_url: weidianUrl?.trim() || buildWeidianUrl(item_id),
    kakobuy_url: kakobuyUrl?.trim() || buildKakobuyUrl(item_id, affcode),
    title: title ? String(title).trim() : null,
    price_usd: normalizePriceUsd(priceUsd),
    price_cny: null,
    is_scraped: false,
    is_hidden: Boolean(isHidden),
    is_featured: Boolean(isFeatured),
    images: Array.isArray(images) ? images : [],
    options: Array.isArray(options) ? options : [],
    variants: [],
    admin_overrides: {},
  };

  const { error } = await supabase.from('products').insert(row);
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un producto con ese ID' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const data = await getAdminProducts();
  revalidatePath('/');
  revalidatePath('/admin');
  return NextResponse.json({ ok: true, product: row, ...data });
}
