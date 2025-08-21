import React, { useEffect, useRef, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';

const isNum = (n) => typeof n === 'number' && isFinite(n);
const fmtCL = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');
const fmtMoney = (n, symbol = '$') => (isNum(n) ? `${symbol}${n.toLocaleString('es-CL')}` : '—');
const pct = (num, den) => (isNum(num) && isNum(den) && den !== 0 ? (num / Math.abs(den)) : null);
const pctText = (v, digits = 0) => (isNum(v) ? `${Math.round(v * 100)}%` : '—');
const delta = (curr, prev) => (isNum(curr) && isNum(prev) && prev !== 0 ? (curr - prev) / Math.abs(prev) : null);

const TinyTrend = ({ d }) => {
  if (!isNum(d)) return <span className="text-[10px] text-gray-500">—</span>;
  const p = Math.round(d * 100);
  const up = p > 0, eq = p === 0;
  const color = eq ? 'text-gray-500' : up ? 'text-emerald-600' : 'text-red-600';
  const arrow = eq ? '•' : up ? '▲' : '▼';
  return <span className={`text-[10px] font-semibold ${color}`}>{arrow} {Math.abs(p)}%</span>;
};

const Cell = ({ label, tip, value, deltaVal, uid }) => {
  const tid = `tt-${uid}-${label}`;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span
        className="text-gray-500"
        {...(tip ? { 'data-tooltip-id': tid, 'data-tooltip-content': tip } : {})}
      >
        {label}
      </span>
      {tip && <ReactTooltip id={tid} place="top" />}
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        {deltaVal !== undefined && <TinyTrend d={deltaVal} />}
      </div>
    </div>
  );
};

