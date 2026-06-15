import { NextResponse } from 'next/server';
import { createAuthServerClient } from '@/lib/supabase/auth';

export async function POST() {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
