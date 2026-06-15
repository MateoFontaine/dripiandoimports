import { NextResponse } from 'next/server';
import { isAdminUser, requireAdmin } from '@/lib/admin-auth';
import { createAuthServerClient } from '@/lib/supabase/auth';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
  }

  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(password),
  });

  if (error || !data.user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
  }

  const admin = await isAdminUser(data.user.id);
  if (!admin) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'Esta cuenta no tiene acceso de admin' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, email: user.email });
}
