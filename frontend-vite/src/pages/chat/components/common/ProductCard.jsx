import React, { useState } from 'react';
import { Package, ChefHat, Scale, ChevronDown, ChevronUp } from 'lucide-react';

const ProductCard = ({ product, recipe = null }) => {
  if (!product) return null;
  
  const [showRecipe, setShowRecipe] = useState(true);

  const {
    name,
    code,
    price,
    currency,
    categories = [],
    description,
    image_url,
  } = product;

  // Fix Currency: 'toLocaleString' fails with '$', it needs 'CLP', 'USD', etc.
  const currencyCode = !currency || currency === '$' ? 'CLP' : currency;

  const priceText = price != null 
    ? Number(price).toLocaleString('es-CL', { style: 'currency', currency: currencyCode }) 
    : null;

  // Formatear fecha de receta (ej: 202510 -> Oct 2025)
  const formatRecipeDate = (str) => {
    if (!str || str.length !== 6) return str;
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    return `${m}/${y}`;
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-lg transition-all hover:shadow-xl">
      
      {/* --- 1. HERO IMAGE & BADGES --- */}
      <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-900 overflow-hidden group">
        {image_url ? (
          <img 
            src={image_url} 
            alt={name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-light-text-tertiary dark:text-dark-text-tertiary">
            <Package size={48} strokeWidth={1} />
          </div>
        )}
        
        {/* Price Tag Flotante */}
        {priceText && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-light-surface/90 dark:bg-black/80 backdrop-blur-md border border-white/10 shadow-sm">
            <span className="text-sm font-bold text-light-text-primary dark:text-white tracking-tight">{priceText}</span>
          </div>
        )}
      </div>

      {/* --- 2. CONTENT BODY --- */}
      <div className="p-5">
        
        {/* Header Info */}
        <div className="mb-4">
           <div className="flex justify-between items-start gap-2 mb-1">
              <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">{name}</h3>
              {code && (
                <span className="shrink-0 text-[10px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary bg-light-surface-secondary dark:bg-dark-surface-secondary px-1.5 py-0.5 rounded border border-light-border dark:border-dark-border">
                  #{code}
                </span>
              )}
           </div>
           {categories.length > 0 && (
              <div className="text-[10px] uppercase tracking-wide text-light-accent dark:text-dark-accent font-semibold mb-2">
                 {categories.join(' • ')}
              </div>
           )}
           {description && (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-90">
                {description}
              </p>
           )}
        </div>

        {/* --- 3. RECIPE SECTION (Data Viz) --- */}
        {recipe && Array.isArray(recipe.rows) && recipe.rows.length > 0 && (
          <div className="mt-5 pt-4 border-t border-light-border dark:border-dark-border">
            <button 
              onClick={() => setShowRecipe(!showRecipe)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">
                <ChefHat size={14} className="text-light-accent dark:text-dark-accent" />
                <span>Ficha Técnica</span>
                {recipe.mesano && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary">{formatRecipeDate(recipe.mesano)}</span>}
              </div>
              {showRecipe ? <ChevronUp size={14} className="opacity-50" /> : <ChevronDown size={14} className="opacity-50" />}
            </button>

            {showRecipe && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                 {/* Header Columnas */}
                 <div className="flex text-[9px] font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider px-2 mb-1">
                    <span className="flex-1">Ingrediente</span>
                    <div className="flex gap-4 text-right">
                       <span className="w-16">Cant.</span>
                       <span className="w-8">%</span>
                    </div>
                 </div>

                 {/* Rows */}
                 {recipe.rows.map((r, idx) => {
                   const pct = parseFloat(r.pct || 0);
                   const qty = parseFloat(r.qty_text || r.qty || 0);
                   
                   return (
                     <div key={idx} className="relative group">
                        {/* Progress Bar Background */}
                        <div 
                          className="absolute inset-y-0 left-0 bg-light-accent/5 dark:bg-dark-accent/10 rounded-md transition-all duration-500" 
                          style={{ width: `${Math.min(pct, 100)}%` }} 
                        />
                        
                        <div className="relative z-10 flex items-center justify-between py-1.5 px-2 text-xs rounded-md hover:bg-light-surface-secondary/50 dark:hover:bg-white/5 transition-colors">
                           <div className="font-medium text-light-text-secondary dark:text-dark-text-secondary truncate pr-2">
                              {r.ingredient}
                           </div>
                           <div className="flex items-center gap-4 text-right shrink-0 font-mono text-light-text-primary dark:text-dark-text-primary">
                              <div className="w-16 flex items-center justify-end gap-1">
                                 <span>{Number.isInteger(qty) ? qty : qty.toFixed(3)}</span>
                                 <span className="text-[9px] opacity-60 uppercase">{r.unit}</span>
                              </div>
                              <div className="w-8 text-right font-bold text-[10px] opacity-80">
                                 {pct > 0 ? `${pct.toFixed(1)}%` : '-'}
                              </div>
                           </div>
                        </div>
                     </div>
                   );
                 })}
                 
                 <div className="pt-2 flex justify-end items-center gap-1 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
                    <Scale size={10} />
                    <span>Proporciones basadas en receta estándar</span>
                 </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default ProductCard;