const ProductModal = ({ product, mediaMap, onClose }) => {
  const { t } = useTranslation();
  const { price: basePrice, isSpecial } = getCurrentPrice(product, 'dinein', undefined, t);

  const [isMounted, setIsMounted] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  let imgUrl = product?.media_r2 || product?.media_local || product?.media_url || null;
  if (!imgUrl && product?.media_id && mediaMap?.[String(product.media_id)]) {
    imgUrl = mediaMap[String(product.media_id)];
  }

  const modalRef = useRef(null);
  useEffect(() => {
    const timeout = setTimeout(() => setIsMounted(true), 60);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  if (!isMounted) return null;

  // ====== DATA PERIODOS ======
  const R = product?.rentabilidad || {};
  const A = R.actual || {};
  const P1 = R.anterior || {};
  const P2 = R.antepasado || {};
  const AY = R.anio_anterior || {};
  const AA = R.anterior_anio_anterior || {};

  const currency = product?.currency || '$';
  const unitPrice = isNum(basePrice)
    ? basePrice
    : isNum(A.margen) && isNum(A.cupro) ? (A.margen + A.cupro)
    : isNum(P1.margen) && isNum(P1.cupro) ? (P1.margen + P1.cupro)
    : null;

  const gmPct = (m, p) => {
    const price = isNum(unitPrice) ? unitPrice : (isNum(m) && isNum(p) ? m + p : null);
    return isNum(m) && isNum(price) && price !== 0 ? m / price : null;
  };

  // Paquetes de periodos para pintar en orden
  const periods = [
    { key: 'now', label: t('menus.modal.p_now'), data: A, compareWith: P1 },
    { key: 'p1', label: t('menus.modal.p_prev'), data: P1, compareWith: P2 },
    { key: 'p2', label: t('menus.modal.p_prev2'), data: P2, compareWith: AY },
    { key: 'ay', label: t('menus.modal.p_year'), data: AY, compareWith: AA },
    { key: 'aa', label: t('menus.kpis.compare_aa'), data: AA, compareWith: null }
  ];

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 40, filter: 'blur(8px)' },
    visible: { opacity: 1, scale: 1, y: 0, filter: 'blur(0)', transition: { duration: 0.45 } },
    exit: { opacity: 0, scale: 0.98, y: 30, filter: 'blur(6px)', transition: { duration: 0.3 } }
  };

  const uid = String(product?.id || product?._id || product?.codigo || 'x');

  return (
    <LayoutGroup>
      <motion.div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4`}
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleBackdropClick}
        aria-modal="true"
        role="dialog"
      >
        <motion.div
          layout
          ref={modalRef}
          className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-3xl w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-neon border border-light-accent/20 dark:border-dark-accent/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="sticky top-0 z-10 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-light-border/50 dark:border-dark-border/50">
            <div className="flex items-center gap-3">
              {imgUrl && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-light-accent/40 dark:border-dark-accent/40">
                  <img src={imgUrl} alt={product?.nombre || 'Product'} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex flex-col">
                <h4 className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">
                  {product?.nombre || t('menus.kpis.no_name')}
                </h4>
                <div className="text-[11px] text-gray-500">{t('menus.modal.title')}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
              aria-label={t('menus.modal.close')}
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* BODY: GRID 1/3 IMG + 2/3 DATA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 overflow-y-auto max-h-[calc(85vh-72px)]">
            {/* LEFT: IMAGE + INFO */}
            <div className="md:col-span-1 flex flex-col gap-4">
              <div className="relative rounded-2xl overflow-hidden border border-light-accent/40 dark:border-dark-accent/40 bg-white/80 dark:bg-dark-surface/80">
                <div
                  className={`w-full aspect-square cursor-${imgUrl ? 'pointer' : 'default'}`}
                  onClick={() => imgUrl && setShowFullImage(true)}
                  {...(imgUrl ? { 'data-tooltip-id': `tt-${uid}-img`, 'data-tooltip-content': t('menus.modal.img_tip') } : {})}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={product?.nombre || t('menus.kpis.no_name')}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <span className="text-gray-400 text-xs">{t('menus.kpis.no_image')}</span>
                    </div>
                  )}
                </div>
                {imgUrl && <ReactTooltip id={`tt-${uid}-img`} place="top" />}
              </div>

              {/* INFO CARD */}
              <div className="rounded-2xl border border-light-accent/30 dark:border-dark-accent/30 bg-white/60 dark:bg-dark-surface/60 p-3">
                <div className="text-sm font-semibold mb-2 text-light-text-primary dark:text-dark-text-primary">{t('menus.modal.info')}</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.code')}</span><span className="font-semibold">{product?.codigo || '—'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.id')}</span><span className="font-semibold">{product?.id || product?._id || '—'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.price')}</span><span className="font-semibold">{fmtMoney(isNum(basePrice) ? basePrice : product?.precio, currency)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.cupro')}</span><span className="font-semibold">{fmtMoney(A.cupro ?? P1.cupro ?? P2.cupro ?? AY.cupro ?? AA.cupro, currency)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.restrictions')}</span><span className="font-semibold truncate" title={(product?.restriccion || []).join(', ') || '—'}>{(product?.restriccion || []).join(', ') || '—'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">{t('menus.modal.category_ids')}</span><span className="font-semibold truncate" title={(product?.category_ids || []).join(', ') || '—'}>{(product?.category_ids || []).join(', ') || '—'}</span></div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('menus.modal.special')}</span>
                    <span className={`font-semibold ${product?.especial?.special_status ? 'text-emerald-600' : 'text-gray-600'}`}>
                      {product?.especial?.special_status ? t('menus.modal.special_on') : t('menus.modal.special_off')}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESCRIPCION */}
              <div className="rounded-2xl border border-light-accent/30 dark:border-dark-accent/30 bg-white/60 dark:bg-dark-surface/60 p-3">
                <div className="text-sm font-semibold mb-2 text-light-text-primary dark:text-dark-text-primary">{t('menus.modal.desc')}</div>
                <div className="text-[12px] text-light-text-secondary dark:text-dark-text-secondary leading-5">
                  {product?.descripcion || '—'}
                </div>
              </div>
            </div>

            {/* RIGHT: METRICS (2/3) */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <div className="rounded-2xl border border-light-accent/30 dark:border-dark-accent/30 bg-white/60 dark:bg-dark-surface/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('menus.modal.metrics')}</div>
                  <div className="text-[10px] text-gray-500">{t('menus.modal.periods')}: {t('menus.modal.p_now')} · {t('menus.modal.p_prev')} · {t('menus.modal.p_prev2')} · {t('menus.modal.p_year')} · {t('menus.kpis.compare_aa')}</div>
                </div>

                {/* GRID DE PERIODOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {periods.map(({ key, label, data, compareWith }) => {
                    const ventas = data?.total_venta;
                    const utilT = data?.total_margen;
                    const unid = data?.cantidad;
                    const mUnit = data?.margen;
                    const cupro = data?.cupro;

                    const gm = pct(utilT, ventas);                           // margen sobre ventas del periodo
                    const gmUnit = gmPct(mUnit, cupro);                      // margen sobre precio unitario aprox

                    // Deltas cortitos vs periodo de comparación
                    const dUnid = compareWith ? delta(unid, compareWith?.cantidad) : null;
                    const dVenta = compareWith ? delta(ventas, compareWith?.total_venta) : null;
                    const dUtilT = compareWith ? delta(utilT, compareWith?.total_margen) : null;
                    const dGM = compareWith ? delta(gm, (isNum(compareWith?.total_margen) && isNum(compareWith?.total_venta) && compareWith?.total_venta !== 0 ? compareWith.total_margen / compareWith.total_venta : null)) : null;

                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-light-accent/20 dark:border-dark-accent/20 bg-white/70 dark:bg-dark-surface/70 p-2.5"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[12px] font-semibold text-light-text-primary dark:text-dark-text-primary">{label}</div>
                          {compareWith && <span className="text-[10px] text-gray-500">{t('menus.modal.delta_vs_prev')}</span>}
                        </div>

                        <div className="space-y-1">
                          <Cell uid={uid} label={t('menus.modal.units')} tip={t('menus.kpis.units_last_month_tip')} value={fmtCL(unid)} deltaVal={dUnid} />
                          <Cell uid={uid} label={t('menus.modal.sales')} tip={t('menus.kpis.sales_last_month_tip')} value={fmtMoney(ventas, currency)} deltaVal={dVenta} />
                          <Cell uid={uid} label={t('menus.modal.profit_total')} tip={t('menus.kpis.total_profit_last_month_tip')} value={fmtMoney(utilT, currency)} deltaVal={dUtilT} />
                          <Cell uid={uid} label={t('menus.modal.profit_unit')} tip={t('menus.kpis.profit_per_unit_last_month_tip')} value={fmtMoney(mUnit, currency)} />
                          <Cell uid={uid} label={t('menus.modal.margin_pct')} tip={t('menus.kpis.margin_percent_last_month_tip')} value={pctText(gm)} deltaVal={dGM} />
                          <Cell uid={uid} label={t('menus.modal.cupro')} tip={t('menus.kpis.cupro_tip')} value={fmtMoney(cupro, currency)} />
                          <Cell uid={uid} label={t('menus.modal.price')} tip={t('menus.kpis.price_tip')} value={fmtMoney(unitPrice, currency)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* FULL IMAGE VIEWER */}
      {showFullImage && imgUrl && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowFullImage(false)}
        >
          <img src={imgUrl} alt={product?.nombre || t('menus.kpis.no_name')} className="max-w-full max-h-full object-contain" />
        </motion.div>
      )}
    </LayoutGroup>
  );
};

export default ProductModal;
