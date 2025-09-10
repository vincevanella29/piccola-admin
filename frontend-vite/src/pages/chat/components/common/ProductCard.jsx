// src/pages/chat/components/client/ProductCard.jsx
import React from 'react';

const ProductCard = ({ product }) => {
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
            <span className="px-2 py-1 rounded bg-white/10">{categories.join(' · ')}</span>
          )}
          {options?.length > 0 && (
            <span className="px-2 py-1 rounded bg-white/10">{options.join(' · ')}</span>
          )}
        </div>
        {description && (
          <p className="text-sm leading-relaxed text-light-text/90">{description}</p>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
