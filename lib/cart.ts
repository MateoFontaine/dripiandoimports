import type { Product } from '@/types/catalog';
import { formatPriceUsd, normalizePriceUsd } from '@/lib/price-utils';

const CART_KEY = 'dripeando-cart';
export const WHATSAPP_NUMBER = '18132911362';
export const SITE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
  'https://dripeandoimports.vercel.app';

export interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  brandName: string;
  price: string;
  priceUsd: string;
  options: Record<string, string>;
  quantity: number;
  image: string | null;
}

function makeCartId(productId: string, options: Record<string, string>) {
  const opts = Object.entries(options || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
  return `${productId}__${opts}`;
}

export function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(
  product: Product,
  options: Record<string, string> = {},
  quantity = 1,
  image: string | null = null
) {
  const items = loadCart();
  const cartId = makeCartId(product.id, options);
  const existing = items.find((item) => item.cartId === cartId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({
      cartId,
      productId: product.id,
      name: product.name,
      brandName: product.brandName || '',
      price: product.price || '',
      priceUsd: normalizePriceUsd(product.priceUsd) || '',
      options: { ...options },
      quantity,
      image: image || product.images?.[0] || null,
    });
  }

  saveCart(items);
  return items;
}

export function removeFromCart(cartId: string) {
  const items = loadCart().filter((item) => item.cartId !== cartId);
  saveCart(items);
  return items;
}

export function updateQuantity(cartId: string, quantity: number) {
  const items = loadCart();
  const item = items.find((i) => i.cartId === cartId);
  if (!item) return items;
  if (quantity < 1) return removeFromCart(cartId);
  item.quantity = quantity;
  saveCart(items);
  return items;
}

export function clearCart() {
  saveCart([]);
  return [];
}

export function getCartCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatItemPrice(item: CartItem) {
  const formatted = formatPriceUsd(item.priceUsd);
  if (formatted) return `${formatted} USD`;
  if (item.price) return item.price;
  return 'Consultar';
}

function friendlyOptionLabel(key: string) {
  const normalized = key.toLowerCase();
  if (/estilo|style|color/.test(normalized)) return 'Color';
  if (/tamaño|tamano|size|talle/.test(normalized)) return 'Talle';
  return key;
}

function formatOptions(options: Record<string, string>) {
  return Object.entries(options || {})
    .map(([k, v]) => `${friendlyOptionLabel(k)}: ${v}`)
    .join(' · ');
}

function getProductUrl(productId: string) {
  const base = SITE_URL.replace(/\/$/, '');
  return `${base}/#${productId}`;
}

export function buildWhatsAppMessage(items: CartItem[]) {
  const lines = ['Hola, quiero hacer el siguiente pedido:', ''];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. *${item.brandName} — ${item.name}*`);
    for (const [key, value] of Object.entries(item.options || {})) {
      lines.push(`   ${friendlyOptionLabel(key)}: ${value}`);
    }
    lines.push(`   Precio: ${formatItemPrice(item)}`);
    lines.push(`   Cantidad: ${item.quantity}`);
    lines.push(`   Link: ${getProductUrl(item.productId)}`);
    lines.push('');
  });

  lines.push(`Total de artículos: ${getCartCount(items)}`);
  lines.push('');
  lines.push('¡Gracias!');

  return lines.join('\n');
}

export function getWhatsAppUrl(items: CartItem[]) {
  const text = encodeURIComponent(buildWhatsAppMessage(items));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

export { formatOptions };
