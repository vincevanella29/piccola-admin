import React from 'react';
import { motion } from 'framer-motion';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';
import { useTranslation } from 'react-i18next';
import { Tooltip as ReactTooltip } from 'react-tooltip';

/**
 * ProductCard — versión ADMIN (mes completo)
 * - Base SIEMPRE: `rentabilidad.anterior` (mes pasado completo)
 * - Comparador dinámico para Δ (badge mini con tooltip):
 *    1) `anterior_anio_anterior` → "AA" (mismo mes del año pasado)
 *    2) si no hay data AA: `antepasado` → "AP" (mes -2)
 *    3) si tampoco: `anio_anterior` → "AY" (año pasado)
 * - Margen % = total_margen / total_venta (sobre `anterior`) + Δ vs comparador elegido
 * - Textos más chicos y precisos + tooltips para contexto
 */

const isNum = (n) => typeof n === 'number' && isFinite(n);
const formatNumberCL = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');
const formatCurrencyCL = (n, symbol = '$') => (isNum(n) ? `${symbol}${n.toLocaleString('es-CL')}` : '—');

const hasData = (o) => {
  if (!o || typeof o !== 'object') return false;
  // válido si tiene ventas/margen total/unidades reales del período
  return [o.total_venta, o.total_margen, o.cantidad].some(isNum);
};

