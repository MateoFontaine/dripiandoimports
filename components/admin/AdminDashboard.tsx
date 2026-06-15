'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminBrand, AdminProduct, AdminStats } from '@/lib/admin-products';
import { normalizePriceUsd } from '@/lib/price-utils';
import ProductFormModal, {
  emptyProductForm,
  productToForm,
  type ProductFormValues,
} from '@/components/admin/ProductFormModal';

interface AdminDashboardProps {
  initialProducts: AdminProduct[];
  initialStats: AdminStats;
  brands: AdminBrand[];
}

type FormMode = 'create' | 'edit' | null;

export default function AdminDashboard({
  initialProducts,
  initialStats,
  brands,
}: AdminDashboardProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [showHidden, setShowHidden] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<ProductFormValues>(emptyProductForm(brands));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (brandFilter !== 'all' && p.brandSlug !== brandFilter) return false;
      if (!showHidden && p.isHidden) return false;
      if (!q) return true;
      const haystack = [p.displayName, p.brandName, p.itemId, p.id, p.displayTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [products, search, brandFilter, showHidden]);

  function openCreate() {
    setFormMode('create');
    setEditingId(null);
    setFormInitial(emptyProductForm(brands));
    setError('');
  }

  function openEdit(product: AdminProduct) {
    setFormMode('edit');
    setEditingId(product.id);
    setFormInitial(productToForm(product));
    setError('');
  }

  function closeForm() {
    setFormMode(null);
    setEditingId(null);
    setError('');
  }

  async function refreshData(payload: { products: AdminProduct[]; stats: AdminStats }) {
    setProducts(payload.products);
    setStats(payload.stats);
    router.refresh();
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function formToBody(form: ProductFormValues) {
    return {
      brandSlug: form.brandSlug,
      name: form.name,
      title: form.title || null,
      priceUsd: normalizePriceUsd(form.priceUsd),
      itemId: form.itemId,
      extractId: form.extractId || null,
      kakobuyUrl: form.kakobuyUrl || null,
      images: form.imageUrls,
      options: form.options,
      isHidden: form.isHidden,
      useDirectEdit: true,
    };
  }

  async function handleSubmit(form: ProductFormValues) {
    setSaving(true);
    setError('');

    try {
      const res = await fetch(
        formMode === 'create' ? '/api/admin/products' : `/api/admin/products/${editingId}`,
        {
          method: formMode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formToBody(form)),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo guardar');
        return;
      }

      await refreshData(data);
      closeForm();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden(product: AdminProduct) {
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: !product.isHidden }),
    });
    const data = await res.json();
    if (res.ok) await refreshData(data);
  }

  async function deleteProduct(product: AdminProduct) {
    const message = `¿Eliminar "${product.displayName}" permanentemente?\n\nEsta acción no se puede deshacer.`;
    if (!confirm(message)) return;

    const res = await fetch(`/api/admin/products/${product.id}?permanent=true`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo eliminar');
      return;
    }
    await refreshData(data);
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Panel admin</h1>
          <p>Gestioná productos del catálogo</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/" className="admin-btn-secondary">
            Ver catálogo
          </Link>
          <button type="button" className="admin-btn-secondary" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-stats">
          <div className="admin-stat">
            <strong>{stats.total}</strong>
            <span>Total</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.visible}</strong>
            <span>Visibles</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.hidden}</strong>
            <span>Ocultos</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.scraped}</strong>
            <span>Scrapeados</span>
          </div>
        </section>

        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">Todas las marcas</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="admin-toolbar-check">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Mostrar ocultos
          </label>
          <button type="button" className="admin-btn" onClick={openCreate}>
            + Agregar producto
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Marca</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-table-product">
                      <div className="admin-table-thumb">
                        {product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.images[0]} alt="" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <div className="admin-product-name">{product.displayName}</div>
                        <div className="admin-product-sub">ID: {product.id}</div>
                        <div className="admin-product-sub">Item: {product.itemId}</div>
                      </div>
                    </div>
                  </td>
                  <td>{product.brandName}</td>
                  <td>
                    {product.displayPriceUsd ? (
                      <div className="admin-product-name">${product.displayPriceUsd} USD</div>
                    ) : (
                      <div className="admin-product-sub">Sin precio</div>
                    )}
                  </td>
                  <td>
                    <div className="admin-badge-row">
                      <span className={`admin-badge ${product.isHidden ? 'hidden' : 'visible'}`}>
                        {product.isHidden ? 'Oculto' : 'Visible'}
                      </span>
                      {product.isScraped ? (
                        <span className="admin-badge scraped">Scrapeado</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => openEdit(product)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => toggleHidden(product)}>
                        {product.isHidden ? 'Mostrar' : 'Ocultar'}
                      </button>
                      <button type="button" className="danger" onClick={() => deleteProduct(product)}>
                        Eliminar
                      </button>
                      <a href={`/#${product.id}`} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {formMode ? (
        <ProductFormModal
          mode={formMode}
          brands={brands}
          initial={formInitial}
          saving={saving}
          error={error}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}
