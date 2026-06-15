import { NextResponse } from 'next/server';
import { adminCookieOptions, createAdminToken, isAdminRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.ADMIN_PASSWORD || 'catalogo2026';

  if (password !== expected) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const token = createAdminToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_token', token, adminCookieOptions());
  return response;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}
