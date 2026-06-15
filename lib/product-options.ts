import type { ProductOption } from '@/types/catalog';
import { normalizeLabel } from '@/lib/product-utils';
import { normalizePriceUsd } from '@/lib/price-utils';

const SIZE_LABEL = 'Tamaño';
const SIZE_GROUP_RE = /tamaño|tamano|size|talle/i;

export function isSizeOptionGroup(label: string) {
  return SIZE_GROUP_RE.test(normalizeLabel(label));
}

export function getSizesFromOptions(options?: ProductOption[]) {
  const group = options?.find((o) => isSizeOptionGroup(o.label));
  return group?.values.map((v) => v.name).filter(Boolean) || [];
}

export function mergeSizesIntoOptions(existing: ProductOption[] | undefined, sizes: string[]) {
  const others = (existing || []).filter((o) => !isSizeOptionGroup(o.label));
  const trimmed = [...new Set(sizes.map((s) => s.trim()).filter(Boolean))];
  if (!trimmed.length) return others;
  return [
    ...others,
    {
      label: SIZE_LABEL,
      values: trimmed.map((name) => ({ name, image: null })),
    },
  ];
}