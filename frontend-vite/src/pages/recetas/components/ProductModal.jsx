import React, { useEffect, useRef, useState } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { FaTimes, FaExpand, FaArrowUp, FaArrowDown, FaCube, FaUtensils, FaInfoCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';

// --- Helpers de Formato ---
const isNum = (n) => typeof n === 'number' && isFinite(n);
const fmtCL = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');
const fmtMoney = (n, symbol = '$') => (isNum(n) ? `${symbol} ${n.toLocaleString('es-CL')}` : '—');
const delta = (curr, prev) => (isNum(curr) && isNum(prev) && prev !== 0 ? (curr - prev) / Math.abs(prev) : null);

// --- Subcomponentes Visuales (Con tus colores) ---

// Indicador de Tendencia
const TrendPill = ({ val }) => {
  if (!isNum(val)) return <span className="text-[10px] text-light-text-secondary/50 dark:text-dark-text-secondary/50 font-medium">—</span>;
  const pct = Math.round(val * 100);
  const isUp = pct > 0;
  const isNeutral = pct === 0;
  
  // Colores basados en tu config: matrix-green (éxito) / dark-error (bajada/error)
  const bgClass = isNeutral 
    ? 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary' 
    : isUp 
      ? 'bg-matrix-green/10 text-matrix-green' 
      : 'bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error';

  const Icon = isNeutral ? null : isUp ? FaArrowUp : FaArrowDown;

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${bgClass}`}>
      {Icon && <Icon className="w-2 h-2" />}
      <span className="text-[10px] font-bold font-mono">{Math.abs(pct)}%</span>
    </div>
  );
};

// Fila de Información General
const InfoRow = ({ label, value, highlight = false }) => (
  <div className="flex justify-between items-center py-2 border-b border-light-border/10 dark:border-dark-border/10 last:border-0">
    <span className="text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">{label}</span>
    <span className={`text-[13px] font-medium font-mono ${highlight ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
      {value}
    </span>
  </div>
);

// Tarjeta de KPI (Estilo Widget Apple)
const KpiWidget = ({ title, value, trendValue, labelSub }) => (
  <div className="flex flex-col bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-3 border border-light-border/10 dark:border-dark-border/10 backdrop-blur-sm">
    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase mb-1">{title}</span>
    <div className="flex items-end justify-between">
      <span className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary font-mono tracking-tight">
        {value}
      </span>
      {trendValue !== undefined && (
        <div className="flex flex-col items-end">
          <TrendPill val={trendValue} />
          {labelSub && <span className="text-[9px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-0.5">{labelSub}</span>}
        </div>
      )}
    </div>
  </div>
);

// --- Componente Principal ---

const ProductModal = ({ product, mediaMap, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  // --- Data Logic ---
  const { price: basePrice } = getCurrentPrice(product, 'dinein', undefined, t);
  
  let imgUrl = product?.media_r2 || product?.media_local || product?.media_url || null;
  if (!imgUrl && product?.media_id && mediaMap?.[String(product.media_id)]) {
    imgUrl = mediaMap[String(product.media_id)];
  }

  const currency = product?.currency || '$';
  const displayPrice = fmtMoney(isNum(basePrice) ? basePrice : product?.precio, currency);
  
  // Sales Data
  const sales = product?.sales_units || {};
  const unitsActual = isNum(sales.actual) ? sales.actual : null;
  const unitsPrev = isNum(sales.anterior) ? sales.anterior : null;
  const unitsPrev2 = isNum(sales.antepasado) ? sales.antepasado : null;
  const unitsYear = isNum(sales.anio_anterior) ? sales.anio_anterior : null;

  // Recipe Data
  const recipe = product?.recipe;
  const hasRecipe = recipe && Array.isArray(recipe.rows) && recipe.rows.length > 0;

  // --- Lifecycle & Handlers ---
  useEffect(() => {
    setIsMounted(true);
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      <LayoutGroup>
        {/* BACKDROP - Centrado Flex */}
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-background/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* MODAL CARD - Altura restringida al 70vh */}
          <motion.div
            ref={modalRef}
            layoutId={`modal-${product?._id || 'product'}`}
            className="relative w-full max-w-5xl h-[70vh] bg-light-surface/95 dark:bg-dark-surface/95 rounded-3xl shadow-modal border border-light-border/20 dark:border-dark-border/20 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* HEADER (Sticky) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-light-border/10 dark:border-dark-border/10 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-md shrink-0 z-20">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary font-sans tracking-tight">
                  {product?.nombre || t('menus.kpis.no_name')}
                </h2>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">
                  {t('menus.modal.title', 'Detalle de Producto')}
                </span>
              </div>
              
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-all duration-200"
                aria-label={t('menus.modal.close')}
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {/* CONTENT SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-light-border/50 dark:scrollbar-thumb-dark-border/50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* --- LEFT COLUMN (Info & Image) - Spans 4 cols --- */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                  
                  {/* Image Card */}
                  <div className="group relative aspect-square rounded-2xl overflow-hidden bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-light-border/10 dark:border-dark-border/10">
                    {imgUrl ? (
                      <>
                        <img 
                          src={imgUrl} 
                          alt={product?.nombre} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <button 
                          onClick={() => setShowFullImage(true)}
                          className="absolute bottom-3 right-3 p-2 rounded-full bg-dark-surface/40 backdrop-blur-md text-dark-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-dark-surface/60"
                        >
                          <FaExpand className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-light-text-secondary/40 dark:text-dark-text-secondary/40">
                        <FaCube className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs font-medium">{t('menus.kpis.no_image')}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Panel */}
                  <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-4 border border-light-border/10 dark:border-dark-border/10">
                    <div className="flex items-center gap-2 mb-3">
                      <FaInfoCircle className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                      <h3 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
                        {t('menus.modal.info', 'Información')}
                      </h3>
                    </div>
                    <div className="flex flex-col">
                      <InfoRow label={t('menus.modal.price', 'Precio')} value={displayPrice} highlight />
                      <InfoRow label={t('menus.modal.code', 'Código')} value={product?.codigo || '—'} />
                      <InfoRow label={t('menus.modal.id', 'ID')} value={product?.id || product?._id || '—'} />
                      <InfoRow 
                        label={t('menus.modal.special', 'Especial')} 
                        value={
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${product?.especial?.special_status ? 'bg-matrix-green/10 text-matrix-green' : 'bg-light-surface-tertiary/50 text-light-text-secondary'}`}>
                            {product?.especial?.special_status ? t('menus.modal.special_on') : t('menus.modal.special_off')}
                          </span>
                        } 
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-4 border border-light-border/10 dark:border-dark-border/10">
                    <h3 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary mb-2 uppercase tracking-wide">
                      {t('menus.modal.desc', 'Descripción')}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">
                      {product?.descripcion || t('menus.kpis.no_description', 'Sin descripción.')}
                    </p>
                  </div>
                </div>

                {/* --- RIGHT COLUMN (Data & Recipe) - Spans 8 cols --- */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiWidget 
                      title={t('menus.kpis.period_current', 'Actual')}
                      value={fmtCL(unitsActual)}
                      // Sin tendencia para el absoluto actual
                    />
                    <KpiWidget 
                      title={t('menus.modal.p_prev', 'Mes Ant.')}
                      value={fmtCL(unitsPrev)}
                      trendValue={delta(unitsActual, unitsPrev)}
                      labelSub="vs Actual"
                    />
                     <KpiWidget 
                      title={t('menus.modal.p_prev2', 'Hace 2 Meses')}
                      value={fmtCL(unitsPrev2)}
                      trendValue={delta(unitsPrev, unitsPrev2)}
                      labelSub="vs Mes Ant."
                    />
                    <KpiWidget 
                      title={t('menus.modal.p_year', 'Año Pasado')}
                      value={fmtCL(unitsYear)}
                      trendValue={delta(unitsPrev, unitsYear)}
                      labelSub="vs Mes Ant."
                    />
                  </div>

                  {/* Recipe Section */}
                  <div className="flex-1 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-3xl border border-light-border/10 dark:border-dark-border/10 overflow-hidden flex flex-col min-h-[300px]">
                    
                    {/* Recipe Header */}
                    <div className="px-6 py-3 border-b border-light-border/10 dark:border-dark-border/10 flex items-center justify-between bg-light-surface/50 dark:bg-dark-surface/50">
                      <div className="flex items-center gap-2">
                        <FaUtensils className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                        <h3 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
                          {t('menus.recipes.title', 'Ficha Técnica')}
                        </h3>
                      </div>
                      {recipe?.mesano && (
                        <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary bg-light-surface dark:bg-dark-surface px-2 py-1 rounded border border-light-border/10 dark:border-dark-border/10">
                          {t('menus.recipes.period', 'Periodo')}: {recipe.mesano}
                        </span>
                      )}
                    </div>

                    {/* Recipe List */}
                    <div className="flex-1 overflow-y-auto p-0">
                      {hasRecipe ? (
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 sticky top-0 z-10">
                            <tr>
                                
                              <th className="px-6 py-3 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-light-border/5 dark:border-dark-border/5">
                                {t('menus.recipes.ingredient', 'Ingrediente')}
                              </th>
                              <th className="px-6 py-3 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider text-right border-b border-light-border/5 dark:border-dark-border/5">
                                {t('menus.recipes.qty', 'Cantidad')}
                              </th>
                              <th className="px-6 py-3 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider text-right border-b border-light-border/5 dark:border-dark-border/5">
                                {t('menus.recipes.percent', '%')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-light-border/5 dark:divide-dark-border/5">
                            {recipe.rows.map((r, idx) => (
                              <tr key={idx} className="group hover:bg-light-surface dark:hover:bg-dark-surface-secondary/40 transition-colors">
                                <td className="px-6 py-2.5 text-[12px] font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {r.ingredient}
                                </td>
                                <td className="px-6 py-2.5 text-[12px] text-light-text-secondary dark:text-dark-text-secondary font-mono text-right">
                                  <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{r.qty_text}</span> <span className="text-[10px] opacity-70">{r.unit}</span>
                                </td>
                                <td className="px-6 py-2.5 text-[11px] text-light-text-secondary/70 dark:text-dark-text-secondary/70 font-mono text-right">
                                  {isNum(r.pct) ? `${r.pct}%` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-light-text-secondary/40 dark:text-dark-text-secondary/40">
                          <FaUtensils className="w-6 h-6 mb-3 opacity-30" />
                          <p className="text-xs font-medium opacity-70">
                            {t('menus.recipes.no_recipe', 'No hay receta disponible')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* FULL SCREEN IMAGE OVERLAY */}
        {showFullImage && imgUrl && (
          <motion.div
            className="fixed inset-0 z-[60] bg-dark-background/90 flex items-center justify-center p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullImage(false)}
          >
            <button 
              className="absolute top-6 right-6 text-dark-text-primary/50 hover:text-dark-text-primary transition-colors"
              onClick={() => setShowFullImage(false)}
            >
              <FaTimes className="w-8 h-8" />
            </button>
            <motion.img 
              layoutId={`modal-img-${product?._id}`}
              src={imgUrl} 
              alt="Full view" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-modal"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </LayoutGroup>
    </AnimatePresence>
  );
};

export default ProductModal;