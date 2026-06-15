import { createAuthServerClient } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function isAdminUser(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return null;
  const admin = await isAdminUser(user.id);
  return admin ? user : null;
}

export async function isAdminRequest(_request?: Request) {
  const user = await requireAdmin();
  return Boolean(user);
}
