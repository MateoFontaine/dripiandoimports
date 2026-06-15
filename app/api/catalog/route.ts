import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo cargar el catálogo' }, { status: 500 });
  }
}
