import type { Product } from '@/types/catalog';

const CART_KEY = 'dripeando-cart';
export const WHATSAPP_NUMBER = '18132911362';

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
      priceUsd: product.priceUsd || '',
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
  if (item.priceUsd) return `$${item.priceUsd} USD`;
  if (item.price) return item.price;
  return 'Consultar';
}

function formatOptions(options: Record<string, string>) {
  return Object.entries(options || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export function buildWhatsAppMessage(items: CartItem[], origin: string) {
  const lines = ['Hola, quiero hacer el siguiente pedido:', ''];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. *${item.brandName} — ${item.name}*`);
    const opts = formatOptions(item.options);
    if (opts) lines.push(`   ${opts}`);
    lines.push(`   Precio: ${formatItemPrice(item)}`);
    lines.push(`   Cantidad: ${item.quantity}`);
    if (origin) lines.push(`   Ver producto: ${origin}#${item.productId}`);
    if (item.image) lines.push(`   Imagen: ${item.image}`);
    lines.push('');
  });

  lines.push(`Total de artículos: ${getCartCount(items)}`);
  lines.push('');
  lines.push('¡Gracias!');

  return lines.join('\n');
}

export function getWhatsAppUrl(items: CartItem[], origin: string) {
  const text = encodeURIComponent(buildWhatsAppMessage(items, origin));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}
