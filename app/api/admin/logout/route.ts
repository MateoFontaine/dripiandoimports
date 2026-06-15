import { NextResponse } from 'next/server';
import { adminCookieOptions } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_token', '', { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
