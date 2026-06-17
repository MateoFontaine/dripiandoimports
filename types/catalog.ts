export interface OptionValue {
  name: string;
  image: string | null;
}

export interface ProductOption {
  label: string;
  values: OptionValue[];
}

export interface Product {
  id: string;
  name: string;
  price: string;
  title?: string | null;
  priceCny?: string | null;
  priceUsd?: string | null;
  extractId?: string | null;
  itemId?: string | null;
  weidianUrl?: string | null;
  kakobuyUrl?: string | null;
  scraped?: boolean;
  featured?: boolean;
  images?: string[];
  options?: ProductOption[];
  variants?: Array<{ group: string; name: string; image: string | null }>;
  brandName?: string;
  brandSlug?: string;
  productType?: string;
}

export interface Brand {
  slug: string;
  name: string;
  products: Product[];
}

export interface Catalog {
  brands: Brand[];
  generatedAt?: string | null;
  scrapedAt?: string | null;
}
