// src/pages/chat/components/client/ProductList.jsx
import React from 'react';
import ProductCard from './ProductCard';

const ProductList = ({ query, total, shown, items = [] }) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm text-light-text/80">
        <div>
          {query ? (
            <>
              Resultados para <span className="font-medium text-light-text">“{query}”</span>
            </>
          ) : (
            <span className="font-medium">Resultados</span>
          )}
        </div>
        <div className="opacity-70">Mostrando {shown ?? items.length} de {total ?? items.length}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((p) => (
          <ProductCard key={p.id || p.code} product={p} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;
