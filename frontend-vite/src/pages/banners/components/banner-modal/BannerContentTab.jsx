/**
 * BannerContentTab — Todo lo visual del banner en un solo lugar
 * Título + descripción inline, imagen (upload/AI/historial), tamaño auto-detect,
 * botón CTA con preview. Zero tabs innecesarios.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image as ImageIcon, Sparkles, Loader2, Upload, Clock, X, Check,
    MousePointer, Maximize2, Type,
} from 'lucide-react';
import { Field, inputCls, Pill } from './shared';
import * as bannerApi from '../../../../utils/bannersData';

const STYLES = [
    { key: 'promo_dark', label: 'Dark', color: '#0a0a0a' },
    { key: 'promo_vibrant', label: 'Vibrante', color: '#e85d3a' },
    { key: 'elegant_minimal', label: 'Minimal', color: '#f5f5f0' },
    { key: 'rustic_italian', label: 'Rústico', color: '#8b5e3c' },
    { key: 'neon_modern', label: 'Neón', color: '#00e676' },
];

const IMAGE_SIZES = [
    { key: '3:1',  label: '3:1',  w: 60, h: 20 },
    { key: '2:1',  label: '2:1',  w: 50, h: 25 },
    { key: '16:9', label: '16:9', w: 48, h: 27 },
    { key: '4:3',  label: '4:3',  w: 40, h: 30 },
    { key: '1:1',  label: '1:1',  w: 30, h: 30 },
];

const BTN_POSITIONS = [
    { key: 'bottom-left', label: '↙' },
    { key: 'bottom-center', label: '↓' },
    { key: 'bottom-right', label: '↘' },
    { key: 'center', label: '⊕' },
];

const BTN_STYLES = [
    { key: 'solid', label: 'Sólido' },
    { key: 'outline', label: 'Borde' },
    { key: 'glass', label: 'Glass' },
];

// Auto-detect aspect ratio from image dimensions
const detectAspectRatio = (w, h) => {
    if (!w || !h) return null;
    const r = w / h;
    if (r >= 2.5)  return '3:1';
    if (r >= 1.7)  return '2:1';
    if (r >= 1.5)  return '16:9';
    if (r >= 1.15) return '4:3';
    return '1:1';
};

const BannerContentTab = ({ form, setForm, uploading, onImageUpload, appState, menus = [] }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.${k}`);
    const qs = (k) => t(`banners.settings.${k}`);
    const qi = (k) => t(`banners.image.${k}`);

    // AI
    const [aiStyle, setAiStyle] = useState('promo_dark');
    const [aiHeadline, setAiHeadline] = useState('');
    const [aiPromoText, setAiPromoText] = useState('');
    const [aiProducts, setAiProducts] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiPreview, setAiPreview] = useState(null);
    const [aiError, setAiError] = useState(null);
    const [showAi, setShowAi] = useState(false);

    // History — always loaded
    const [history, setHistory] = useState([]);
    const [histLoading, setHistLoading] = useState(false);

    // Product search
    const [search, setSearch] = useState('');

    const btn = form.button_config || {};
    const setBtn = (u) => setForm(p => ({ ...p, button_config: { ...p.button_config, ...u } }));

    // Auto-detect image size
    const handleImageLoad = useCallback((e) => {
        const { naturalWidth: w, naturalHeight: h } = e.target;
        const detected = detectAspectRatio(w, h);
        if (detected && detected !== form.image_size) {
            setForm(p => ({ ...p, image_size: detected }));
        }
    }, [form.image_size, setForm]);

    // Load history on mount
    useEffect(() => {
        const load = async () => {
            setHistLoading(true);
            try {
                const resp = await bannerApi.fetchBannerAIHistory({
                    token: appState?.token, account: appState?.account,
                });
                setHistory(resp.items || []);
            } catch { /* silent */ }
            finally { setHistLoading(false); }
        };
        if (appState?.token) load();
    }, [appState?.token]);

    const filteredMenus = useMemo(() => {
        if (!search.trim()) return menus.slice(0, 8);
        const q = search.toLowerCase();
        return menus.filter(m => (m.nombre || '').toLowerCase().includes(q)).slice(0, 8);
    }, [menus, search]);

    const toggleProduct = (menu) => {
        const code = String(menu.codigo || menu.id || menu._id || '');
        const img = menu.media_r2 || menu.media_url || '';
        const exists = aiProducts.find(p => p.id === code);
        if (exists) setAiProducts(prev => prev.filter(p => p.id !== code));
        else if (aiProducts.length < 4) setAiProducts(prev => [...prev, { id: code, nombre: menu.nombre, image: img }]);
    };

    const handleAiGenerate = async () => {
        setAiLoading(true); setAiError(null);
        try {
            const resp = await bannerApi.generateBannerAI({
                token: appState?.token, account: appState?.account,
                data: {
                    headline: aiHeadline, promo_text: aiPromoText, style: aiStyle,
                    image_size: form.image_size || '3:1',
                    product_ids: aiProducts.map(p => p.id),
                    product_images: aiProducts.map(p => p.image).filter(Boolean),
                    wallet: appState?.account,
                },
            });
            if (resp.image_url) {
                setForm(p => ({ ...p, image_url: resp.image_url }));
                setAiPreview(null);
                // Refresh history
                const h = await bannerApi.fetchBannerAIHistory({ token: appState?.token, account: appState?.account });
                setHistory(h.items || []);
            }
        } catch (err) { setAiError(err.message || 'Error'); }
        finally { setAiLoading(false); }
    };

    return (
        <div className="space-y-5">
            {/* ── Title + Active ──────────────────────────────────────── */}
            <div className="flex gap-3 items-start">
                <div className="flex-1">
                    <input
                        className={inputCls}
                        value={form.title}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        placeholder={q('general.title_placeholder')}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                    className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                        ${form.active
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}
                >
                    {form.active ? q('active') : q('inactive')}
                </button>
            </div>

            {/* Description — compact */}
            <textarea
                className={`${inputCls} resize-none h-16`}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={q('general.description_placeholder')}
            />

            {/* ── Image Preview + Size auto-detect ───────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-light-border/30 dark:border-dark-border/30 bg-black/5 dark:bg-white/5 relative">
                {form.image_url ? (
                    <img
                        src={form.image_url} alt="Banner"
                        className="w-full max-h-48 object-cover"
                        onLoad={handleImageLoad}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-30">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs">{qi('no_image')}</span>
                    </div>
                )}
                {/* Size badge */}
                {form.image_url && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono font-bold">
                        {form.image_size}
                    </span>
                )}
            </div>

            {/* Upload + Size selector */}
            <div className="flex items-center gap-3 flex-wrap">
                <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" id="banner-img-up" />
                <label htmlFor="banner-img-up" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-xs font-bold cursor-pointer hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent dark:hover:text-white transition-colors">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {qi('upload')}
                </label>
                <div className="flex gap-1">
                    {IMAGE_SIZES.map(s => (
                        <button key={s.key} type="button" onClick={() => setForm(p => ({ ...p, image_size: s.key }))}
                            className={`flex flex-col items-center p-1.5 rounded-lg border transition-all
                                ${form.image_size === s.key
                                    ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10'
                                    : 'border-light-border/20 dark:border-dark-border/20 hover:border-light-accent/30'
                                }`}>
                            <div className={`rounded-sm ${form.image_size === s.key ? 'bg-light-accent/30 dark:bg-dark-accent/30' : 'bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40'}`}
                                style={{ width: s.w / 3, height: s.h / 3 }} />
                            <span className="text-[8px] font-mono font-bold mt-0.5">{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── AI Generator Toggle ────────────────────────────────── */}
            <button
                type="button" onClick={() => setShowAi(!showAi)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5 text-sm font-bold text-purple-600 dark:text-purple-400 hover:from-purple-500/10 hover:to-blue-500/10 transition-all"
            >
                <Sparkles className="w-4 h-4" /> {qi('ai_generate')}
            </button>

            {showAi && (
                <div className="rounded-2xl border border-purple-500/20 p-4 space-y-3 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Style + Size row */}
                    <div className="flex gap-1.5 flex-wrap">
                        {STYLES.map(s => (
                            <button key={s.key} type="button" onClick={() => setAiStyle(s.key)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all
                                    ${aiStyle === s.key ? 'border-purple-500 bg-purple-500/10 text-purple-500 dark:text-purple-400'
                                        : 'border-light-border/20 dark:border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary hover:border-purple-500/30'}`}>
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Products */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                            Platos ({aiProducts.length}/4)
                        </span>
                        {aiProducts.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                                {aiProducts.map(p => (
                                    <span key={p.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-semibold">
                                        {p.image && <img src={p.image} alt="" className="w-4 h-4 rounded object-cover" />}
                                        <span className="max-w-[80px] truncate">{p.nombre}</span>
                                        <button type="button" onClick={() => toggleProduct({ codigo: p.id })}><X className="w-2.5 h-2.5 hover:text-red-500" /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <input className={`${inputCls} !py-1.5 !text-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar platos..." />
                        <div className="grid grid-cols-4 gap-1 max-h-24 overflow-y-auto">
                            {filteredMenus.map(m => {
                                const code = String(m.codigo || m.id || m._id || '');
                                const sel = aiProducts.find(p => p.id === code);
                                const img = m.media_r2 || m.media_url || '';
                                return (
                                    <button key={code} type="button" onClick={() => toggleProduct(m)}
                                        disabled={!sel && aiProducts.length >= 4}
                                        className={`relative rounded-lg overflow-hidden border transition-all disabled:opacity-25
                                            ${sel ? 'border-purple-500 ring-1 ring-purple-500/30' : 'border-light-border/15 dark:border-dark-border/15'}`}>
                                        {img ? <img src={img} alt="" className="w-full aspect-square object-cover" />
                                            : <div className="w-full aspect-square bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center"><ImageIcon className="w-3 h-3 opacity-30" /></div>}
                                        {sel && <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>}
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-0.5 py-px"><span className="text-[7px] text-white line-clamp-1">{m.nombre}</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Headline + Promo */}
                    <div className="grid grid-cols-2 gap-2">
                        <input className={`${inputCls} !py-1.5 !text-xs`} value={aiHeadline} onChange={e => setAiHeadline(e.target.value)} placeholder="Título del banner" />
                        <input className={`${inputCls} !py-1.5 !text-xs`} value={aiPromoText} onChange={e => setAiPromoText(e.target.value)} placeholder="Ej: 2x1 en Pizzas" />
                    </div>

                    <button type="button" onClick={handleAiGenerate} disabled={aiLoading}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold disabled:opacity-40 hover:from-purple-600 hover:to-blue-600 transition-all flex items-center justify-center gap-2">
                        {aiLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><Sparkles className="w-3.5 h-3.5" /> Generar con IA</>}
                    </button>
                    {aiError && <p className="text-[10px] text-red-500">{aiError}</p>}
                </div>
            )}

            {/* ── AI History — always visible if items exist ──────────── */}
            {history.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />
                        <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                            Historial AI ({history.length})
                        </span>
                        {histLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                        {history.map(item => (
                            <button key={item.generation_id} type="button"
                                onClick={() => setForm(p => ({ ...p, image_url: item.image_url }))}
                                className={`rounded-xl overflow-hidden border transition-all group
                                    ${form.image_url === item.image_url
                                        ? 'border-purple-500 ring-1 ring-purple-500/30'
                                        : 'border-light-border/15 dark:border-dark-border/15 hover:border-purple-500/30'
                                    }`}>
                                <img src={item.image_url} alt="" className="w-full aspect-[3/1] object-cover group-hover:scale-105 transition-transform" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── CTA Button + URL ──────────────────────────────────── */}
            <div className="rounded-xl border border-light-border/30 dark:border-dark-border/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <MousePointer className="w-3 h-3 text-light-accent dark:text-dark-accent" />
                        <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">{qs('button_title')}</span>
                    </div>
                    <button type="button" onClick={() => setBtn({ visible: !btn.visible })}
                        className={`relative w-9 h-5 rounded-full transition-colors ${btn.visible ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${btn.visible ? 'translate-x-4' : ''}`} />
                    </button>
                </div>
                {btn.visible && (
                    <div className="space-y-2 animate-in fade-in duration-150">
                        <div className="flex gap-2 items-end flex-wrap">
                            <input className={`${inputCls} !py-1.5 !text-xs flex-1 min-w-[120px]`} value={btn.text || ''} onChange={e => setBtn({ text: e.target.value })} placeholder={qs('button_text_placeholder')} />
                            <div className="flex gap-1">
                                {BTN_POSITIONS.map(p => (
                                    <button key={p.key} type="button" onClick={() => setBtn({ position: p.key })}
                                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${btn.position === p.key ? 'bg-light-accent dark:bg-dark-accent text-white' : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50'}`}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                {BTN_STYLES.map(s => (
                                    <button key={s.key} type="button" onClick={() => setBtn({ style: s.key })}
                                        className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${btn.style === s.key ? 'bg-light-accent dark:bg-dark-accent text-white' : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50'}`}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                            <input type="color" value={btn.color || '#22c55e'} onChange={e => setBtn({ color: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0" />
                            <input type="color" value={btn.text_color || '#ffffff'} onChange={e => setBtn({ text_color: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0" title="Texto" />
                        </div>
                        {/* Click URL — belongs with the button */}
                        <input className={`${inputCls} !py-1.5 !text-xs`} value={form.click_url || ''}
                            onChange={e => setForm(p => ({ ...p, click_url: e.target.value }))}
                            placeholder={qs('click_url_placeholder')} />
                    </div>
                )}
                {/* URL always accessible even without button */}
                {!btn.visible && (
                    <input className={`${inputCls} !py-1.5 !text-xs`} value={form.click_url || ''}
                        onChange={e => setForm(p => ({ ...p, click_url: e.target.value }))}
                        placeholder={`${qs('click_url')} — https://...`} />
                )}
            </div>
        </div>
    );
};

export default BannerContentTab;
