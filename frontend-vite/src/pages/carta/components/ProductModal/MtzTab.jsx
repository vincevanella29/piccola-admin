/**
 * MtzTab — Rentabilidad + Receta · Apple dark-glass style
 * Sigue el patrón del ProductModal de menus/components/ProductModal.jsx:
 *  - MetricCards con TrendBadge
 *  - Selector de periodo
 *  - Economía unitaria (precio venta / cupro / margen)
 *  - Tabla de receta con barra de % de costo
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
const fmtPct = (n) => isNum(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—';

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
    if (!isNum(delta)) return <span className="text-white/30 text-[10px]">—</span>;
    const isPositive = delta > 0;
    const isGood = inverse ? !isPositive : isPositive;
    const color = delta === 0
        ? 'text-white/50 bg-white/8'
        : isGood
            ? 'text-emerald-400 bg-emerald-500/15'
            : 'text-red-400 bg-red-500/15';
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
        blue:   'text-blue-400 bg-blue-500/15',
        green:  'text-emerald-400 bg-emerald-500/15',
        purple: 'text-violet-400 bg-violet-500/15',
        orange: 'text-orange-400 bg-orange-500/15',
        red:    'text-red-400 bg-red-500/15',
    };
    return (
        <div className="flex flex-col p-3.5 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-xl ${colorMap[color] || colorMap.blue}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <TrendBadge delta={delta} inverse={inverse} />
            </div>
            <p className="text-[10px] text-white/40 font-medium">{label}</p>
            <p className="text-lg font-bold text-white/90 mt-0.5 leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-white/30 font-mono mt-0.5">{sub}</p>}
        </div>
    );
};

// ── Period selector ───────────────────────────────────────────────────────────

const PeriodBtn = ({ label, active, onClick }) => (
    <button onClick={onClick}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
            active
                ? 'bg-white text-black shadow-md'
                : 'text-white/50 hover:text-white/80 hover:bg-white/8'
        }`}>
        {label}
    </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const MtzTab = ({ mtzData, loading }) => {
    const { t } = useTranslation();
    const [periodIdx, setPeriodIdx] = useState(0); // 0 = más reciente

    if (loading) return (
        <div className="py-14 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
    );

    if (!mtzData) return (
        <div className="py-14 text-center space-y-3">
            <BarChart2 className="w-9 h-9 opacity-15 mx-auto text-white" />
            <p className="text-sm text-white/40">Sin datos MTZ — verifica que el código del producto coincida.</p>
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

    // Derived for selected period
    const cantidad     = curr.cantidad;
    const totalVenta   = curr.total_venta;
    const totalMargen  = curr.total_margen;
    const marginPct    = curr.margin_pct;
    const cupro        = curr.cupro;
    const puven        = curr.puven || precioProducto;
    const margenUnit   = isNum(puven) && isNum(cupro) ? puven - cupro : null;

    // Deltas vs previous period
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
                    <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                        <Star className="w-2.5 h-2.5 fill-amber-400" /> Prioridad #{prioridad}
                    </span>
                )}
                {estado
                    ? <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold"><CheckCircle className="w-2.5 h-2.5" /> Activo</span>
                    : <span className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold"><XCircle className="w-2.5 h-2.5" /> Inactivo</span>
                }
                {mtzData.codigo && (
                    <span className="px-2 py-1 rounded-xl bg-white/5 border border-white/8 text-white/40 font-mono text-[10px]">
                        {mtzData.codigo}
                    </span>
                )}
            </div>

            {/* ── Rentabilidad ────────────────────────────────────────── */}
            {rentabilidad.length > 0 ? (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-white/70 uppercase tracking-wide">Rendimiento de Ventas</h4>
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
                        <MetricCard
                            label="Unidades vendidas"
                            value={fmtNum(cantidad)}
                            sub={prev ? `Anterior: ${fmtNum(prev.cantidad)}` : undefined}
                            delta={deltaCantidad}
                            icon={BarChart2}
                            color="purple"
                        />
                        <MetricCard
                            label="Ventas totales"
                            value={CLP(totalVenta)}
                            sub={prev ? `Anterior: ${CLP(prev.total_venta)}` : undefined}
                            delta={deltaVenta}
                            icon={TrendingUp}
                            color="blue"
                        />
                        <MetricCard
                            label="Margen total"
                            value={CLP(totalMargen)}
                            sub={prev ? `Anterior: ${CLP(prev.total_margen)}` : undefined}
                            delta={deltaMargen}
                            icon={TrendingUp}
                            color="green"
                        />
                        <MetricCard
                            label="% Margen"
                            value={isNum(marginPct) ? `${marginPct.toFixed(1)}%` : '—'}
                            sub={prev && isNum(prev.margin_pct) ? `Anterior: ${prev.margin_pct.toFixed(1)}%` : undefined}
                            delta={deltaMarginPct}
                            icon={TrendingUp}
                            color="orange"
                        />
                    </div>

                    {/* Unit economics */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/8 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-white/30">Economía Unitaria</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-white/40 mb-0.5">P. Venta</p>
                                <p className="text-base font-bold text-white/80 font-mono">{CLP(puven)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/40 mb-0.5">Costo Unitario</p>
                                <p className="text-base font-bold text-red-400 font-mono">{cupro ? `- ${CLP(cupro)}` : '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/40 mb-0.5">Margen Unit.</p>
                                <p className={`text-base font-bold font-mono ${isNum(margenUnit) && margenUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isNum(margenUnit) ? `${margenUnit >= 0 ? '+' : ''}${CLP(margenUnit)}` : '—'}
                                </p>
                            </div>
                        </div>
                        {/* Margin bar */}
                        {isNum(marginPct) && (
                            <div>
                                <div className="flex justify-between text-[9px] text-white/30 mb-1">
                                    <span>Margen s/venta</span>
                                    <span>{marginPct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${marginPct < 0 ? 'bg-red-500' : marginPct < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, marginPct))}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* By-location breakdown (collapsed pill list) */}
                    {curr.locales?.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wide">Por local</p>
                            <div className="space-y-1">
                                {curr.locales.map((loc, i) => (
                                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/6 text-[10px]">
                                        <span className="text-white/50 truncate max-w-[60%]">{loc.centroproduccion || 'Sin nombre'}</span>
                                        <span className="text-white/70 font-semibold font-mono shrink-0">{fmtNum(loc.cantidad)} un.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            ) : (
                <div className="py-6 text-center space-y-2">
                    <Info className="w-7 h-7 opacity-15 mx-auto text-white" />
                    <p className="text-xs text-white/30">Sin datos de ventas para este producto.</p>
                </div>
            )}

            {/* ── Receta ──────────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white/70 uppercase tracking-wide">Receta y Costos</h4>
                    {receta.length > 0 && (
                        <span className="ml-auto text-[10px] text-white/30 font-mono">
                            Total: {CLP(receta.reduce((s, i) => s + (i.costo || 0), 0))}
                        </span>
                    )}
                </div>

                {receta.length > 0 ? (
                    <div className="rounded-2xl border border-white/8 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/8">
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wide">Ingrediente</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-white/40 uppercase tracking-wide">Cant.</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-white/40 uppercase tracking-wide">Costo</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-white/40 uppercase tracking-wide">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {receta.map((ing, i) => (
                                    <tr key={i} className="hover:bg-white/4 transition-colors group">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                {/* Cost bar */}
                                                <div className="w-1.5 rounded-full bg-white/10 overflow-hidden self-stretch" style={{ minHeight: 16 }}>
                                                    <div
                                                        className="w-full bg-amber-400/60 rounded-full"
                                                        style={{ height: `${ing.pct_costo || 0}%` }}
                                                    />
                                                </div>
                                                <span className="font-medium text-white/80">{ing.ingrediente}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-white/50">
                                            {parseFloat(ing.cantidad).toFixed(3)} <span className="text-white/30">{ing.unidad}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-red-400">{CLP(ing.costo)}</td>
                                        <td className="px-2 py-2 text-right">
                                            {isNum(ing.pct_costo) && (
                                                <span className="text-[10px] text-white/40 font-mono">{ing.pct_costo}%</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-5 text-center space-y-1.5">
                        <Info className="w-6 h-6 opacity-15 mx-auto text-white" />
                        <p className="text-xs text-white/30">
                            No hay receta para el código <code className="font-mono">{mtzData.codigo || 'N/A'}</code>.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default MtzTab;
