import { createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE = 'admin_token';

function getSecret() {
  return process.env.ADMIN_PASSWORD || 'catalogo2026';
}

export function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined) {
  if (!token) return false;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number };
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export function getAdminTokenFromRequest(request: Request) {
  const header = request.headers.get('x-admin-token');
  if (header) return header;

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function isAdminRequest(request: Request) {
  return verifyAdminToken(getAdminTokenFromRequest(request));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}
