import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Sparkles, Loader2, Upload, Clock, X, Check } from 'lucide-react';
import { Field, inputCls, textareaCls, Pill } from './shared';
import * as bannerApi from '../../../../utils/bannersData';

const STYLES = [
    { key: 'promo_dark', label: 'Dark Premium', color: '#0a0a0a' },
    { key: 'promo_vibrant', label: 'Vibrante', color: '#e85d3a' },
    { key: 'elegant_minimal', label: 'Minimal', color: '#f5f5f0' },
    { key: 'rustic_italian', label: 'Rústico', color: '#8b5e3c' },
    { key: 'neon_modern', label: 'Neón', color: '#00e676' },
];

const ImageTab = ({ form, setForm, uploading, onImageUpload, appState, menus = [] }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.image.${k}`);

    // AI state
    const [aiStyle, setAiStyle] = useState('promo_dark');
    const [aiHeadline, setAiHeadline] = useState('');
    const [aiPromoText, setAiPromoText] = useState('');
    const [aiSelectedProducts, setAiSelectedProducts] = useState([]); // [{id, nombre, image}]
    const [aiLoading, setAiLoading] = useState(false);
    const [aiPreview, setAiPreview] = useState(null);
    const [aiError, setAiError] = useState(null);

    // History
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Product search
    const [productSearch, setProductSearch] = useState('');

    const filteredMenus = useMemo(() => {
        if (!productSearch.trim()) return menus.slice(0, 12);
        const q = productSearch.toLowerCase();
        return menus.filter(m => (m.nombre || '').toLowerCase().includes(q)).slice(0, 12);
    }, [menus, productSearch]);

    const toggleProduct = (menu) => {
        const code = menu.codigo || menu.id || menu._id || '';
        const img = menu.media_r2 || menu.media_url || '';
        const exists = aiSelectedProducts.find(p => p.id === String(code));
        if (exists) {
            setAiSelectedProducts(prev => prev.filter(p => p.id !== String(code)));
        } else if (aiSelectedProducts.length < 4) {
            setAiSelectedProducts(prev => [...prev, { id: String(code), nombre: menu.nombre, image: img }]);
        }
    };

    const handleAiGenerate = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const token = appState?.token;
            const account = appState?.account;
            const data = {
                headline: aiHeadline,
                promo_text: aiPromoText,
                style: aiStyle,
                image_size: form.image_size || '3:1',
                product_ids: aiSelectedProducts.map(p => p.id),
                product_images: aiSelectedProducts.map(p => p.image).filter(Boolean),
                location_name: '',
                location_desc: '',
                wallet: account,
            };
            const resp = await bannerApi.generateBannerAI({ token, account, data });
            setAiPreview(resp.image_url);
        } catch (err) {
            setAiError(err.message || 'Error generating');
        } finally {
            setAiLoading(false);
        }
    };

    const useAiImage = () => {
        if (aiPreview) {
            setForm(p => ({ ...p, image_url: aiPreview }));
            setAiPreview(null);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const token = appState?.token;
            const account = appState?.account;
            const resp = await bannerApi.fetchBannerAIHistory({ token, account });
            setHistory(resp.items || []);
        } catch { /* silent */ }
        finally { setHistoryLoading(false); }
    };

    useEffect(() => { if (showHistory) loadHistory(); }, [showHistory]);

    return (
        <div className="space-y-5">
            {/* Current / preview */}
            <div className="rounded-2xl overflow-hidden border border-light-border/30 dark:border-dark-border/30 bg-black/5 dark:bg-white/5">
                {form.image_url ? (
                    <img src={form.image_url} alt="Banner" className="w-full h-36 object-cover" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-36 gap-2 opacity-30">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs">{q('no_image')}</span>
                    </div>
                )}
            </div>

            {/* Upload */}
            <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" id="banner-img-upload" />
                <label
                    htmlFor="banner-img-upload"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-sm font-bold cursor-pointer hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent dark:hover:text-white transition-colors"
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {form.image_url ? q('change') : q('upload')}
                </label>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{q('hint')}</span>
            </div>

            {/* ── AI Generator ──────────────────────────────────────────── */}
            <div className="rounded-2xl border border-purple-500/20 p-4 space-y-4 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{q('ai_generate')}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                    >
                        <Clock className="w-3 h-3" />
                        Historial
                    </button>
                </div>

                {/* Style picker */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Estilo</span>
                    <div className="flex gap-1.5">
                        {STYLES.map(s => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => setAiStyle(s.key)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-all
                                    ${aiStyle === s.key
                                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                        : 'border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:border-purple-500/30'
                                    }`}
                            >
                                <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ background: s.color }} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product selector */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        Platos ({aiSelectedProducts.length}/4)
                    </span>

                    {/* Selected products */}
                    {aiSelectedProducts.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {aiSelectedProducts.map(p => (
                                <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    {p.image && <img src={p.image} alt="" className="w-5 h-5 rounded object-cover" />}
                                    <span className="text-[10px] font-semibold text-light-text-primary dark:text-dark-text-primary max-w-[100px] truncate">{p.nombre}</span>
                                    <button type="button" onClick={() => toggleProduct({ codigo: p.id })} className="hover:text-red-500 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search */}
                    <input
                        className={inputCls}
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Buscar platos para agregar..."
                    />

                    {/* Product grid */}
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                        {filteredMenus.map(m => {
                            const code = String(m.codigo || m.id || m._id || '');
                            const selected = aiSelectedProducts.find(p => p.id === code);
                            const img = m.media_r2 || m.media_url || '';
                            return (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => toggleProduct(m)}
                                    disabled={!selected && aiSelectedProducts.length >= 4}
                                    className={`relative rounded-lg overflow-hidden border transition-all disabled:opacity-30
                                        ${selected
                                            ? 'border-purple-500 ring-1 ring-purple-500/30'
                                            : 'border-light-border/20 dark:border-dark-border/20 hover:border-purple-500/30'
                                        }`}
                                >
                                    {img ? (
                                        <img src={img} alt="" className="w-full aspect-square object-cover" />
                                    ) : (
                                        <div className="w-full aspect-square bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                                            <ImageIcon className="w-3 h-3 opacity-30" />
                                        </div>
                                    )}
                                    {selected && (
                                        <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    <div className="px-1 py-0.5 bg-black/60 absolute bottom-0 left-0 right-0">
                                        <span className="text-[8px] text-white line-clamp-1">{m.nombre}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Headline + promo */}
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Título">
                        <input
                            className={inputCls}
                            value={aiHeadline}
                            onChange={e => setAiHeadline(e.target.value)}
                            placeholder="Ej: Oferta Especial"
                        />
                    </Field>
                    <Field label="Texto Promo">
                        <input
                            className={inputCls}
                            value={aiPromoText}
                            onChange={e => setAiPromoText(e.target.value)}
                            placeholder="Ej: 2x1 en Pizzas"
                        />
                    </Field>
                </div>

                {/* Generate button */}
                <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-bold disabled:opacity-40 hover:from-purple-600 hover:to-blue-600 transition-all flex items-center justify-center gap-2"
                >
                    {aiLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> {q('ai_generating')}</>
                    ) : (
                        <><Sparkles className="w-4 h-4" /> {q('ai_generate')}</>
                    )}
                </button>

                {aiError && (
                    <p className="text-xs text-red-500 px-1">{aiError}</p>
                )}

                {/* Preview */}
                {aiPreview && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <img src={aiPreview} alt="AI Generated" className="w-full h-32 object-cover rounded-xl border border-purple-500/20" />
                        <button
                            type="button"
                            onClick={useAiImage}
                            className="w-full py-2 rounded-xl bg-matrix-green text-white text-sm font-bold shadow-neon hover:scale-[1.02] transition-transform"
                        >
                            {q('ai_use')}
                        </button>
                    </div>
                )}
            </div>

            {/* ── History ───────────────────────────────────────────────── */}
            {showHistory && (
                <div className="rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Historial AI</span>
                        {historyLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-light-text-secondary" />}
                    </div>
                    {history.length === 0 && !historyLoading ? (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-50">Sin generaciones previas</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {history.map(item => (
                                <button
                                    key={item.generation_id}
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, image_url: item.image_url }))}
                                    className="rounded-xl overflow-hidden border border-light-border/20 dark:border-dark-border/20 hover:border-purple-500/40 transition-all group"
                                >
                                    <img src={item.image_url} alt="" className="w-full aspect-[3/1] object-cover group-hover:scale-105 transition-transform" />
                                    <div className="px-1.5 py-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
                                        <span className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">
                                            {item.prompt_headline || item.style || 'Banner'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageTab;
