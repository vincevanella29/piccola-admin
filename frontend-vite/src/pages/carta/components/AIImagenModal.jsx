/**
 * AIImagenModal — Aurora AI Studio
 * Apple dark-glass style · i18n · Tailwind
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, RefreshCw, Download, Film, Type, History } from 'lucide-react';
import * as cartaApi from '../../../utils/cartaData';
import useAIHistory from '../../../hooks/useAIHistory';

import GalleryPanel from './AIImagenModal/GalleryPanel';
import StyleOptionsPanel from './AIImagenModal/StyleOptionsPanel';
import ResultPanel from './AIImagenModal/ResultPanel';
import HistoryPanel from './AIImagenModal/HistoryPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = { IDLE: 'idle', LOADING: 'loading', RESULT: 'result', ERROR: 'error' };
const MODES  = [
    { id: 'image',       tKey: 'aurora_mode_image',       icon: Sparkles },
    { id: 'description', tKey: 'aurora_mode_description', icon: Type },
    { id: 'video',       tKey: 'aurora_mode_video',       icon: Film },
    { id: 'history',     tKey: 'aurora_mode_history',     icon: History },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const ModeTab = ({ mode, active, onClick }) => {
    const { t } = useTranslation();
    const Icon  = mode.icon;
    return (
        <button onClick={() => onClick(mode.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                active
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/65'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {t(`carta.${mode.tKey}`)}
        </button>
    );
};

// ── Generating screen ──────────────────────────────────────────────────────────
const GeneratingScreen = ({ mode }) => {
    const { t } = useTranslation();
    const msgs = {
        image:       ['Encuadrando la toma…', 'Iluminación de estudio…', 'Aurora generando…', 'Ajustando detalles…'],
        description: ['Analizando el plato…', 'Escribiendo descripción…'],
        video:       ['Preparando la escena…', 'Renderizando cinemática…', 'Aurora Video…'],
    };
    const [msgIdx, setMsgIdx] = React.useState(0);
    const messages = msgs[mode] || msgs.image;
    React.useEffect(() => {
        const id = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 2200);
        return () => clearInterval(id);
    }, [messages.length]);

    return (
        <div className="py-14 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl">
                    {mode === 'video'       ? <Film className="w-9 h-9 text-white" /> :
                     mode === 'description' ? <Type className="w-9 h-9 text-white" /> :
                                             <Sparkles className="w-9 h-9 text-white animate-pulse" />}
                </div>
                <div className="absolute inset-0 rounded-3xl bg-violet-500 opacity-25 blur-xl animate-pulse" />
            </div>
            <div className="text-center space-y-1.5 h-10 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.p key={msgIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="text-sm font-semibold text-white/80">{messages[msgIdx]}</motion.p>
                </AnimatePresence>
                <p className="text-xs text-white/30">
                    {mode === 'video' ? '60–180s' : mode === 'description' ? '10–20s' : '30–90s'}
                </p>
            </div>
            <div className="flex gap-1.5">
                {[0, 0.2, 0.4].map(d => (
                    <motion.div key={d} animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                        className="w-2 h-2 rounded-full bg-violet-400" />
                ))}
            </div>
        </div>
    );
};

// ── Idle content ───────────────────────────────────────────────────────────────
const IdleContent = ({ mode, product, options, selectedRefUrl, onSetStyle, onToggleStyle }) => {
    const { t } = useTranslation();

    if (mode === 'image' || mode === 'video') return (
        <div className="space-y-4">
            {mode === 'video' && (
                <div className="flex items-center gap-2 px-1">
                    <Film className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-white/70">Video cinemático · 4s</span>
                </div>
            )}
            <StyleOptionsPanel options={options} onSet={onSetStyle} onToggle={onToggleStyle} selectedRefUrl={selectedRefUrl} />
        </div>
    );

    if (mode === 'description') return (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold text-white/70">{t('carta.aurora_mode_description')}</span>
            </div>
            {product.descripcion && (
                <div>
                    <p className="text-[10px] font-semibold uppercase text-white/25 mb-1">Actual</p>
                    <p className="text-xs text-white/40 italic">"{product.descripcion}"</p>
                </div>
            )}
            <p className="text-xs text-white/30">Grok reescribirá en español sofisticado · Máx 2 frases</p>
        </div>
    );

    return null;
};

// ── Main Component ────────────────────────────────────────────────────────────

const AIImagenModal = ({ product: initialProduct, categories, token, account, onClose, onUpdated }) => {
    const { t } = useTranslation();
    const [product, setProduct]         = useState(initialProduct);
    const [mode, setMode]               = useState('image');
    const [step, setStep]               = useState(STEPS.IDLE);
    const [result, setResult]           = useState(null);
    const [error, setError]             = useState(null);
    const [feedbackSent, setFeedbackSent] = useState(false);
    // 'idle' | 'saving' | 'saved' | 'rejected' | 'error'
    const [feedbackStatus, setFeedbackStatus] = useState('idle');
    const [selectedRefUrl, setSelectedRefUrl] = useState(null);
    // URL fijada EN EL MOMENTO de la generación — no cambia mientras se muestra el resultado
    const [generationRefUrl, setGenerationRefUrl] = useState(null);

    // Post-accept gallery organizer state
    const [postGallery, setPostGallery]     = useState(null);   // null = no visible aún
    const [isSavingGallery, setIsSavingGallery] = useState(false);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    // Pending AI images: generadas pero aún sin ser promovidas a principal
    // Se acumulan en una lista separada; el usuario puede agregarlas a la galería del producto
    const [pendingAI, setPendingAI] = useState([]);

    // Hook de historial — pages → hooks → utils → backend
    const history = useAIHistory({ token, account, productId: product.id });

    // Cargar historial al montar
    useEffect(() => { history.reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [styleOptions, setStyleOptions] = useState({
        color_recipiente: null,            // null = sin cambio (original)
        color_fondo: 'negro_absoluto',
        mejorar_texturas: true,
        agregar_garnitura: true,
        agregar_branding: false,
    });
    const onSetStyle = (k, v) => setStyleOptions(o => ({ ...o, [k]: v }));
    const onToggleStyle = (k) => setStyleOptions(o => ({ ...o, [k]: !o[k] }));

    // Galería activa del producto
    const gallery = product.media_images || (product.media_r2 ? [product.media_r2] : []);
    const mainImage = product.media_r2 || product.media_url || gallery[0];
    const categoryNames = (product.category_ids || [])
        .map(id => categories?.find(c => c.id === id)?.nombre)
        .filter(Boolean).join(', ');

    const basePayload = useCallback(() => ({
        product_id: product.id,
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        categoria: categoryNames || '',
        codigo: product.codigo || '',
        precio: product.precio || null,
        wallet: account || null,
    }), [product, categoryNames, account]);

    // ── Generators ────────────────────────────────────────────────────────────

    const handleGenerateImage = useCallback(async () => {
        const refForThisGeneration = selectedRefUrl || null;
        setGenerationRefUrl(refForThisGeneration);
        setStep(STEPS.LOADING); setError(null); setResult(null); setFeedbackSent(false); setFeedbackStatus('idle');
        try {
            const data = await cartaApi.generateProductAIImage({
                token, account,
                payload: {
                    ...basePayload(),
                    reference_image_url: refForThisGeneration,
                    use_pro_model: true,
                    add_to_gallery: true,
                    style_options: styleOptions,
                },
            });
            setResult({ type: 'image', ...data });
            // Solo agregar como pendiente AI — NO cambiar media_r2 todavía.
            // La imagen se convierte en principal solo cuando el usuario la acepta (vía organize-media).
            setPendingAI(prev => prev.includes(data.image_url) ? prev : [...prev, data.image_url]);
            setProduct(p => {
                const imgs = [...(p.media_images || (p.media_r2 ? [p.media_r2] : []))];
                if (!imgs.includes(data.image_url)) imgs.push(data.image_url);
                return { ...p, media_images: imgs.slice(-4) };
            });
            setStep(STEPS.RESULT);
            // NO notificar al padre todavía — la imagen aún no es principal
        } catch (e) {
            setError(e?.detail?.message || e?.message || 'Error generando imagen');
            setStep(STEPS.ERROR);
        }
    }, [basePayload, selectedRefUrl, token, account, styleOptions]);

    const handleGenerateDescription = useCallback(async () => {
        setStep(STEPS.LOADING); setError(null); setResult(null); setFeedbackSent(false); setFeedbackStatus('idle');
        try {
            const data = await cartaApi.generateProductAIDescription({
                token, account,
                // ⚠️ update_product: false — NO guardamos hasta que el usuario acepte
                payload: { ...basePayload(), update_product: false },
            });
            setResult({ type: 'description', description: data.description, generation_id: data.generation_id });
            setStep(STEPS.RESULT);
            // NO actualizamos el producto ni notificamos al padre hasta que haya feedback
        } catch (e) {
            setError(e?.detail?.message || e?.message || 'Error generando descripción');
            setStep(STEPS.ERROR);
        }
    }, [basePayload, token, account]);

    const handleGenerateVideo = useCallback(async () => {
        if (!selectedRefUrl) return;
        const refForThisGeneration = selectedRefUrl || null;
        setGenerationRefUrl(refForThisGeneration);
        setStep(STEPS.LOADING); setError(null); setResult(null); setFeedbackSent(false); setFeedbackStatus('idle');
        try {
            const data = await cartaApi.generateProductAIVideo({
                token, account,
                // ⚠️ add_to_product: false — el video se asigna solo al aceptar
                payload: { ...basePayload(), reference_image_url: selectedRefUrl, duration_seconds: 4, add_to_product: false, style_options: styleOptions },
            });
            setResult({ type: 'video', ...data });
            setStep(STEPS.RESULT);
            // NO actualizamos media_video ni notificamos hasta feedback
        } catch (e) {
            setError(e?.detail?.message || e?.message || 'Error generando video');
            setStep(STEPS.ERROR);
        }
    }, [selectedRefUrl, basePayload, token, account, styleOptions]);

    const handleGenerate = () => {
        if (mode === 'image') handleGenerateImage();
        else if (mode === 'description') handleGenerateDescription();
        else if (mode === 'video') handleGenerateVideo();
    };

    const handleFeedback = useCallback(async (accepted) => {
        if (!result?.generation_id || feedbackSent) return;
        setFeedbackSent(true);
        setFeedbackStatus('saving');
        try {
            // ── IMAGEN ────────────────────────────────────────────────────────────
            if (result.type === 'image') {
                if (accepted && result.image_url && product.id) {
                    const currentGallery = (product.media_images || []).filter(u => u !== result.image_url);
                    const orderedImages = [...currentGallery.slice(0, 3), result.image_url];
                    let updatedFields = null;
                    try {
                        const res = await cartaApi.organizeProductMedia({
                            token, account,
                            productId: product.id,
                            images: orderedImages,
                            videoUrl: product.media_video || null,
                        });
                        updatedFields = {
                            media_r2:     res.principal,
                            media_url:    res.principal,
                            media_images: res.images || orderedImages,
                            media_video:  product.media_video || '',
                            updated_at:   res.updated_at,
                        };
                    } catch (organizeErr) {
                        console.error('[AIModal] organize-media error:', organizeErr);
                        updatedFields = {
                            media_r2:     result.image_url,
                            media_url:    result.image_url,
                            media_images: orderedImages,
                        };
                    }
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: true, image_url: result.image_url, wallet: account || null },
                    });
                    setProduct(p => ({ ...p, ...updatedFields }));
                    setFeedbackStatus('saved');
                    setPostGallery(updatedFields.media_images || []);
                    setPendingAI(prev => prev.filter(u => u !== result.image_url));
                    if (onUpdated) onUpdated(product.id, updatedFields);

                } else if (!accepted) {
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: false, image_url: result.image_url, wallet: account || null },
                    });
                    const filteredImgs = (product.media_images || []).filter(u => u !== result.image_url);
                    const newMain = product.media_r2 === result.image_url ? (filteredImgs[0] || '') : product.media_r2;
                    const rejectedFields = { media_images: filteredImgs, media_r2: newMain, media_url: newMain };
                    setProduct(p => ({ ...p, ...rejectedFields }));
                    setFeedbackStatus('rejected');
                    if (onUpdated) onUpdated(product.id, rejectedFields);
                }

            // ── DESCRIPCIÓN ───────────────────────────────────────────────────────
            } else if (result.type === 'description') {
                if (accepted) {
                    // Guardar descripción en el producto (solo ahora, al aceptar)
                    await cartaApi.updateProduct({
                        token, account,
                        productId: product.id,
                        data: { descripcion: result.description },
                    });
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: true, wallet: account || null },
                    });
                    setProduct(p => ({ ...p, descripcion: result.description }));
                    setFeedbackStatus('saved');
                    if (onUpdated) onUpdated(product.id, { descripcion: result.description });
                } else {
                    // Rechazada — solo registrar feedback, el producto NO se toca
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: false, wallet: account || null },
                    });
                    setFeedbackStatus('rejected');
                }

            // ── VIDEO ─────────────────────────────────────────────────────────────
            } else if (result.type === 'video') {
                if (accepted) {
                    // Asignar video al producto (solo al aceptar)
                    await cartaApi.updateProduct({
                        token, account,
                        productId: product.id,
                        data: { media_video: result.video_url },
                    });
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: true, wallet: account || null },
                    });
                    setProduct(p => ({ ...p, media_video: result.video_url }));
                    setFeedbackStatus('saved');
                    if (onUpdated) onUpdated(product.id, { media_video: result.video_url });
                } else {
                    // Rechazado — no asignar video
                    await cartaApi.sendAIImagenFeedback({
                        token, account,
                        payload: { generation_id: result.generation_id, product_id: product.id, accepted: false, wallet: account || null },
                    });
                    setFeedbackStatus('rejected');
                }
            }

            history.reload();
        } catch (err) {
            console.error('[AIModal] handleFeedback:', err);
            setFeedbackSent(false);
            setFeedbackStatus('error');
        }
    }, [result, feedbackSent, product, token, account, onUpdated, history]);


    const handleRemoveFromGallery = useCallback(async (url) => {
        const imgs = (product.media_images || []).filter(u => u !== url);
        const newMain = product.media_r2 === url ? (imgs[0] || '') : product.media_r2;
        setProduct(p => ({ ...p, media_images: imgs, media_r2: newMain, media_url: newMain }));
        if (postGallery) setPostGallery(prev => prev.filter(u => u !== url));
        if (product.id) {
            await cartaApi.updateProduct({ token, account, productId: product.id, data: { media_images: imgs, media_r2: newMain, media_url: newMain } });
        }
    }, [product, postGallery, token, account]);

    // Reordenar galería principal desde GalleryPanel (Drag & Drop) y guardar a CDN
    const handleReorderGallery = useCallback(async (newOrder) => {
        setProduct(p => ({ ...p, media_images: newOrder }));
        setPostGallery(prev => (prev ? newOrder : null));
        if (!product.id || newOrder.length === 0) return;
        try {
            const res = await cartaApi.organizeProductMedia({
                token, account,
                productId: product.id,
                images: newOrder,
                videoUrl: product.media_video || null,
            });
            const updatedFields = {
                media_r2:     res.principal,
                media_url:    res.principal,
                media_images: res.images || newOrder,
                updated_at:   res.updated_at,
            };
            setProduct(p => ({ ...p, ...updatedFields }));
            if (onUpdated) onUpdated(product.id, updatedFields);
        } catch (e) {
            console.error('[AIModal] handleReorderGallery error:', e);
        }
    }, [product.id, product.media_video, token, account, onUpdated]);


    // Agregar imagen AI pendiente a la galería del producto
    const handleAddPendingToGallery = useCallback(async (url) => {
        if (gallery.length >= 4) return;
        const newGallery = [...gallery, url].slice(0, 4);
        setProduct(p => ({ ...p, media_images: newGallery }));
        setPendingAI(prev => prev.filter(u => u !== url));
        if (postGallery) setPostGallery(newGallery);
    }, [gallery, postGallery]);

    // ── History panel actions ─────────────────────────────────────────────────

    // Aceptar imagen del historial (pending/rejected → accepted)
    // Se agrega AL FINAL de las fotos del producto sin alterar el principal
    // Si la galería está llena (4), reemplaza la última foto
    // Si la galería está llena (4), y no es principal, reemplaza la última foto
    const handleAcceptHistory = useCallback(async (item, setMain = false) => {
        if (!item?.image_url || !product.id) return;
        // Construir nueva galería
        const currentGallery = (product.media_images || []).filter(u => u !== item.image_url);
        
        let orderedImages;
        if (setMain) {
            orderedImages = [item.image_url, ...currentGallery].slice(0, 4);
        } else {
            orderedImages = [...currentGallery.slice(0, 3), item.image_url];
        }
        try {
            const res = await cartaApi.organizeProductMedia({
                token, account,
                productId: product.id,
                images: orderedImages,
                videoUrl: product.media_video || null,
            });
            const updatedFields = {
                media_r2:     res.principal,
                media_url:    res.principal,
                media_images: res.images || orderedImages,
                updated_at:   res.updated_at,
            };
            setProduct(p => ({ ...p, ...updatedFields }));
            // Registrar feedback aceptado
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: true, image_url: item.image_url, wallet: account || null },
            });
            if (onUpdated) onUpdated(product.id, updatedFields);
            history.reload();
        } catch (e) {
            console.error('[AIModal] handleAcceptHistory:', e);
        }
    }, [product, token, account, onUpdated, history]);

    // Rechazar imagen del historial (pending → rejected)
    const handleRejectHistory = useCallback(async (item) => {
        if (!item?.generation_id || !product.id) return;
        try {
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: false, image_url: item.image_url, wallet: account || null },
            });
            // Quitar de galería si estaba
            const filteredImgs = (product.media_images || []).filter(u => u !== item.image_url);
            const newMain = product.media_r2 === item.image_url ? (filteredImgs[0] || '') : product.media_r2;
            const rejectedFields = { media_images: filteredImgs, media_r2: newMain, media_url: newMain };
            setProduct(p => ({ ...p, ...rejectedFields }));
            if (onUpdated) onUpdated(product.id, rejectedFields);
            history.reload();
        } catch (e) {
            console.error('[AIModal] handleRejectHistory:', e);
        }
    }, [product, token, account, onUpdated, history]);

    // Hacer principal una imagen aceptada y/o guardar orden de aceptadas
    const handleSetMainHistory = useCallback(async (item, allAccepted) => {
        if (!item?.image_url || !product.id) return;
        const rest = allAccepted.filter(a => a.image_url !== item.image_url).map(a => a.image_url);
        const orderedImages = [item.image_url, ...rest].slice(0, 4);
        try {
            const res = await cartaApi.organizeProductMedia({
                token, account,
                productId: product.id,
                images: orderedImages,
                videoUrl: product.media_video || null,
            });
            const updatedFields = {
                media_r2:     res.principal,
                media_url:    res.principal,
                media_images: res.images || orderedImages,
                updated_at:   res.updated_at,
            };
            setProduct(p => ({ ...p, ...updatedFields }));
            if (onUpdated) onUpdated(product.id, updatedFields);
            history.reload();
        } catch (e) {
            console.error('[AIModal] handleSetMainHistory:', e);
        }
    }, [product, token, account, onUpdated, history]);

    // ── History: video feedback ────────────────────────────────────────────────
    const handleAcceptHistoryVideo = useCallback(async (item) => {
        if (!item?.video_url || !product.id) return;
        try {
            await cartaApi.updateProduct({ token, account, productId: product.id, data: { media_video: item.video_url } });
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: true, wallet: account || null },
            });
            setProduct(p => ({ ...p, media_video: item.video_url }));
            if (onUpdated) onUpdated(product.id, { media_video: item.video_url });
            history.reload();
        } catch (e) { console.error('[AIModal] handleAcceptHistoryVideo:', e); }
    }, [product, token, account, onUpdated, history]);

    const handleRejectHistoryVideo = useCallback(async (item) => {
        if (!item?.generation_id || !product.id) return;
        try {
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: false, wallet: account || null },
            });
            // Si era el video actual del producto, limpiarlo
            if (product.media_video === item.video_url) {
                await cartaApi.updateProduct({ token, account, productId: product.id, data: { media_video: '' } });
                setProduct(p => ({ ...p, media_video: '' }));
                if (onUpdated) onUpdated(product.id, { media_video: '' });
            }
            history.reload();
        } catch (e) { console.error('[AIModal] handleRejectHistoryVideo:', e); }
    }, [product, token, account, onUpdated, history]);

    // ── History: description feedback ─────────────────────────────────────────
    const handleAcceptHistoryDesc = useCallback(async (item) => {
        if (!item?.description || !product.id) return;
        try {
            await cartaApi.updateProduct({ token, account, productId: product.id, data: { descripcion: item.description } });
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: true, wallet: account || null },
            });
            setProduct(p => ({ ...p, descripcion: item.description }));
            if (onUpdated) onUpdated(product.id, { descripcion: item.description });
            history.reload();
        } catch (e) { console.error('[AIModal] handleAcceptHistoryDesc:', e); }
    }, [product, token, account, onUpdated, history]);

    const handleRejectHistoryDesc = useCallback(async (item) => {
        if (!item?.generation_id || !product.id) return;
        try {
            await cartaApi.sendAIImagenFeedback({
                token, account,
                payload: { generation_id: item.generation_id, product_id: product.id, accepted: false, wallet: account || null },
            });
            history.reload();
        } catch (e) { console.error('[AIModal] handleRejectHistoryDesc:', e); }
    }, [product, token, account, history]);

// Removed handleSaveAcceptedOrder as we want to use handleReorderGallery directly

    const handleModeChange = (newMode) => {
        setMode(newMode); setStep(STEPS.IDLE); setResult(null); setError(null); setFeedbackSent(false);
        if (newMode === 'video' && gallery.length > 0) setSelectedRefUrl(gallery[0]);
    };

    const canGenerate = !(
        (mode === 'image' && !selectedRefUrl) ||
        (mode === 'video' && !selectedRefUrl)
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xl p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="w-full sm:max-w-2xl bg-[#0f0f13]/95 backdrop-blur-2xl border border-white/8 sm:rounded-2xl rounded-t-3xl shadow-2xl shadow-black/60 overflow-hidden max-h-[92dvh] flex flex-col">

                {/* Handle móvil */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/15" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-white leading-tight">{t('carta.aurora_studio')}</h2>
                            <p className="text-[10px] text-white/35 truncate max-w-[180px]">{product.nombre}</p>
                        </div>
                    </div>
                    {/* Mode pills */}
                    <div className="flex items-center gap-0.5 bg-white/6 rounded-xl p-1">
                        {MODES.map(m => <ModeTab key={m.id} mode={m} active={mode === m.id} onClick={handleModeChange} />)}
                    </div>
                    <button onClick={onClose}
                        className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0">
                        <X className="w-3 h-3 text-white/60" />
                    </button>
                </div>

                {/* Body — scrollable */}
                <div className="overflow-y-auto flex-1 min-h-0">

                    {/* Galería con D&D */}
                    <GalleryPanel
                        gallery={gallery}
                        mode={mode}
                        selectedRefUrl={selectedRefUrl}
                        mainImage={mainImage}
                        hasVideo={!!product.media_video}
                        updatedAt={product?.updated_at}
                        onSelect={setSelectedRefUrl}
                        onRemove={handleRemoveFromGallery}
                        onReorder={handleReorderGallery}
                        pendingImages={pendingAI}
                        onAddPending={handleAddPendingToGallery}
                    />

                    {/* Historial — full-height cuando mode=history */}
                    {mode === 'history' ? (
                        <HistoryPanel
                            items={history.items}
                            loading={history.loading}
                            error={history.error}
                            onReload={history.reload}
                            onUseImage={(item) => {
                                setMode('image');
                                setSelectedRefUrl(item.image_url);
                                setStep(STEPS.IDLE);
                                setResult(null);
                                setError(null);
                                setFeedbackSent(false);
                                setFeedbackStatus('idle');
                            }}
                            onAcceptHistory={handleAcceptHistory}
                            onRejectHistory={handleRejectHistory}
                            onSetMainHistory={handleSetMainHistory}
                            onSaveAcceptedOrder={handleReorderGallery}
                            isSavingOrder={isSavingOrder}
                            onAcceptHistoryVideo={handleAcceptHistoryVideo}
                            onRejectHistoryVideo={handleRejectHistoryVideo}
                            onAcceptHistoryDesc={handleAcceptHistoryDesc}
                            onRejectHistoryDesc={handleRejectHistoryDesc}
                        />
                    ) : (
                    <div className="p-5">
                        <AnimatePresence mode="wait">
                            {step === STEPS.IDLE && (
                                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <IdleContent
                                        mode={mode} product={product}
                                        options={styleOptions} selectedRefUrl={selectedRefUrl}
                                        onSetStyle={onSetStyle} onToggleStyle={onToggleStyle}
                                    />
                                </motion.div>
                            )}
                            {mode !== 'history' && step === STEPS.LOADING && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <GeneratingScreen mode={mode} />
                                </motion.div>
                            )}
                            {mode !== 'history' && (step === STEPS.RESULT || step === STEPS.ERROR) && (
                                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                     <ResultPanel
                                         result={result}
                                         error={error}
                                         step={step}
                                         beforeUrl={generationRefUrl}
                                         feedbackSent={feedbackSent}
                                         feedbackStatus={feedbackStatus}
                                         onFeedback={handleFeedback}
                                         galleryImages={postGallery}
                                         onReorderGallery={handleReorderGallery}
                                     />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-4 py-3 border-t border-white/8 bg-white/3 shrink-0">
                    <button onClick={onClose}
                        className="px-3.5 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white/60 text-xs font-medium hover:bg-white/5 transition-colors">
                        {t('carta.aurora_btn_close')}
                    </button>
                    <div className="flex-1" />

                    {(step === STEPS.RESULT || step === STEPS.ERROR) && (
                        <button onClick={handleGenerate}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white/60 text-xs font-medium hover:bg-white/5 transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" /> {t('carta.aurora_btn_regenerate')}
                        </button>
                    )}

                    {mode !== 'history' && step === STEPS.RESULT && result?.image_url && (
                        <button onClick={() => { const a = document.createElement('a'); a.href = result.image_url; a.target = '_blank'; a.click(); }}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white/60 text-xs font-medium hover:bg-white/5 transition-colors">
                            <Download className="w-3.5 h-3.5" /> PNG
                        </button>
                    )}

                    {mode !== 'history' && (step === STEPS.IDLE || step === STEPS.ERROR) && (
                        <button onClick={handleGenerate} disabled={!canGenerate}
                            title={!canGenerate ? t('carta.aurora_btn_generate_select') : undefined}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-violet-500/20 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                            {mode === 'image' && <><Sparkles className="w-3.5 h-3.5" /> {selectedRefUrl ? t('carta.aurora_btn_generate_image') : t('carta.aurora_btn_generate_select')}</>}
                            {mode === 'description' && <><Type className="w-3.5 h-3.5" /> {t('carta.aurora_btn_generate_description')}</>}
                            {mode === 'video' && <><Film className="w-3.5 h-3.5" /> {t('carta.aurora_btn_generate_video')}</>}
                        </button>
                    )}

                    {step === STEPS.LOADING && (
                        <button disabled
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500/50 to-indigo-600/50 text-white text-xs font-semibold opacity-70 cursor-not-allowed">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('carta.aurora_generating')}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default AIImagenModal;
