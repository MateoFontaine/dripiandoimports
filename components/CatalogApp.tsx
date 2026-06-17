'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Product } from '@/types/catalog';
import {
  flattenProducts,
  formatPrice,
  getCoverImage,
  getProductType,
  normalizeLabel,
} from '@/lib/product-utils';
import { formatPriceUsd } from '@/lib/price-utils';
import {
  addToCart,
  clearCart,
  getCartCount,
  getWhatsAppUrl,
  loadCart,
  removeFromCart,
  updateQuantity,
  formatOptions,
  type CartItem,
} from '@/lib/cart';

interface CatalogAppProps {
  initialCatalog: Catalog;
}

export default function CatalogApp({ initialCatalog }: CatalogAppProps) {
  const catalog = initialCatalog;
  const [brand, setBrand] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addedToCart, setAddedToCart] = useState(false);

  const productModalRef = useRef<HTMLDialogElement>(null);
  const cartModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setCartItems(loadCart());
  }, []);

  const allProducts = useMemo(() => flattenProducts(catalog), [catalog]);

  const featuredProducts = useMemo(
    () => allProducts.filter((p) => p.featured && getCoverImage(p)),
    [allProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (brand !== 'all' && p.brandSlug !== brand) return false;
      if (type !== 'all' && p.productType !== type) return false;
      if (!q) return true;
      const haystack = [p.name, p.title, p.brandName, p.productType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allProducts, brand, type, search]);

  const typeOptions = useMemo(() => {
    const products =
      brand === 'all'
        ? allProducts
        : catalog.brands.find((b) => b.slug === brand)?.products.map((p) => ({
            ...p,
            productType: getProductType(p.name),
          })) || [];
    return [...new Set(products.map((p) => getProductType(p.name)))].sort();
  }, [allProducts, brand, catalog.brands]);

  useEffect(() => {
    if (type !== 'all' && !typeOptions.includes(type)) setType('all');
  }, [type, typeOptions]);

  const openProduct = useCallback(
    (id: string) => {
      const product = allProducts.find((p) => p.id === id);
      if (!product) return;

      const options: Record<string, string> = {};
      let image = getCoverImage(product);

      if (product.options?.length) {
        for (const group of product.options) {
          const label = normalizeLabel(group.label);
          if (group.values?.length) options[label] = group.values[0].name;
        }
        const styleGroup = product.options.find((o) =>
          /estilo|style|color/i.test(normalizeLabel(o.label))
        );
        if (styleGroup) {
          const label = normalizeLabel(styleGroup.label);
          const selectedStyle = styleGroup.values?.find((v) => v.name === options[label]);
          if (selectedStyle?.image) image = selectedStyle.image;
        }
      }

      setSelectedProduct(product);
      setSelectedOptions(options);
      setMainImage(image);
      setAddedToCart(false);
      productModalRef.current?.showModal();
      document.body.classList.add('modal-open');
      window.history.replaceState(null, '', `#${id}`);
    },
    [allProducts]
  );

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) openProduct(hash);
  }, [openProduct]);

  const closeProductModal = () => {
    productModalRef.current?.close();
    document.body.classList.remove('modal-open');
    window.history.replaceState(null, '', window.location.pathname);
    setSelectedProduct(null);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const missing = (selectedProduct.options || []).find((group) => {
      const label = normalizeLabel(group.label);
      return group.values?.length && !selectedOptions[label];
    });
    if (missing) {
      alert(`Seleccioná ${normalizeLabel(missing.label)} antes de agregar al carrito.`);
      return;
    }
    setCartItems(addToCart(selectedProduct, selectedOptions, 1, mainImage));
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1500);
  };

  const cartCount = getCartCount(cartItems);

  const thumbImages = selectedProduct
    ? [...new Set(selectedProduct.images || [])].length
      ? [...new Set(selectedProduct.images || [])]
      : mainImage
        ? [mainImage]
        : []
    : [];

  const selectionText = Object.entries(selectedOptions)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

  return (
    <>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-zinc-100/92 backdrop-blur-md border-b border-zinc-200">
        <a
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-500 text-white text-sm font-semibold no-underline transition-colors hover:bg-green-600 active:bg-green-700"
          href="https://chat.whatsapp.com/GdL1yJ1NUJy725qb22Irt3"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
          <span>Unirse al grupo de WhatsApp</span>
        </a>

        {/* Mobile: 2 rows (brand+cart / search). Desktop: single row (brand | search | cart) */}
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 items-center sm:flex sm:items-center sm:gap-3">
          {/* Brand — col 1 row 1 on mobile, first item on desktop */}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight leading-none">Dripeando Imports</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Seleccioná marca y producto</p>
          </div>

          {/* Cart — col 2 row 1 on mobile, pushed to end on desktop with sm:order-last */}
          <button
            className="relative flex items-center justify-center w-11 h-11 border border-zinc-200 rounded-full bg-white cursor-pointer flex-shrink-0 justify-self-end sm:order-last"
            type="button"
            title="Carrito"
            onClick={() => cartModalRef.current?.showModal()}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-green-600 text-white text-[0.65rem] font-bold leading-[1.1rem] text-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Search — col-span-2 row 2 on mobile, flex-1 (middle) on desktop */}
          <div className="col-span-2 relative sm:col-auto sm:flex-1 sm:max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2.5 text-base border border-zinc-200 rounded-full bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 [appearance:none]"
              type="search"
              placeholder="Buscar..."
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 pb-10">

        {/* Productos Destacados */}
        {featuredProducts.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold tracking-tight uppercase text-zinc-500 flex items-center gap-1.5">
                <span className="text-base">✨</span> Destacados
              </h2>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide sm:grid sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
              {featuredProducts.map((p) => {
                const img = getCoverImage(p);
                const price = formatPrice(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="flex-shrink-0 w-36 sm:w-auto text-left bg-white border border-zinc-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
                  >
                    <div className="aspect-square bg-zinc-100 overflow-hidden">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">Sin imagen</div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-zinc-400 truncate">{p.brandName}</div>
                      <div className="text-xs font-semibold leading-tight mt-0.5 line-clamp-2">{p.name}</div>
                      {price && <div className="text-sm font-bold mt-1 text-zinc-900">{price}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Filtros */}
        <section className="mb-5">
          <div className="mb-3">
            <span className="block text-[0.68rem] font-bold uppercase tracking-widest text-zinc-400 mb-2">Marca</span>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setBrand('all')}
                className={`flex-shrink-0 px-4 py-2 min-h-[44px] rounded-full border text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${brand === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'}`}
              >
                Todas
              </button>
              {catalog.brands.map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => setBrand(b.slug)}
                  className={`flex-shrink-0 px-4 py-2 min-h-[44px] rounded-full border text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${brand === b.slug ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <span className="block text-[0.68rem] font-bold uppercase tracking-widest text-zinc-400 mb-2">Tipo</span>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setType('all')}
                className={`flex-shrink-0 px-4 py-2 min-h-[44px] rounded-full border text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${type === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'}`}
              >
                Todos
              </button>
              {typeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-shrink-0 px-4 py-2 min-h-[44px] rounded-full border text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${type === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-zinc-400">
            {filteredProducts.length} producto{filteredProducts.length === 1 ? '' : 's'}
          </p>
        </section>

        {/* Grilla de productos */}
        {filteredProducts.length === 0 ? (
          <p className="text-center text-zinc-400 py-14 text-sm">No hay productos con esos filtros.</p>
        ) : (
          <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredProducts.map((p) => {
              const img = getCoverImage(p);
              const price = formatPrice(p);
              return (
                <article key={p.id}>
                  <button
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="w-full text-left bg-white border border-zinc-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md group"
                  >
                    <div className="aspect-square bg-zinc-100 overflow-hidden">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">Sin imagen</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-400 truncate">{p.brandName}</div>
                      <div className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2 break-words">{p.name}</div>
                      {price && <div className="text-sm font-bold mt-1 text-zinc-900">{price}</div>}
                    </div>
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* ── Modal de producto ── */}
      <dialog
        className="modal"
        ref={productModalRef}
        onClick={(e) => {
          if (e.target === productModalRef.current) closeProductModal();
        }}
        onCancel={(e) => {
          e.preventDefault();
          closeProductModal();
        }}
      >
        <div className="modal-panel">
          <div className="modal-body">
            <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeProductModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="modal-scroll">
            {selectedProduct ? (
              <div className="detail">
                <div className="detail-gallery">
                  <div className="detail-main-image">
                    {mainImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImage} alt={selectedProduct.name} />
                    ) : (
                      <div className="placeholder">Sin imagen</div>
                    )}
                  </div>
                  {thumbImages.length > 1 && (
                    <div className="detail-thumbs">
                      {thumbImages.map((src, i) => (
                        <button
                          key={src}
                          className={`thumb${src === mainImage ? ' active' : ''}`}
                          type="button"
                          onClick={() => setMainImage(src)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Vista ${i + 1}`} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="detail-info">
                  <div className="detail-brand">{selectedProduct.brandName}</div>
                  <h2 className="detail-title">{selectedProduct.title || selectedProduct.name}</h2>

                  {selectedProduct.priceUsd && (
                    <div className="detail-prices">
                      <div className="price-tag">
                        {formatPriceUsd(selectedProduct.priceUsd)} <span>USD</span>
                      </div>
                    </div>
                  )}

                  <div className="options-scroll">
                    {(selectedProduct.options || []).length > 0 ? (
                      (selectedProduct.options || []).map((group) => {
                        const label = normalizeLabel(group.label);
                        const selected = selectedOptions[label];
                        const hasImages = group.values.some((v) => v.image);
                        return (
                          <div key={label} className="option-group">
                            <div className="option-label">
                              {label}{' '}
                              <span className="option-count">({group.values.length})</span>
                            </div>
                            <div className={hasImages ? 'option-list option-list--images' : 'option-list'}>
                              {group.values.map((v) => {
                                const active = selected === v.name;
                                if (v.image) {
                                  return (
                                    <button
                                      key={v.name}
                                      type="button"
                                      className={`option-btn has-image${active ? ' active' : ''}`}
                                      onClick={() => {
                                        setSelectedOptions((prev) => ({ ...prev, [label]: v.name }));
                                        setMainImage(v.image);
                                      }}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={v.image} alt={v.name} loading="lazy" />
                                      <span>{v.name}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    key={v.name}
                                    type="button"
                                    className={`option-btn${active ? ' active' : ''}`}
                                    onClick={() =>
                                      setSelectedOptions((prev) => ({ ...prev, [label]: v.name }))
                                    }
                                  >
                                    {v.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="unavailable-badge">Variantes no disponibles.</p>
                    )}
                  </div>

                  {selectionText && (
                    <div className="selection-summary">
                      <strong>Tu selección:</strong> {selectionText}
                    </div>
                  )}

                  <button
                    type="button"
                    className={`btn-add-cart${addedToCart ? ' added' : ''}`}
                    onClick={handleAddToCart}
                  >
                    {addedToCart ? '✓ Agregado' : 'Agregar al carrito'}
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </dialog>

      {/* ── Modal del carrito ── */}
      <dialog
        className="modal modal-sm"
        ref={cartModalRef}
        onClick={(e) => {
          if (e.target === cartModalRef.current) cartModalRef.current?.close();
        }}
      >
        <div className="modal-panel modal-panel--cart">
          <div className="modal-body cart-panel">
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar"
              onClick={() => cartModalRef.current?.close()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <h2 className="cart-title">Tu carrito</h2>

            {cartItems.length === 0 ? (
              <p className="cart-empty">Tu carrito está vacío.</p>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((item) => {
                    const opts = formatOptions(item.options);
                    const price = item.priceUsd ? formatPriceUsd(item.priceUsd) : item.price || '';
                    return (
                      <article key={item.cartId} className="cart-item">
                        <div className="cart-item-image">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} loading="lazy" />
                          ) : (
                            <div className="placeholder">—</div>
                          )}
                        </div>
                        <div className="cart-item-info">
                          <div className="cart-item-brand">{item.brandName}</div>
                          <div className="cart-item-name">{item.name}</div>
                          {opts && <div className="cart-item-options">{opts}</div>}
                          {price && <div className="cart-item-price">{price}</div>}
                          <div className="cart-item-actions">
                            <div className="qty-control">
                              <button
                                type="button"
                                className="qty-btn"
                                aria-label="Menos"
                                onClick={() =>
                                  setCartItems(updateQuantity(item.cartId, item.quantity - 1))
                                }
                              >
                                −
                              </button>
                              <span className="qty-value">{item.quantity}</span>
                              <button
                                type="button"
                                className="qty-btn"
                                aria-label="Más"
                                onClick={() =>
                                  setCartItems(updateQuantity(item.cartId, item.quantity + 1))
                                }
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              className="cart-item-remove"
                              onClick={() => setCartItems(removeFromCart(item.cartId))}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="cart-footer">
                  <p className="cart-summary">
                    {cartCount} artículo{cartCount === 1 ? '' : 's'} en el carrito
                  </p>
                  <a
                    className="btn-whatsapp"
                    href={getWhatsAppUrl(cartItems)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Enviar pedido por WhatsApp
                  </a>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (!cartItems.length) return;
                      if (!confirm('¿Vaciar el carrito?')) return;
                      setCartItems(clearCart());
                    }}
                  >
                    Vaciar carrito
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </dialog>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-zinc-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-7 text-center">
          <p className="text-[0.68rem] font-bold uppercase tracking-widest text-zinc-700 mb-2">Aviso legal</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            Las imágenes publicadas en este catálogo tienen carácter exclusivamente ilustrativo y han
            sido obtenidas de fuentes disponibles en internet. No constituyen una representación exacta
            del producto físico entregado. Los artículos comercializados son productos originales.
          </p>
        </div>
      </footer>
    </>
  );
}
