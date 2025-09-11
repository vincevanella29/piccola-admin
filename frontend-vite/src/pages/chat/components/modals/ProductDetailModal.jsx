// src/pages/chat/components/modals/ProductDetailModal.jsx
import React from 'react';

const numberFormat = (v) => {
  try {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? '');
    return n.toLocaleString('es-CL');
  } catch {
    return String(v ?? '');
  }
};

export default function ProductDetailModal({ open, row, payload, onClose }) {
  const [tab, setTab] = React.useState('ventas'); // 'ventas' | 'receta' | 'datos'
  React.useEffect(() => {
    if (open) setTab('ventas');
  }, [open]);

  if (!open || !row) return null;

  // Extract product basics
  const code = row.code || '';
  const name = row.name || row.group || '';
  const imageUrl = row.image_url || '';
  const price = row.price;
  const currency = row.currency || '$';

  // Sales snapshot from the row (if available)
  const venta = (typeof row.total !== 'undefined') ? row.total : row.venta;
  const cantidad = (typeof row.cantidad !== 'undefined') ? row.cantidad : undefined;
  const margen = (typeof row.margen !== 'undefined') ? row.margen : undefined;
  const costo = (typeof row.costo !== 'undefined') ? row.costo : undefined;
  const margen_pct = (typeof row.margen_pct !== 'undefined') ? row.margen_pct : undefined;

  // Extract recipes for this product from payload.related_tables (key === 'recipes')
  const recipeTable = (payload?.related_tables || []).find(rt => rt?.key === 'recipes');
  const recipeRows = (recipeTable?.rows || []).filter(r => String(r.code || '').toUpperCase() === String(code || '').toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-dark-surface text-dark-text dark:text-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-light-surface/50 dark:border-dark-surface/50">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-12 h-12 rounded object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs opacity-70 truncate">{code}</div>
          </div>
          <button className="text-sm px-2 py-1 rounded hover:bg-light-surface/60 dark:hover:bg-dark-surface/60" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 text-xs">
            {['ventas','receta','datos'].map(key => (
              <button
                key={key}
                className={`px-3 py-1 rounded ${tab === key ? 'bg-pink-500/20 text-pink-600 dark:text-pink-300' : 'hover:bg-light-surface/60 dark:hover:bg-dark-surface/60'}`}
                onClick={() => setTab(key)}
              >
                {key === 'ventas' ? 'Ventas' : key === 'receta' ? 'Receta' : 'Datos'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 pt-2 text-sm">
          {tab === 'ventas' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                <div className="text-[11px] opacity-70">Venta</div>
                <div className="text-base font-semibold">${numberFormat(venta)}</div>
              </div>
              {typeof cantidad !== 'undefined' && (
                <div className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                  <div className="text-[11px] opacity-70">Unidades</div>
                  <div className="text-base font-semibold">{numberFormat(cantidad)}</div>
                </div>
              )}
              {typeof margen !== 'undefined' && (
                <div className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                  <div className="text-[11px] opacity-70">Margen</div>
                  <div className="text-base font-semibold">${numberFormat(margen)}</div>
                </div>
              )}
              {typeof costo !== 'undefined' && (
                <div className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                  <div className="text-[11px] opacity-70">Costo</div>
                  <div className="text-base font-semibold">${numberFormat(costo)}</div>
                </div>
              )}
              {typeof margen_pct !== 'undefined' && (
                <div className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                  <div className="text-[11px] opacity-70">Margen %</div>
                  <div className="text-base font-semibold">{numberFormat(margen_pct)}%</div>
                </div>
              )}
            </div>
          )}

          {tab === 'receta' && (
            <div>
              {recipeRows.length === 0 ? (
                <div className="text-xs opacity-70">Sin receta disponible.</div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-light-surface/60 dark:bg-dark-surface/60">
                        <th className="px-3 py-2 text-left font-semibold">Ingrediente</th>
                        <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                        <th className="px-3 py-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeRows.map((r, idx) => (
                        <tr key={idx} className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-light-surface/30 dark:bg-dark-surface/30'}`}>
                          <td className="px-3 py-2 whitespace-nowrap">{r.ingredient}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">{r.qty_text || numberFormat(r.qty)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.unit}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">{typeof r.pct !== 'undefined' ? numberFormat(r.pct) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'datos' && (
            <div className="grid grid-cols-1 gap-2">
              <div><span className="opacity-70 text-xs">Código: </span><span className="font-medium">{code || '-'}</span></div>
              <div><span className="opacity-70 text-xs">Precio: </span><span className="font-medium">{typeof price !== 'undefined' ? `${currency}${numberFormat(price)}` : '-'}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
