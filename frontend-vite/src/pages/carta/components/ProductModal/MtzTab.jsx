/**
 * MtzTab — Rentabilidad + Receta · Apple style · Theme-aware
 */
import React, { useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus, ChefHat, BarChart2, Info, Star, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isNum = (n) => typeof n === 'number' && isFinite(n);
const CLP = (v) => isNum(v)
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
    : '—';
const fmtNum = (n) => isNum(n) ? n.toLocaleString('es-CL') : '—';

// Formato período YYYYMM → "Ene 2025"
const fmtMesano = (m) => {
    if (!m || String(m).length < 6) return m || '?';
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const y = String(m).slice(0, 4);
    const mo = parseInt(String(m).slice(4, 6), 10) - 1;
    return `${months[mo] ?? '?'} ${y}`;
};

// ── TrendBadge ────────────────────────────────────────────────────────────────
const TrendBadge = ({ delta, inverse = false }) => {
    if (!isNum(delta)) return <span className="text-light-text-secondary/30 dark:text-dark-text-secondary/30 text-[10px]">—</span>;
    const isPositive = delta > 0;
    const isGood = inverse ? !isPositive : isPositive;
    const color = delta === 0
        ? 'text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary dark:bg-dark-surface-secondary'
        : isGood
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
            : 'text-red-600 dark:text-red-400 bg-red-500/10';
    const Icon = delta === 0 ? Minus : isPositive ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${color}`}>
            <Icon className="w-2.5 h-2.5" />
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
        </span>
    );
};

// ── MetricCard ────────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, delta, icon: Icon, color, inverse = false }) => {
    const colorMap = {
        blue:   'text-blue-500 dark:text-blue-400 bg-blue-500/10',
        green:  'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10',
        purple: 'text-violet-500 dark:text-violet-400 bg-violet-500/10',
        orange: 'text-orange-500 dark:text-orange-400 bg-orange-500/10',
        red:    'text-red-500 dark:text-red-400 bg-red-500/10',
    };
    return (
        <div className="flex flex-col p-3.5 rounded-2xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/25 border border-light-border/50 dark:border-dark-border/30 hover:border-light-border dark:hover:border-dark-border transition-all">
            <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-xl ${colorMap[color] || colorMap.blue}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <TrendBadge delta={delta} inverse={inverse} />
            </div>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium">{label}</p>
            <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mt-0.5 leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 font-mono mt-0.5">{sub}</p>}
        </div>
    );
};

// ── Period selector ───────────────────────────────────────────────────────────
const PeriodBtn = ({ label, active, onClick }) => (
    <button onClick={onClick}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
            active
                ? 'bg-light-text-primary dark:bg-dark-text-primary text-light-surface dark:text-dark-surface shadow-md'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
        }`}>
        {label}
    </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const MtzTab = ({ mtzData, loading }) => {
    const { t } = useTranslation();
    const [periodIdx, setPeriodIdx] = useState(0);

    if (loading) return (
        <div className="py-14 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500 dark:text-violet-400" />
        </div>
    );

    if (!mtzData) return (
        <div className="py-10 text-center space-y-3">
            <BarChart2 className="w-9 h-9 opacity-15 mx-auto text-light-text-secondary dark:text-dark-text-secondary" />
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Sin datos MTZ — verifica que el código del producto coincida.</p>
        </div>
    );

    const rentabilidad = mtzData.rentabilidad || [];
    const trend        = mtzData.trend || null;
    const receta       = mtzData.receta || [];
    const prioridad    = mtzData.prioridad ?? null;
    const estado       = mtzData.estado ?? true;
    const precioProducto = mtzData.precio || 0;

    // Period selection
    const periods    = rentabilidad;
    const curr       = periods[periodIdx] || {};
    const prev       = periods[periodIdx + 1] || null;
    const isNewest   = periodIdx === 0;

    // Derived
    const cantidad     = curr.cantidad;
    const totalVenta   = curr.total_venta;
    const totalMargen  = curr.total_margen;
    const marginPct    = curr.margin_pct;
    const cupro        = curr.cupro;
    const puven        = curr.puven || precioProducto;
    const margenUnit   = isNum(puven) && isNum(cupro) ? puven - cupro : null;

    // Deltas
    const deltaCantidad = prev
        ? (prev.cantidad && prev.cantidad !== 0 ? ((cantidad - prev.cantidad) / Math.abs(prev.cantidad)) * 100 : null)
        : (isNewest && trend ? trend.cantidad_delta_pct : null);
    const deltaVenta = prev
        ? (prev.total_venta && prev.total_venta !== 0 ? ((totalVenta - prev.total_venta) / Math.abs(prev.total_venta)) * 100 : null)
        : (isNewest && trend ? trend.total_venta_delta_pct : null);
    const deltaMargen = prev
        ? (prev.total_margen && prev.total_margen !== 0 ? ((totalMargen - prev.total_margen) / Math.abs(prev.total_margen)) * 100 : null)
        : (isNewest && trend ? trend.total_margen_delta_pct : null);
    const deltaMarginPct = prev
        ? (isNum(marginPct) && isNum(prev.margin_pct) ? marginPct - prev.margin_pct : null)
        : (isNewest && trend ? trend.margin_pct_delta : null);

    return (
        <div className="space-y-4">

            {/* Product meta strip */}
            <div className="flex items-center gap-2 flex-wrap">
                {prioridad !== null && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        <Star className="w-2.5 h-2.5 fill-current" /> Prioridad #{prioridad}
                    </span>
                )}
                {estado
                    ? <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"><CheckCircle className="w-2.5 h-2.5" /> Activo</span>
                    : <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold"><XCircle className="w-2.5 h-2.5" /> Inactivo</span>
                }
                {mtzData.codigo && (
                    <span className="px-2 py-1 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/50 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary font-mono text-[10px]">
                        {mtzData.codigo}
                    </span>
                )}
            </div>

            {/* ── Rentabilidad ────────────────────────────────────────── */}
            {rentabilidad.length > 0 ? (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">Rendimiento de Ventas</h4>
                    </div>

                    {/* Period selector */}
                    {periods.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {periods.map((p, i) => (
                                <PeriodBtn key={p.mesano} label={fmtMesano(p.mesano)} active={periodIdx === i} onClick={() => setPeriodIdx(i)} />
                            ))}
                        </div>
                    )}

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-2">
                        <MetricCard label="Unidades vendidas" value={fmtNum(cantidad)}
                            sub={prev ? `Anterior: ${fmtNum(prev.cantidad)}` : undefined}
                            delta={deltaCantidad} icon={BarChart2} color="purple" />
                        <MetricCard label="Ventas totales" value={CLP(totalVenta)}
                            sub={prev ? `Anterior: ${CLP(prev.total_venta)}` : undefined}
                            delta={deltaVenta} icon={TrendingUp} color="blue" />
                        <MetricCard label="Margen total" value={CLP(totalMargen)}
                            sub={prev ? `Anterior: ${CLP(prev.total_margen)}` : undefined}
                            delta={deltaMargen} icon={TrendingUp} color="green" />
                        <MetricCard label="% Margen" value={isNum(marginPct) ? `${marginPct.toFixed(1)}%` : '—'}
                            sub={prev && isNum(prev.margin_pct) ? `Anterior: ${prev.margin_pct.toFixed(1)}%` : undefined}
                            delta={deltaMarginPct} icon={TrendingUp} color="orange" />
                    </div>

                    {/* Unit economics */}
                    <div className="p-4 rounded-2xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/25 border border-light-border/50 dark:border-dark-border/30 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-light-text-secondary/60 dark:text-dark-text-secondary/60">Economía Unitaria</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-0.5">P. Venta</p>
                                <p className="text-base font-bold text-light-text-primary dark:text-dark-text-primary font-mono">{CLP(puven)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-0.5">Costo Unitario</p>
                                <p className="text-base font-bold text-red-500 dark:text-red-400 font-mono">{cupro ? `- ${CLP(cupro)}` : '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-0.5">Margen Unit.</p>
                                <p className={`text-base font-bold font-mono ${isNum(margenUnit) && margenUnit >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {isNum(margenUnit) ? `${margenUnit >= 0 ? '+' : ''}${CLP(margenUnit)}` : '—'}
                                </p>
                            </div>
                        </div>
                        {/* Margin bar */}
                        {isNum(marginPct) && (
                            <div>
                                <div className="flex justify-between text-[9px] text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    <span>Margen s/venta</span>
                                    <span>{marginPct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${marginPct < 0 ? 'bg-red-500' : marginPct < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, marginPct))}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* By-location breakdown */}
                    {curr.locales?.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-semibold uppercase tracking-wide">Por local</p>
                            <div className="space-y-1">
                                {curr.locales.map((loc, i) => (
                                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/20 border border-light-border/40 dark:border-dark-border/20 text-[10px]">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[60%]">{loc.centroproduccion || 'Sin nombre'}</span>
                                        <span className="text-light-text-primary dark:text-dark-text-primary font-semibold font-mono shrink-0">{fmtNum(loc.cantidad)} un.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            ) : (
                <div className="py-6 text-center space-y-2">
                    <Info className="w-7 h-7 opacity-15 mx-auto text-light-text-secondary dark:text-dark-text-secondary" />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Sin datos de ventas para este producto.</p>
                </div>
            )}

            {/* ── Receta ──────────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <h4 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">Receta y Costos</h4>
                    {receta.length > 0 && (
                        <span className="ml-auto text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono">
                            Total: {CLP(receta.reduce((s, i) => s + (i.costo || 0), 0))}
                        </span>
                    )}
                </div>

                {receta.length > 0 ? (
                    <div className="rounded-2xl border border-light-border/60 dark:border-dark-border/40 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 border-b border-light-border/50 dark:border-dark-border/30">
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Ingrediente</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Cant.</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">Costo</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border/30 dark:divide-dark-border/20">
                                {receta.map((ing, i) => (
                                    <tr key={i} className="hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15 transition-colors">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden self-stretch" style={{ minHeight: 16 }}>
                                                    <div className="w-full bg-amber-400/60 rounded-full" style={{ height: `${ing.pct_costo || 0}%` }} />
                                                </div>
                                                <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{ing.ingrediente}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-light-text-secondary dark:text-dark-text-secondary">
                                            {parseFloat(ing.cantidad).toFixed(3)} <span className="opacity-50">{ing.unidad}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-red-500 dark:text-red-400">{CLP(ing.costo)}</td>
                                        <td className="px-2 py-2 text-right">
                                            {isNum(ing.pct_costo) && (
                                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono">{ing.pct_costo}%</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-5 text-center space-y-1.5">
                        <Info className="w-6 h-6 opacity-15 mx-auto text-light-text-secondary dark:text-dark-text-secondary" />
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            No hay receta para el código <code className="font-mono">{mtzData.codigo || 'N/A'}</code>.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default MtzTab;
