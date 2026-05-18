// src/pages/chat/components/client/ProductList.jsx
import React from 'react';
import { Package } from 'lucide-react';
import ProductPayload from './ProductPayload';

const ProductListPayload = ({ products, title }) => {
  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div className="w-full max-w-md bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border-b border-light-border dark:border-dark-border flex items-center gap-2">
           <Package size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
           <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
             {title}
           </span>
        </div>
      )}
      <div className="p-2 space-y-2">
        {products.map((p, idx) => (
          <ProductPayload key={p.id || p.code || idx} product={p} />
        ))}
      </div>
    </div>
  );
};

export default ProductListPayload;
