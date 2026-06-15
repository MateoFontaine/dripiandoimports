export function normalizePriceUsd(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(',', '.');
  return normalized || null;
}

export function formatPriceUsd(value: string | null | undefined) {
  const usd = normalizePriceUsd(value);
  return usd ? `$${usd}` : '';
}

export function resolvePriceUsd(
  priceUsd: string | null | undefined,
  overrides?: Record<string, string> | null
) {
  const overrideUsd = normalizePriceUsd(overrides?.priceUsd);
  if (overrideUsd) return overrideUsd;
  return normalizePriceUsd(priceUsd);
}
