// src/pages/chat/components/common/ProductCard.jsx
import React from 'react';

const ProductCard = ({ product, recipe = null }) => {
  if (!product) return null;
  const {
    id,
    name,
    code,
    price,
    currency,
    categories = [],
    options = [],
    description,
    image_url,
  } = product;

  const priceText = price != null ? `${currency || '$'}${Number(price).toLocaleString('es-CL')}` : null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur shadow-lg">
      {image_url && (
        <div className="w-full aspect-[16/9] bg-black/20 overflow-hidden">
          <img src={image_url} alt={name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold text-light-text">{name}</h4>
          {priceText && <div className="px-2 py-0.5 rounded bg-matrix-green/15 text-matrix-green text-sm">{priceText}</div>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-light-text/80">
          {code && <span className="px-2 py-1 rounded bg-white/10">Código: {code}</span>}
          {categories?.length > 0 && (
            <span className="px-2 py-1 rounded bg-white/10">Categorías: {categories.join(', ')}</span>
          )}
        </div>
        {description && (
          <p className="text-sm text-light-text/90 leading-relaxed">{description}</p>
        )}
        {recipe && Array.isArray(recipe.rows) && recipe.rows.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-semibold opacity-80 mb-1">Receta {recipe.mesano ? `— ${recipe.mesano}` : ''}</div>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-white/10">
                    <th className="px-2 py-1 text-left font-semibold">Ingrediente</th>
                    <th className="px-2 py-1 text-right font-semibold">Cantidad</th>
                    <th className="px-2 py-1 text-left font-semibold">Unidad</th>
                    <th className="px-2 py-1 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.rows.map((r, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5'}`}>
                      <td className="px-2 py-1 whitespace-nowrap">{r.ingredient}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right">{r.qty_text ?? r.qty}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.unit}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right">{typeof r.pct !== 'undefined' ? r.pct : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
