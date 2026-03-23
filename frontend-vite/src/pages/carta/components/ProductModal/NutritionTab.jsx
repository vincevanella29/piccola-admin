/**
 * NutritionTab — AI-generated nutrition facts
 * Now uses theme-aware classes instead of hardcoded dark-only white/X colors
 */
import React, { useState, useEffect } from 'react';
import {
    Loader2, Sparkles, Check, RotateCcw, Apple, Flame, Beef,
    Wheat, Droplets, AlertTriangle, Info,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isNum = (n) => typeof n === 'number' && isFinite(n);
const fmt = (n, d = 1) => isNum(n) ? n.toFixed(d) : '—';
const fmtInt = (n) => isNum(n) ? Math.round(n).toLocaleString('es-CL') : '—';

// FDA Daily Values (2000 kcal diet)
const DV = {
    grasas_totales_g: 78, grasas_saturadas_g: 20, colesterol_mg: 300,
    sodio_mg: 2300, carbohidratos_g: 275, fibra_g: 28, azucares_g: 50,
    proteinas_g: 50, vitamina_d_mcg: 20, calcio_mg: 1300,
    hierro_mg: 18, potasio_mg: 4700,
};
const dvPct = (val, key) => {
    if (!isNum(val) || !DV[key]) return null;
    return Math.round((val / DV[key]) * 100);
};

// ── Nutrition Row ─────────────────────────────────────────────────────────────
const NRow = ({ label, value, unit, dvKey, bold = false, indent = false, thick = false }) => {
    const pct = dvKey ? dvPct(value, dvKey) : null;
    return (
        <div className={`flex items-center justify-between py-1.5 ${thick ? 'border-t-2 border-light-border dark:border-dark-border' : 'border-t border-light-border/50 dark:border-dark-border/30'} ${indent ? 'pl-5' : ''}`}>
            <span className={`text-[11px] ${bold ? 'font-bold text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {label}
            </span>
            <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono ${bold ? 'font-bold text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {fmt(value)}{unit}
                </span>
                {pct !== null && (
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-lg ${
                        pct >= 20 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-light-text-secondary/40 dark:text-dark-text-secondary/40 bg-light-surface-secondary dark:bg-dark-surface-secondary'
                    }`}>
                        {pct}%
                    </span>
                )}
            </div>
        </div>
    );
};

