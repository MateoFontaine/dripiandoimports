import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const email = getArg('--email') || process.env.ADMIN_EMAIL;
const password = getArg('--password') || process.env.ADMIN_INITIAL_PASSWORD;
const name = getArg('--name') || 'Admin';

if (!email || !password) {
  console.error(
    'Uso: npm run create:admin -- --email admin@dripeando.com --password "tuClave" --name "Nico"'
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function missingTable(error) {
  const msg = error?.message || '';
  return msg.includes('admin_profiles') || msg.includes('schema cache');
}

async function findUserByEmail(normalizedEmail) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) return user;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingProfile } = await supabase
    .from('admin_profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    console.log(`Ya existe un admin con ${normalizedEmail}`);
    return;
  }

  let user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) throw createError;
    user = created.user;
    console.log('Usuario creado en Auth');
  } else {
    console.log('Usuario ya existía en Auth, vinculando como admin...');
  }

  const { error: profileError } = await supabase.from('admin_profiles').insert({
    id: user.id,
    email: normalizedEmail,
    name,
  });

  if (profileError) {
    if (missingTable(profileError)) {
      console.error('Falta la tabla admin_profiles. Ejecutá supabase/admin-auth.sql en Supabase primero.');
      process.exit(1);
    }
    if (profileError.code === '23505') {
      console.log(`Ya existe admin: ${normalizedEmail}`);
      return;
    }
    throw profileError;
  }

  console.log(`Admin listo: ${normalizedEmail}`);
  console.log('Entrá en /login con ese email y contraseña.');
}

main().catch((err) => {
  if (missingTable(err)) {
    console.error('Falta la tabla admin_profiles. Ejecutá supabase/admin-auth.sql en Supabase primero.');
  } else {
    console.error(err.message || err);
  }
  process.exit(1);
});
