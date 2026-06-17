'use client';

import { useMemo, useState } from 'react';
import type { AdminBrand } from '@/lib/admin-products';
import type { ProductOption } from '@/types/catalog';
import { getSizesFromOptions, mergeSizesIntoOptions } from '@/lib/product-options';
import { normalizePriceUsd } from '@/lib/price-utils';

export interface ProductFormValues {
  brandSlug: string;
  name: string;
  title: string;
  priceUsd: string;
  itemId: string;
  extractId: string;
  kakobuyUrl: string;
  imageUrls: string[];
  sizes: string[];
  options: ProductOption[];
  isHidden: boolean;
  isFeatured: boolean;
}

interface ProductFormModalProps {
  mode: 'create' | 'edit';
  brands: AdminBrand[];
  initial: ProductFormValues;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void;
}

export default function ProductFormModal({
  mode,
  brands,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductFormValues>(initial);
  const [imageInput, setImageInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');

  const brandName = brands.find((b) => b.slug === form.brandSlug)?.name || '';
  const coverImage = form.imageUrls[0] || null;

  const previewPrice = useMemo(() => {
    const usd = form.priceUsd.trim();
    return usd ? `$${usd.replace(/^\$/, '')}` : 'Sin precio';
  }, [form.priceUsd]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addImage() {
    const url = imageInput.trim();
    if (!url) return;
    if (form.imageUrls.includes(url)) {
      setImageInput('');
      return;
    }
    update('imageUrls', [...form.imageUrls, url]);
    setImageInput('');
  }

  function removeImage(url: string) {
    update(
      'imageUrls',
      form.imageUrls.filter((img) => img !== url)
    );
  }

  function moveImage(url: string, direction: -1 | 1) {
    const index = form.imageUrls.indexOf(url);
    if (index < 0) return;
    const next = index + direction;
    if (next < 0 || next >= form.imageUrls.length) return;
    const copy = [...form.imageUrls];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    update('imageUrls', copy);
  }

  function addSize() {
    const size = sizeInput.trim().toUpperCase();
    if (!size) return;
    if (form.sizes.includes(size)) {
      setSizeInput('');
      return;
    }
    const sizes = [...form.sizes, size];
    update('sizes', sizes);
    update('options', mergeSizesIntoOptions(form.options, sizes));
    setSizeInput('');
  }

  function removeSize(size: string) {
    const sizes = form.sizes.filter((s) => s !== size);
    update('sizes', sizes);
    update('options', mergeSizesIntoOptions(form.options, sizes));
  }

  function handleSubmit() {
    const priceUsd = normalizePriceUsd(form.priceUsd) || '';
    const sizes = form.sizes.map((s) => s.trim()).filter(Boolean);
    onSubmit({
      ...form,
      priceUsd,
      sizes,
      options: mergeSizesIntoOptions(form.options, sizes),
    });
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="product-editor" onClick={(e) => e.stopPropagation()}>
        <div className="product-editor-header">
          <div>
            <p className="product-editor-eyebrow">
              {mode === 'create' ? 'Nuevo producto' : 'Editar producto'}
            </p>
            <h2>{form.name.trim() || 'Sin título'}</h2>
            <p className="product-editor-sub">{brandName || 'Seleccioná una marca'}</p>
          </div>
          <button type="button" className="product-editor-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form
          className="product-editor-body"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="product-editor-preview-col">
            <div className="product-editor-card-preview">
              <p className="product-editor-label">Vista en el catálogo</p>
              <article className="product-preview-card">
                <div className="product-preview-image">
                  {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImage} alt={form.name || 'Preview'} />
                  ) : (
                    <div className="product-preview-placeholder">Sin imagen</div>
                  )}
                </div>
                <div className="product-preview-body">
                  <span className="product-preview-brand">{brandName || 'Marca'}</span>
                  <strong>{form.name.trim() || 'Nombre del producto'}</strong>
                  <p>{form.title.trim() || 'Sin descripción adicional'}</p>
                  <div className="product-preview-price">{previewPrice} USD</div>
                </div>
              </article>
            </div>

            <div className="product-editor-gallery">
              <p className="product-editor-label">Imágenes</p>
              <div className="product-editor-cover">
                {coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverImage} alt="Portada" />
                ) : (
                  <div className="product-preview-placeholder">Agregá una URL de imagen</div>
                )}
              </div>

              {form.imageUrls.length > 1 ? (
                <div className="product-editor-thumbs">
                  {form.imageUrls.map((url) => (
                    <button
                      key={url}
                      type="button"
                      className={`product-editor-thumb${url === coverImage ? ' active' : ''}`}
                      onClick={() => {
                        const rest = form.imageUrls.filter((u) => u !== url);
                        update('imageUrls', [url, ...rest]);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="product-editor-add-image">
                <input
                  type="url"
                  placeholder="https://... pegá el link de la imagen"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                />
                <button type="button" className="admin-btn-secondary" onClick={addImage}>
                  Agregar
                </button>
              </div>

              {form.imageUrls.length > 0 ? (
                <ul className="product-editor-image-list">
                  {form.imageUrls.map((url, i) => (
                    <li key={url}>
                      <span>{i === 0 ? 'Portada' : `Imagen ${i + 1}`}</span>
                      <div className="product-editor-image-actions">
                        <button type="button" onClick={() => moveImage(url, -1)} disabled={i === 0}>
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(url, 1)}
                          disabled={i === form.imageUrls.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" className="danger" onClick={() => removeImage(url)}>
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="product-editor-fields">
            <section className="product-editor-section">
              <h3>Información</h3>
              <div className="product-editor-grid">
                <label className="product-editor-field span-2">
                  <span>Marca</span>
                  <select
                    value={form.brandSlug}
                    onChange={(e) => update('brandSlug', e.target.value)}
                    required
                    disabled={mode === 'edit'}
                  >
                    {brands.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="product-editor-field span-2">
                  <span>Nombre en el catálogo</span>
                  <input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Ej: Corteiz Tee"
                    required
                  />
                </label>
                <label className="product-editor-field span-2">
                  <span>Título / descripción</span>
                  <input
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="Ej: Camiseta de algodón premium"
                  />
                </label>
              </div>
            </section>

            <section className="product-editor-section">
              <h3>Precio</h3>
              <label className="product-editor-field product-editor-price">
                <span>Precio en dólares (USD)</span>
                <div className="product-editor-price-input">
                  <span>$</span>
                  <input
                    inputMode="decimal"
                    value={form.priceUsd}
                    onChange={(e) => update('priceUsd', e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="29.99"
                  />
                  <em>USD</em>
                </div>
              </label>
            </section>

            <section className="product-editor-section">
              <h3>Talles</h3>
              <p className="product-editor-hint">Agregá o quitá talles disponibles para este producto.</p>
              {form.sizes.length ? (
                <div className="product-editor-sizes">
                  {form.sizes.map((size) => (
                    <span key={size} className="product-editor-size-chip">
                      {size}
                      <button type="button" aria-label={`Quitar talle ${size}`} onClick={() => removeSize(size)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="product-editor-empty-sizes">Sin talles cargados.</p>
              )}
              <div className="product-editor-add-size">
                <input
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  placeholder="Ej: M, L, XL"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSize();
                    }
                  }}
                />
                <button type="button" className="admin-btn-secondary" onClick={addSize}>
                  Agregar talle
                </button>
              </div>
            </section>

            <section className="product-editor-section">
              <h3>Weidian / Kakobuy</h3>
              <div className="product-editor-grid">
                <label className="product-editor-field">
                  <span>Item ID</span>
                  <input
                    value={form.itemId}
                    onChange={(e) => update('itemId', e.target.value)}
                    placeholder="7658403450"
                    required
                    disabled={mode === 'edit'}
                  />
                </label>
                <label className="product-editor-field">
                  <span>Extract ID (opcional)</span>
                  <input
                    value={form.extractId}
                    onChange={(e) => update('extractId', e.target.value)}
                    placeholder="7573658397"
                  />
                </label>
                <label className="product-editor-field span-2">
                  <span>Link Kakobuy (opcional)</span>
                  <input
                    type="url"
                    value={form.kakobuyUrl}
                    onChange={(e) => update('kakobuyUrl', e.target.value)}
                    placeholder="Se genera automático si lo dejás vacío"
                  />
                </label>
              </div>
            </section>

            <section className="product-editor-section">
              <label className="product-editor-toggle">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => update('isFeatured', e.target.checked)}
                />
                <span>
                  <strong>✨ Producto destacado</strong>
                  <small>Se muestra en la sección de destacados al inicio del catálogo.</small>
                </span>
              </label>
            </section>

            <section className="product-editor-section">
              <label className="product-editor-toggle">
                <input
                  type="checkbox"
                  checked={form.isHidden}
                  onChange={(e) => update('isHidden', e.target.checked)}
                />
                <span>
                  <strong>Ocultar del catálogo público</strong>
                  <small>El producto no se verá en la tienda, pero queda guardado acá.</small>
                </span>
              </label>
            </section>

            {error ? <p className="login-error">{error}</p> : null}

            <div className="product-editor-footer">
              <button type="button" className="admin-btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Guardando...' : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function emptyProductForm(brands: AdminBrand[]): ProductFormValues {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  return {
    brandSlug: brands[0]?.slug || '',
    name: '',
    title: '',
    priceUsd: '',
    itemId: '',
    extractId: '',
    kakobuyUrl: '',
    imageUrls: [],
    sizes,
    options: mergeSizesIntoOptions([], sizes),
    isHidden: false,
    isFeatured: false,
  };
}

export function productToForm(
  product: import('@/lib/admin-products').AdminProduct
): ProductFormValues {
  const sizes = getSizesFromOptions(product.options);
  return {
    brandSlug: product.brandSlug,
    name: product.displayName,
    title: product.displayTitle || '',
    priceUsd: product.priceUsd || '',
    itemId: product.itemId,
    extractId: product.extractId || '',
    kakobuyUrl: product.kakobuyUrl || '',
    imageUrls: product.images || [],
    sizes,
    options: product.options || [],
    isHidden: product.isHidden,
    isFeatured: product.isFeatured,
  };
}