// ── Macro Card ────────────────────────────────────────────────────────────────
const MacroCard = ({ icon: Icon, label, value, unit, color, pct }) => {
    const colors = {
        orange: 'text-orange-500 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
        blue:   'text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
        red:    'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20',
        green:  'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
    return (
        <div className={`flex flex-col items-center p-3 rounded-2xl border ${colors[color]}`}>
            <Icon className="w-4 h-4 mb-1" />
            <span className="text-lg font-bold font-mono">{fmt(value, 0)}</span>
            <span className="text-[9px] opacity-60">{unit}</span>
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
            {isNum(pct) && (
                <span className="text-[8px] opacity-40 mt-0.5">{pct}% VD</span>
            )}
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const NutritionTab = ({ product, token, account, mtzData }) => {
    const [nutrition, setNutrition]     = useState(null);
    const [preview, setPreview]         = useState(null);
    const [loading, setLoading]         = useState(true);
    const [generating, setGenerating]   = useState(false);
    const [accepting, setAccepting]     = useState(false);
    const [error, setError]             = useState(null);
    const [isPasta, setIsPasta]         = useState(false);

    // Fetch existing nutrition on mount
    useEffect(() => {
        if (!product?.id) return;
        setLoading(true);
        cartaApi.fetchProductNutrition({ token, account, productId: product.id })
            .then(data => {
                if (data?.nutrition) setNutrition(data.nutrition);
            })
            .catch(err => console.error('[NutritionTab] fetch error:', err))
            .finally(() => setLoading(false));
    }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerate = async () => {
        setGenerating(true); setError(null);
        try {
            const receta = mtzData?.receta || [];
            const payload = {
                product_id: product.id,
                nombre: product.nombre,
                categoria: product.categoria || '',
                precio: product.precio,
                codigo: product.codigo || '',
                receta: receta.length > 0 ? receta.map(r => ({
                    ingrediente: r.ingrediente,
                    cantidad: parseFloat(r.cantidad) || 0,
                    unidad: r.unidad || 'un',
                    costo: parseFloat(r.costo) || 0,
                })) : undefined,
            };
            const res = await cartaApi.generateProductNutrition({ token, account, payload });
            setPreview(res.nutrition);
            setIsPasta(res.is_pasta);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Error generando nutrición');
        } finally { setGenerating(false); }
    };

    const handleAccept = async () => {
        if (!preview) return;
        setAccepting(true);
        try {
            await cartaApi.acceptProductNutrition({
                token, account,
                payload: { product_id: product.id, nutrition: preview },
            });
            setNutrition(preview);
            setPreview(null);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Error guardando nutrición');
        } finally { setAccepting(false); }
    };

    const data = preview || nutrition;

    // ── Loading ───────────────────────────────────────────────────────────
    if (loading) return (
        <div className="py-14 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400" />
        </div>
    );

    // ── No data → Generate button ─────────────────────────────────────────
    if (!data) {
        const hasRecipe = (mtzData?.receta || []).length > 0;
        return (
            <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <Apple className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">Tabla Nutricional</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto">
                        {hasRecipe
                            ? `Genera la tabla nutricional basada en la receta del producto (${mtzData.receta.length} ingredientes).`
                            : 'No hay receta disponible. Verifica que el producto tenga un código con receta asociada.'}
                    </p>
                </div>

                {error && (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs mx-auto max-w-sm">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <button onClick={handleGenerate} disabled={generating || !hasRecipe}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
                    {generating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando con IA...</>
                        : <><Sparkles className="w-4 h-4" /> Generar con IA</>}
                </button>
            </div>
        );
    }

    // ── Show nutrition data ───────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Preview badge */}
            {preview && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Vista previa — revisa y acepta para guardar
                    </span>
                    {isPasta && (
                        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                            🍝 Pasta fresca
                        </span>
                    )}
                </div>
            )}

            {/* Saved badge */}
            {!preview && nutrition && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Tabla nutricional guardada
                    </span>
                </div>
            )}

            {/* Macro overview cards */}
            <div className="grid grid-cols-4 gap-2">
                <MacroCard icon={Flame} label="Calorías" value={data.calorias} unit="kcal" color="orange" />
                <MacroCard icon={Beef} label="Proteínas" value={data.proteinas_g} unit="g" color="red" pct={dvPct(data.proteinas_g, 'proteinas_g')} />
                <MacroCard icon={Wheat} label="Carbos" value={data.carbohidratos_g} unit="g" color="blue" pct={dvPct(data.carbohidratos_g, 'carbohidratos_g')} />
                <MacroCard icon={Droplets} label="Grasas" value={data.grasas_totales_g} unit="g" color="green" pct={dvPct(data.grasas_totales_g, 'grasas_totales_g')} />
            </div>

            {/* Portion */}
            {isNum(data.porcion_g) && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                    <Info className="w-3 h-3" />
                    Porción: {fmtInt(data.porcion_g)}g
                </div>
            )}

            {/* Detailed nutrition — FDA style */}
            <div className="rounded-2xl border-2 border-light-border dark:border-dark-border overflow-hidden">
                <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 px-4 py-2.5">
                    <h4 className="text-xs font-black text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">
                        Información Nutricional
                    </h4>
                    <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        Valores por porción • % Valor Diario basado en dieta de 2.000 kcal
                    </p>
                </div>
                <div className="px-4 py-1">
                    <NRow label="Calorías" value={data.calorias} unit=" kcal" bold thick />
                    <NRow label="Grasas Totales" value={data.grasas_totales_g} unit="g" bold dvKey="grasas_totales_g" thick />
                    <NRow label="Grasas Saturadas" value={data.grasas_saturadas_g} unit="g" indent dvKey="grasas_saturadas_g" />
                    <NRow label="Grasas Trans" value={data.grasas_trans_g} unit="g" indent />
                    <NRow label="Colesterol" value={data.colesterol_mg} unit="mg" bold dvKey="colesterol_mg" />
                    <NRow label="Sodio" value={data.sodio_mg} unit="mg" bold dvKey="sodio_mg" />
                    <NRow label="Carbohidratos" value={data.carbohidratos_g} unit="g" bold dvKey="carbohidratos_g" thick />
                    <NRow label="Fibra Dietética" value={data.fibra_g} unit="g" indent dvKey="fibra_g" />
                    <NRow label="Azúcares" value={data.azucares_g} unit="g" indent dvKey="azucares_g" />
                    <NRow label="Proteínas" value={data.proteinas_g} unit="g" bold dvKey="proteinas_g" thick />

                    <div className="border-t-2 border-light-border dark:border-dark-border mt-1 pt-1">
                        {isNum(data.vitamina_d_mcg) && <NRow label="Vitamina D" value={data.vitamina_d_mcg} unit="mcg" dvKey="vitamina_d_mcg" />}
                        {isNum(data.calcio_mg) && <NRow label="Calcio" value={data.calcio_mg} unit="mg" dvKey="calcio_mg" />}
                        {isNum(data.hierro_mg) && <NRow label="Hierro" value={data.hierro_mg} unit="mg" dvKey="hierro_mg" />}
                        {isNum(data.potasio_mg) && <NRow label="Potasio" value={data.potasio_mg} unit="mg" dvKey="potasio_mg" />}
                    </div>
                </div>
            </div>

            {/* Notes */}
            {data.notas && (
                <div className="px-3 py-2.5 rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/20 border border-light-border/50 dark:border-dark-border/30">
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                        <Info className="w-3 h-3 inline mr-1 -mt-0.5 opacity-50" />
                        {data.notas}
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                {preview ? (
                    <>
                        <button onClick={() => { setPreview(null); handleGenerate(); }} disabled={generating}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors disabled:opacity-40">
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Regenerar
                        </button>
                        <button onClick={handleAccept} disabled={accepting}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Aceptar y Guardar
                        </button>
                    </>
                ) : (
                    <button onClick={handleGenerate} disabled={generating}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors disabled:opacity-40">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        Regenerar tabla nutricional
                    </button>
                )}
            </div>
        </div>
    );
};

export default NutritionTab;
