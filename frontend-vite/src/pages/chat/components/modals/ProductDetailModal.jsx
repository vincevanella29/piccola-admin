// src/pages/chat/components/modals/ProductDetailModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChefHat, TrendingUp, Package, DollarSign, Tag, Layers, Scale } from 'lucide-react';

const numberFormat = (v, isMoney = false) => {
  try {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? '');
    return n.toLocaleString('es-CL', isMoney ? { style: 'currency', currency: 'CLP' } : {});
  } catch {
    return String(v ?? '');
  }
};

export default function ProductDetailModal({ open, row, payload, onClose }) {
  const intent = (payload?.intent || '').toLowerCase();
  
  // Configuración de Pestañas
  const tabs = useMemo(() => {
    const base = [
      { id: 'receta', label: 'Ficha Técnica', icon: ChefHat },
      { id: 'datos', label: 'Detalles', icon: Layers }
    ];
    if (intent !== 'menus') {
      base.unshift({ id: 'ventas', label: 'Rendimiento', icon: TrendingUp });
    }
    return base;
  }, [intent]);

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  useEffect(() => {
    if (open) setActiveTab(tabs[0].id);
  }, [open, tabs]);

  if (!open || !row) return null;

  // Datos del Producto
  const {
    code = '',
    name = row.group || 'Producto Sin Nombre',
    image_url: imageUrl,
    price,
    currency = '$',
    total, venta, cantidad, margen, costo, margen_pct
  } = row;

  const salesValue = typeof total !== 'undefined' ? total : venta;

  // Datos de Receta
  const recipeTable = (payload?.related_tables || []).find(rt => rt?.key === 'recipes');
  const recipeRows = (recipeTable?.rows || []).filter(r => String(r.code || '').toUpperCase() === String(code || '').toUpperCase());

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container Wrapper */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            
            {/* CARD PRINCIPAL: max-h-[85vh] limita el alto a la pantalla */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full max-w-2xl bg-light-surface dark:bg-dark-surface rounded-[24px] shadow-2xl pointer-events-auto border border-light-border/40 dark:border-dark-border/40 flex flex-col max-h-[65vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* --- HEADER (Fijo, no scrollea) --- */}
              <div className="relative shrink-0 z-10 bg-light-surface dark:bg-dark-surface">
                <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 z-20 p-2 rounded-full bg-gray-100 dark:bg-gray-800 backdrop-blur-md text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center p-6 gap-5 bg-gradient-to-b from-light-surface-secondary to-light-surface dark:from-dark-surface-secondary dark:to-dark-surface">
                  <div className="relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden shadow-lg border border-light-border/40 dark:border-dark-border/40 bg-light-surface dark:bg-dark-surface">
                    {imageUrl ? (
                      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                        <Package size={32} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="px-2 py-0.5 rounded-md bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-[10px] font-bold font-mono uppercase tracking-wider border border-light-accent/20 dark:border-dark-accent/20">
                         {code}
                       </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate leading-tight">
                      {name}
                    </h2>
                    {typeof price !== 'undefined' && (
                      <div className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                         Precio: <span className="text-gray-900 dark:text-white font-semibold">{currency}{numberFormat(price)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TABS (Fijos también) */}
                <div className="px-6 pb-4">
                  <div className="flex p-1 bg-gray-100 dark:bg-dark-surface-secondary rounded-xl relative">
                    {tabs.map((t) => {
                      const isActive = activeTab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id)}
                          className={`relative flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold z-10 transition-colors duration-200 ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                          <t.icon size={14} />
                          {t.label}
                          {isActive && (
                            <motion.div
                              layoutId="modalTabBg"
                              className="absolute inset-0 bg-white dark:bg-dark-surface shadow-sm rounded-lg z-[-1]"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="h-[1px] w-full bg-gray-200 dark:bg-gray-800" />
              </div>

              {/* --- CONTENT AREA (Scrollea independientemente) --- */}
              {/* overflow-y-auto aquí es la clave. min-h-0 permite al flexbox encoger este div */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-light-surface dark:bg-dark-surface overscroll-contain">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    
                    {/* VISTA: RENDIMIENTO */}
                    {activeTab === 'ventas' && (
                      <div className="grid grid-cols-2 gap-3">
                         <KPICard label="Venta Total" value={salesValue} isMoney />
                         <KPICard label="Unidades" value={cantidad} icon={Package} />
                         <KPICard label="Margen $" value={margen} isMoney className="text-green-600 dark:text-green-400" />
                         <KPICard label="Margen %" value={margen_pct} suffix="%" className="text-green-600 dark:text-green-400" />
                         <KPICard label="Costo Total" value={costo} isMoney className="col-span-2 bg-red-50/50 dark:bg-red-900/10 text-red-600 dark:text-red-400" />
                      </div>
                    )}

                    {/* VISTA: RECETA (Aquí es donde se llena mucho) */}
                    {activeTab === 'receta' && (
                      <div className="space-y-4 pb-4">
                        {recipeRows.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <ChefHat size={40} strokeWidth={1} className="mb-2 opacity-50"/>
                            <span className="text-sm">No hay receta disponible</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             <div className="flex text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 sticky top-0 bg-light-surface dark:bg-dark-surface z-10 py-2">
                                <span className="flex-1">Ingrediente</span>
                                <span className="w-20 text-right">Cant.</span>
                                <span className="w-16 text-right">%</span>
                             </div>
                             {recipeRows.map((r, idx) => {
                               const pct = parseFloat(r.pct || 0);
                               return (
                                 <div key={idx} className="relative group">
                                    <div className="absolute inset-y-0 left-0 bg-light-accent/5 dark:bg-dark-accent/10 rounded-lg transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                    <div className="relative z-0 flex items-center justify-between py-3 px-3 rounded-lg border border-transparent hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-colors">
                                       <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-2">{r.ingredient}</span>
                                       <div className="flex items-center gap-4 text-right shrink-0">
                                          <div className="flex flex-col w-20">
                                             <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{r.qty_text || numberFormat(r.qty)}</span>
                                             <span className="text-[9px] text-gray-500 uppercase">{r.unit}</span>
                                          </div>
                                          <div className="w-16 font-mono text-xs font-bold text-light-accent dark:text-dark-accent">
                                             {pct > 0 ? `${pct}%` : '-'}
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                               );
                             })}
                             <div className="pt-4 text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-[10px] text-gray-500 dark:text-gray-400">
                                  <Scale size={12} />
                                  <span>Fin de la receta</span>
                                </div>
                             </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* VISTA: DATOS */}
                    {activeTab === 'datos' && (
                      <div className="space-y-2">
                        <InfoRow label="Código Sistema" value={code} icon={Tag} />
                        <InfoRow label="Nombre Producto" value={name} icon={Package} />
                        <InfoRow label="Precio Base" value={price ? `${currency} ${numberFormat(price)}` : 'N/A'} icon={DollarSign} />
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- SUB-COMPONENTES ---

const KPICard = ({ label, value, isMoney, suffix = '', icon: Icon, className = '' }) => {
  if (typeof value === 'undefined' || value === null) return null;
  return (
    <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-dark-surface-secondary border border-gray-100 dark:border-dark-border/40 flex flex-col justify-center ${className}`}>
       <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {Icon && <Icon size={12} />}
          <span className="uppercase tracking-wide">{label}</span>
       </div>
       <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {isMoney ? numberFormat(value, true) : numberFormat(value)}{suffix}
       </div>
    </div>
  );
};

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-surface-secondary">
    <div className="flex items-center gap-3">
       <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-300">
          <Icon size={16} />
       </div>
       <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    </div>
    <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{value}</span>
  </div>
);