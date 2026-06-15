import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getAdminProducts } from '@/lib/admin-products';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorized();

  const { id } = await context.params;
  const body = await request.json();
  const supabase = createServiceClient();

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const directFields: Record<string, unknown> = {};
  const overrideFields: Record<string, string> = { ...(product.admin_overrides || {}) };

  const directMap: Record<string, string> = {
    name: 'name',
    title: 'title',
    priceUsd: 'price_usd',
    itemId: 'item_id',
    extractId: 'extract_id',
    weidianUrl: 'weidian_url',
    kakobuyUrl: 'kakobuy_url',
    isHidden: 'is_hidden',
    isScraped: 'is_scraped',
    images: 'images',
  };

  const overrideMap: Record<string, string> = {
    displayName: 'name',
    displayTitle: 'title',
    displayPriceUsd: 'priceUsd',
  };

  for (const [key, column] of Object.entries(directMap)) {
    if (body[key] !== undefined) directFields[column] = body[key];
  }

  for (const [key, overrideKey] of Object.entries(overrideMap)) {
    if (body[key] !== undefined) {
      if (body[key] === '' || body[key] === null) delete overrideFields[overrideKey];
      else overrideFields[overrideKey] = String(body[key]);
    }
  }

  if (body.useDirectEdit) {
    for (const field of ['name', 'title', 'priceUsd']) {
      delete overrideFields[field];
    }
  }

  const update = {
    ...directFields,
    admin_overrides: overrideFields,
  };

  const { error } = await supabase.from('products').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = await getAdminProducts();
  return NextResponse.json({ ok: true, ...data });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorized();

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';
  const supabase = createServiceClient();

  const { error } = permanent
    ? await supabase.from('products').delete().eq('id', id)
    : await supabase.from('products').update({ is_hidden: true }).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = await getAdminProducts();
  return NextResponse.json({ ok: true, ...data });
}