const pctDelta = (curr, prev) => {
  if (!isNum(curr) || !isNum(prev) || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
};

const Trend = ({ delta }) => {
  if (delta === null || !isNum(delta)) return <span className="text-[10px] text-gray-500">—</span>;
  const pct = Math.round(delta * 100);
  const up = pct > 0;
  const neutral = pct === 0;
  const color = neutral ? 'text-gray-500' : up ? 'text-emerald-600' : 'text-red-600';
  const arrow = neutral ? '•' : up ? '▲' : '▼';
  return <span className={`text-[10px] font-semibold ${color}`}>{arrow} {Math.abs(pct)}%</span>;
};

const Label = ({ text, tip, extra, uid }) => {
  const tid = React.useMemo(() => `tt-${uid}-lbl-${String(text).replace(/\s+/g, '-')}`, [uid, text]);
  return (
    <div className="flex items-center gap-1">
      <span
        className="text-[10px] text-gray-500"
        {...(tip ? { 'data-tooltip-id': tid, 'data-tooltip-content': tip } : {})}
      >
        {text}
      </span>
      {tip && <ReactTooltip id={tid} place="top" />}
      {extra}
    </div>
  );
};

const Badge = ({ label, tip, uid }) => {
  if (!label) return null;
  const tid = React.useMemo(() => `tt-${uid}-badge-${label}`, [uid, label]);
  return (
    <>
      <span
        className="ml-0.5 inline-block rounded px-1 py-0 text-[9px] leading-4 bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60"
        {...(tip ? { 'data-tooltip-id': tid, 'data-tooltip-content': tip } : {})}
      >
        {label}
      </span>
      {tip && <ReactTooltip id={tid} place="top" />}
    </>
  );
};

const ProductCard = ({
  dish,
  mediaMap,
  onClick,
  chileTime,
  profile,
  account,
  isHorizontal = false,
}) => {
  const { t } = useTranslation();
  const { price, isSpecial } = getCurrentPrice(dish, 'dinein', chileTime, t);
  const isOutOfStock = !dish.estado;

  let imgUrl = dish.media_r2 || dish.media_local || dish.media_url || null;
  if (!imgUrl && dish.media_id && mediaMap?.[String(dish.media_id)]) {
    imgUrl = mediaMap[String(dish.media_id)];
  }

  const handleOnClick = () => {
    if (window.gtag) {
      window.gtag('event', 'view_item', {
        items: [{ item_id: dish._id, item_name: dish.nombre, price: price, quantity: 1 }],
      });
    }
    onClick?.(dish);
  };

  // ====== KPIs ADMIN (mes completo) ======
  const R = dish?.rentabilidad || {};
  const P = R.anterior || {}; // Base: Mes pasado (completo)
  const uidBase = React.useMemo(() => String(dish?.id || dish?._id || dish?.codigo || Math.random().toString(36).slice(2)), [dish]);

  // Toggle de simulación: Precio Especial vs Normal
  const hasSpecialActive = !!(dish?.especial?.special_status && isNum(dish?.especial?.special_price));
  const normalListPrice = isNum(dish?.precio) ? dish.precio : price; // fallback a price
  const [useSpecialCalc, setUseSpecialCalc] = React.useState(hasSpecialActive);
  // Precio manual (aplicable a todos) - input no controlado
  const manualInputRef = React.useRef(null);
  const [useManualCalc, setUseManualCalc] = React.useState(false);
  // Precio manual aplicado (no cambia hasta presionar "Apply")
  const [appliedManualPrice, setAppliedManualPrice] = React.useState(null);

  // Elegir comparador según reglas
  const AA = R.anterior_anio_anterior || {}; // preferido (mismo mes del año pasado)
  const AP = R.antepasado || {};             // fallback (mes -2)
  const AY = R.anio_anterior || {};          // fallback (año pasado)

  let C = hasData(AA) ? AA : hasData(AP) ? AP : hasData(AY) ? AY : {};
  let compShort = hasData(AA) ? 'AA' : hasData(AP) ? 'AP' : hasData(AY) ? 'AY' : '';
  // Texto del comparador traducido (tooltip)
  const compLabelKey = compShort ? `menus.kpis.compare_${compShort.toLowerCase()}` : '';
  const compTipKey = compShort ? `menus.kpis.compare_${compShort.toLowerCase()}_tip` : '';
  let compExplain = compTipKey ? t(compTipKey) : '';

  // Valores base (mes pasado)
  const unidades = isNum(P.cantidad) ? P.cantidad : null;
  const cupro = isNum(P.cupro) ? P.cupro : null;

  // Precio seleccionado para simulación (especial o normal)
  const selectedUnitPrice = useManualCalc && isNum(appliedManualPrice)
    ? appliedManualPrice
    : (useSpecialCalc && hasSpecialActive
        ? dish.especial.special_price
        : normalListPrice);

  // Δ de precio vs. Normal ("% de alza")
  const priceDeltaPct = (isNum(selectedUnitPrice) && isNum(normalListPrice) && normalListPrice !== 0)
    ? (selectedUnitPrice - normalListPrice) / Math.abs(normalListPrice)
    : null;

  // Si tenemos precio y cupro + unidades, simulamos ventas/costos/utilidades del período
  const totalVenta = isNum(selectedUnitPrice) && isNum(unidades) ? selectedUnitPrice * unidades : (isNum(P.total_venta) ? P.total_venta : null);
  const totalCosto = isNum(cupro) && isNum(unidades) ? cupro * unidades : (isNum(P.total_costo) ? P.total_costo : null);
  const utilidadTotal = isNum(totalVenta) && isNum(totalCosto) ? totalVenta - totalCosto : (isNum(P.total_margen) ? P.total_margen : null);
  const utilidadUnid = isNum(selectedUnitPrice) && isNum(cupro) ? selectedUnitPrice - cupro : (isNum(P.margen) ? P.margen : null);

  // Comparador
  const unidadesCmp = isNum(C.cantidad) ? C.cantidad : null;
  // Simulamos comparador con el mismo precio seleccionado (coherencia de comparación)
  const ventaCmp = isNum(selectedUnitPrice) && isNum(unidadesCmp) ? selectedUnitPrice * unidadesCmp : (isNum(C.total_venta) ? C.total_venta : null);
  const costoCmp = isNum(C.cupro) && isNum(unidadesCmp) ? C.cupro * unidadesCmp : (isNum(C.total_costo) ? C.total_costo : null);
  const utilidadTotalCmp = isNum(ventaCmp) && isNum(costoCmp) ? ventaCmp - costoCmp : (isNum(C.total_margen) ? C.total_margen : null);
  const utilidadUnidCmp = isNum(selectedUnitPrice) && isNum(C.cupro) ? selectedUnitPrice - C.cupro : (isNum(C.margen) ? C.margen : null);

  const deltaUnidades = pctDelta(unidades, unidadesCmp);
  const deltaVenta = pctDelta(totalVenta, ventaCmp);
  const deltaUtilidadUnid = pctDelta(utilidadUnid, utilidadUnidCmp);
  const deltaUtilidadTotal = pctDelta(utilidadTotal, utilidadTotalCmp);

  // Margen % del mes pasado y comparador
  const margenPct = isNum(utilidadTotal) && isNum(totalVenta) && totalVenta !== 0 ? utilidadTotal / totalVenta : null;
  const margenPctCmp = isNum(utilidadTotalCmp) && isNum(ventaCmp) && ventaCmp !== 0 ? utilidadTotalCmp / ventaCmp : null;
  const deltaMargenPct = isNum(margenPct) && isNum(margenPctCmp) ? pctDelta(margenPct, margenPctCmp) : null;

  // Precio unitario estimado (si no lo entrega getCurrentPrice)
  const precioUnit = isNum(price) ? price : isNum(utilidadUnid) && isNum(cupro) ? utilidadUnid + cupro : null;

  // Color para margen %
  const margenPctInt = isNum(margenPct) ? Math.round(margenPct * 100) : null;
  const margenColor = isNum(margenPctInt)
    ? (margenPctInt < 60 ? 'text-red-600' : margenPctInt < 70 ? 'text-amber-500' : 'text-emerald-600')
    : 'text-piccola-light-text-primary dark:text-piccola-white';

  const StatCard = ({ label, tip, value, delta }) => (
    <div className="rounded-lg border border-light-accent/30 dark:border-dark-accent/30 bg-white/60 dark:bg-dark-surface/60 p-1.5">
      <div className="flex items-center justify-between">
        <Label
          uid={uidBase}
          text={label}
          tip={tip}
          extra={compShort ? (
            <Badge
              uid={uidBase}
              label={t(compLabelKey)}
              tip={compExplain}
            />
          ) : null}
        />
        <Trend delta={delta} />
      </div>
      <div className="text-xs font-semibold text-piccola-light-text-primary dark:text-piccola-white mt-0.5">
        {value}
      </div>
    </div>
  );

  const AdminKPIs = () => (
    <div className="mt-2" data-admin>
      {/* Controles de precio (Manual siempre visible) y Toggle Special (si aplica) */}
      <div
        className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-600 dark:text-gray-400"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Precio manual */}
        <div className="flex items-center gap-1">
          <input
            ref={manualInputRef}
            type="number"
            inputMode="decimal"
            step="10"
            min="0"
            className="h-5 w-24 rounded border border-light-accent/40 dark:border-dark-accent/40 bg-white/70 dark:bg-dark-surface/70 px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-light-accent/60 dark:focus:ring-dark-accent/60"
            placeholder={`${dish.currency || '$'}0`}
            defaultValue=""
          />
          <button
            type="button"
            className={"h-5 px-2 rounded text-[10px] font-medium border bg-blue-500 text-white border-blue-500"}
            onClick={(e) => {
              e.stopPropagation();
              const raw = manualInputRef.current ? manualInputRef.current.value : '';
              const parsed = parseFloat(String(raw).replace(/,/g, '.'));
              if (Number.isFinite(parsed)) {
                setAppliedManualPrice(parsed);
                setUseManualCalc(true);
              }
            }}
          >
            {t('common.apply') || 'Aplicar'}
          </button>
          {useManualCalc && (
            <button
              type="button"
              className="h-5 px-2 rounded text-[10px] font-medium border bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700"
              onClick={(e) => { e.stopPropagation(); setUseManualCalc(false); setAppliedManualPrice(null); if (manualInputRef.current) manualInputRef.current.value = ''; }}
            >
              {t('common.reset') || 'Reset'}
            </button>
          )}
        </div>

        {/* Toggle Special / Normal */}
        {hasSpecialActive && (
          <div
            className="mb-1.5 flex items-center justify-end gap-2 text-[10px] text-gray-600 dark:text-gray-400"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className={!useSpecialCalc ? 'font-semibold' : ''}>{t('menus.modal.special_off') || 'Normal'}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setUseSpecialCalc(v => !v); }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${useSpecialCalc ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              aria-label="Toggle special price calculations"
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${useSpecialCalc ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </button>
            <span className={useSpecialCalc ? 'font-semibold text-emerald-600' : ''}>{t('menus.modal.special_on') || 'Special'}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Margen % primero */}
        <div className="col-span-2 rounded-lg border border-light-accent/30 dark:border-dark-accent/30 bg-white/60 dark:bg-dark-surface/60 p-1.5">
          <div className="flex items-center justify-between">
            <Label
              uid={uidBase}
              text={t('menus.kpis.margin_percent_last_month')}
              tip={t('menus.kpis.margin_percent_last_month_tip')}
              extra={compShort ? (
                <Badge uid={uidBase} label={t(compLabelKey)} tip={compExplain} />
              ) : null}
            />
            <Trend delta={deltaMargenPct} />
          </div>
          <div className="text-xs font-semibold mt-0.5">
            {isNum(margenPct) ? (
              <span className={margenColor}>{`${margenPctInt}%`}</span>
            ) : '—'}
            {isNum(margenPctCmp) && (() => {
              const tid = `tt-${uidBase}-margen-ref`;
              return (
                <>
                  <span
                    className="ml-2 text-[10px] text-gray-500 underline decoration-dotted"
                    data-tooltip-id={tid}
                    data-tooltip-content={`${compExplain}: ${Math.round(margenPctCmp * 100)}%`}
                  >
                    {t('menus.kpis.ref')}
                  </span>
                  <ReactTooltip id={tid} place="top" />
                </>
              );
            })()}
          </div>
        </div>

        <StatCard
          label={t('menus.kpis.units_last_month')}
          tip={t('menus.kpis.units_last_month_tip')}
          value={formatNumberCL(unidades)}
          delta={deltaUnidades}
        />
        <StatCard
          label={t('menus.kpis.sales_last_month')}
          tip={t('menus.kpis.sales_last_month_tip')}
          value={formatCurrencyCL(totalVenta, dish.currency || '$')}
          delta={deltaVenta}
        />
        <StatCard
          label={t('menus.kpis.profit_per_unit_last_month')}
          tip={t('menus.kpis.profit_per_unit_last_month_tip')}
          value={formatCurrencyCL(utilidadUnid, dish.currency || '$')}
          delta={deltaUtilidadUnid}
        />
        <StatCard
          label={t('menus.kpis.total_profit_last_month')}
          tip={t('menus.kpis.total_profit_last_month_tip')}
          value={formatCurrencyCL(utilidadTotal, dish.currency || '$')}
          delta={deltaUtilidadTotal}
        />
      </div>

      {/* Línea de contexto: CUPRO y Precio */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600 dark:text-gray-400">
        {(() => {
          const tid = `tt-${uidBase}-cupro`;
          return (
            <>
              <span
                className="underline decoration-dotted"
                data-tooltip-id={tid}
                data-tooltip-content={t('menus.kpis.cupro_tip')}
              >
                {t('menus.kpis.cupro')}: {formatCurrencyCL(cupro, dish.currency || '$')}
              </span>
              <ReactTooltip id={tid} place="top" />
            </>
          );
        })()}
        {isNum(selectedUnitPrice) && (() => {
          const tid = `tt-${uidBase}-precio`;
          return (
            <>
              <span
                className="underline decoration-dotted"
                data-tooltip-id={tid}
                data-tooltip-content={`${t('menus.kpis.price_tip')} ${useManualCalc ? '(Manual)' : (useSpecialCalc ? '(Special)' : '(Normal)')}`}
              >
                {t('menus.kpis.price')}: {formatCurrencyCL(selectedUnitPrice, dish.currency || '$')}
              </span>
              <ReactTooltip id={tid} place="top" />
              {/* % de alza/baja del precio vs Normal */}
              {priceDeltaPct !== null && (
                (() => {
                  const tidDelta = `tt-${uidBase}-precio-delta`;
                  return (
                    <>
                      <span
                        className="ml-2 underline decoration-dotted"
                        data-tooltip-id={tidDelta}
                        data-tooltip-content={`% vs Normal`}
                      >
                        <Trend delta={priceDeltaPct} />
                      </span>
                      <ReactTooltip id={tidDelta} place="top" />
                    </>
                  );
                })()
              )}
              {useManualCalc && (
                <span className="ml-1 inline-block rounded px-1 py-0 text-[9px] leading-4 bg-blue-100 text-blue-700 border border-blue-200">
                  {t('common.manual') || 'Manual'}
                </span>
              )}
              {!useManualCalc && useSpecialCalc && (
                <span className="ml-1 inline-block rounded px-1 py-0 text-[9px] leading-4 bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {t('menus.modal.special')}
                </span>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );

  // =========== RENDER ==========
  if (isHorizontal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`relative flex flex-row items-center bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-2xl p-3 shadow-md hover:shadow-neon transition-all duration-300 cursor-pointer ${isSpecial ? 'border-2 border-light-error/30 dark:border-dark-error/30 hover:border-light-error dark:hover:border-dark-error animate-glow' : ''
          }`}
        onClick={handleOnClick}
      >
        {imgUrl ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 mr-3 rounded-xl overflow-hidden border border-light-accent/40 dark:border-dark-accent/40 bg-white dark:bg-dark-surface">
            <img src={imgUrl} alt={dish.nombre || 'Product'} className="w-full h-full object-cover object-center" loading="lazy" />
          </div>
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 mr-3 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-xl border border-light-accent/40 dark:border-dark-accent/40">
            <span className="text-gray-400 dark:text-gray-500 text-xs">{t('menus.kpis.no_image')}</span>
          </div>
        )}

        <div className="flex-grow min-w-0">
          <h4 className="text-sm sm:text-base font-medium font-sans text-piccola-light-text-primary dark:text-piccola-white truncate">
            {dish.nombre || t('menus.kpis.no_name')}
          </h4>

          {/* KPIs ADMIN (mes pasado, comparador dinámico) */}
          <AdminKPIs />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`relative bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-2xl p-3 shadow-md hover:shadow-neon transition-all duration-300 cursor-pointer ${isSpecial ? 'border-2 border-light-error/30 dark:border-dark-error/30 hover:border-light-error dark:hover:border-dark-error animate-glow' : ''
        }`}
      onClick={handleOnClick}
    >
      {imgUrl ? (
        <div className="w-full aspect-square flex items-center justify-center rounded-xl mb-2 overflow-hidden border border-light-accent/40 dark:border-dark-accent/40 bg-white dark:bg-dark-surface">
          <img
            src={imgUrl}
            alt={dish.nombre || 'Product'}
            className="w-full h-full object-cover object-center"
            loading="lazy"
            style={{ aspectRatio: '1/1', maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
      ) : (
        <div className="w-full aspect-square flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-xl mb-2 border border-light-accent/40 dark:border-dark-accent/40">
          <span className="text-gray-400 dark:text-gray-500 text-xs">{t('menus.kpis.no_image')}</span>
        </div>
      )}

      <h4 className="text-base font-medium font-sans text-piccola-light-text-primary dark:text-piccola-white">
        {dish.nombre || t('menus.kpis.no_name')}
      </h4>

      {/* KPIs ADMIN (mes pasado, comparador dinámico) */}
      <AdminKPIs />
    </motion.div>
  );
};

export default ProductCard;
