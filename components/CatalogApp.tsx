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
      alert(`Seleccion├í ${normalizeLabel(missing.label)} antes de agregar al carrito.`);
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
    .join(' ┬À ');

  return (
    <>
      <header className="header">
        <a
          className="header-wsp-link"
          href="https://chat.whatsapp.com/GdL1yJ1NUJy725qb22Irt3"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
          <span>Unirse al grupo de WhatsApp</span>
        </a>
        <div className="header-inner">
          <div className="brand-lockup">
            <h1>Dripeando Imports</h1>
            <p className="subtitle">Seleccion├í marca y producto</p>
          </div>
          <div className="header-actions">
            <div className="search-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                id="search"
                className="search-input"
                type="search"
                placeholder="Buscar..."
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="cart-toggle"
              type="button"
              title="Carrito"
              onClick={() => cartModalRef.current?.showModal()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span className={`cart-badge${cartCount === 0 ? ' hidden' : ''}`}>{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="filters">
          <div className="filter-group">
            <span className="filter-label">Marca</span>
            <div className="chips chips-scroll">
              <button
                className={`chip${brand === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setBrand('all')}
              >
                Todas
              </button>
              {catalog.brands.map((b) => (
                <button
                  key={b.slug}
                  className={`chip${brand === b.slug ? ' active' : ''}`}
                  type="button"
                  onClick={() => setBrand(b.slug)}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label">Tipo</span>
            <div className="chips chips-scroll">
              <button
                className={`chip${type === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setType('all')}
              >
                Todos
              </button>
              {typeOptions.map((t) => (
                <button
                  key={t}
                  className={`chip${type === t ? ' active' : ''}`}
                  type="button"
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="results-count">
            {filteredProducts.length} producto{filteredProducts.length === 1 ? '' : 's'}
          </p>
        </section>

        {filteredProducts.length === 0 ? (
          <p className="empty-state">No hay productos con esos filtros.</p>
        ) : (
          <section className="grid">
            {filteredProducts.map((p) => {
              const img = getCoverImage(p);
              const price = formatPrice(p);
              return (
                <article key={p.id} className="card-wrap">
                  <button className="card" type="button" onClick={() => openProduct(p.id)}>
                    <div className="card-image">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} loading="lazy" decoding="async" />
                      ) : (
                        <div className="placeholder">Sin imagen</div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-brand">{p.brandName}</div>
                      <div className="card-title">{p.name}</div>
                      <div className="card-price">{price}</div>
                    </div>
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>

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
                  {thumbImages.length > 1 ? (
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
                  ) : null}
                </div>
                <div className="detail-info">
                  <div className="detail-brand">{selectedProduct.brandName}</div>
                  <h2 className="detail-title">{selectedProduct.title || selectedProduct.name}</h2>
                  <div className="detail-prices">
                    {selectedProduct.priceUsd ? (
                      <div className="price-tag">
                        {formatPriceUsd(selectedProduct.priceUsd)} <span>USD</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="options-scroll">
                    {(selectedProduct.options || []).length ? (
                      (selectedProduct.options || []).map((group) => {
                        const label = normalizeLabel(group.label);
                        const selected = selectedOptions[label];
                        const hasImages = group.values.some((v) => v.image);
                        const listClass = hasImages ? 'option-list option-list--images' : 'option-list';
                        return (
                          <div key={label} className="option-group">
                            <div className="option-label">
                              {label} <span className="option-count">({group.values.length})</span>
                            </div>
                            <div className={listClass}>
                              {group.values.map((v) => {
                                const active = selected === v.name;
                                if (v.image) {
                                  return (
                                    <button
                                      key={v.name}
                                      className={`option-btn has-image${active ? ' active' : ''}`}
                                      type="button"
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
                                    className={`option-btn${active ? ' active' : ''}`}
                                    type="button"
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
                  {selectionText ? (
                    <div className="selection-summary">
                      <strong>Tu selecci├│n:</strong> {selectionText}
                    </div>
                  ) : null}
                  <button
                    className={`btn-add-cart${addedToCart ? ' added' : ''}`}
                    type="button"
                    onClick={handleAddToCart}
                  >
                    {addedToCart ? 'Ô£ô Agregado' : 'Agregar al carrito'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </dialog>

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
              className="modal-close"
              type="button"
              aria-label="Cerrar"
              onClick={() => cartModalRef.current?.close()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <h2 className="cart-title">Tu carrito</h2>
            {cartItems.length === 0 ? (
              <p className="cart-empty">Tu carrito est├í vac├¡o.</p>
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
                            <div className="placeholder">ÔÇö</div>
                          )}
                        </div>
                        <div className="cart-item-info">
                          <div className="cart-item-brand">{item.brandName}</div>
                          <div className="cart-item-name">{item.name}</div>
                          {opts ? <div className="cart-item-options">{opts}</div> : null}
                          {price ? <div className="cart-item-price">{price}</div> : null}
                          <div className="cart-item-actions">
                            <div className="qty-control">
                              <button
                                type="button"
                                className="qty-btn"
                                aria-label="Menos"
                                onClick={() => setCartItems(updateQuantity(item.cartId, item.quantity - 1))}
                              >
                                ÔêÆ
                              </button>
                              <span className="qty-value">{item.quantity}</span>
                              <button
                                type="button"
                                className="qty-btn"
                                aria-label="M├ís"
                                onClick={() => setCartItems(updateQuantity(item.cartId, item.quantity + 1))}
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
                    {cartCount} art├¡culo{cartCount === 1 ? '' : 's'} en el carrito
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
                      if (!confirm('┬┐Vaciar el carrito?')) return;
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-title">Aviso legal</p>
          <p className="site-footer-text">
            Las im├ígenes publicadas en este cat├ílogo tienen car├ícter exclusivamente ilustrativo y han sido
            obtenidas de fuentes disponibles en internet. No constituyen una representaci├│n exacta del
            producto f├¡sico entregado. Los art├¡culos comercializados son productos originales.
          </p>
        </div>
      </footer>
    </>
  );
}
