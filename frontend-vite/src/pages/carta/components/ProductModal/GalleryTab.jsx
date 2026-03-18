/**
 * GalleryTab — Galería del producto + Historial AI Aurora
 *
 * Secciones:
 *   1. Galería activa (4 slots drag-drop de fotos + strip de video)
 *   2. AI Images — generadas (aceptadas y pendientes), misma estructura de slots
 *   3. AI Videos — generados, con player inline
 *
 * pages → hooks → utils → backend
 */
import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LayoutGrid, Upload, Loader2, Sparkles, Film,
    CheckCircle, Clock, X, RefreshCw, ImageIcon, Play,
    Eye, ArrowDownToLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaGallery from './MediaGallery';
import useAIHistory from '../../../../hooks/useAIHistory';
import * as cartaApi from '../../../../utils/cartaData';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
};

const isVideoItem = (item) =>
    !!(item.video_url && !item.image_url) ||
    !!(item.model?.toLowerCase().includes('video'));

const isDescItem = (item) =>
    !!(item.description && !item.image_url && !item.video_url);

// ── AIImageTile ────────────────────────────────────────────────────────────────
const AIImageTile = ({ item, onUse, onAddToGallery, inGallery }) => {
    const isAccepted = item.accepted === true;
    const isPending  = item.accepted === null || item.accepted === undefined;
    const isRejected = item.accepted === false;

    return (
        <div className="relative group rounded-xl overflow-hidden border-2 transition-all aspect-square
            border-white/10 hover:border-violet-400/30">
            <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />

            {/* Status badge */}
            <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold ${
                isAccepted ? 'bg-emerald-500 text-white' :
                isPending  ? 'bg-amber-500/80 text-white' :
                             'bg-red-500/60 text-white/80'
            }`}>
                {isAccepted ? '✓ Aceptada' : isPending ? '⏳ Pendiente' : '✗ Rechazada'}
            </div>

            {/* Date */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                <p className="text-[8px] text-white/60">{fmtDate(item.created_at)}</p>
            </div>

            {/* Hover actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                <button onClick={() => window.open(item.image_url, '_blank')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-semibold">
                    <Eye className="w-3 h-3" /> Ver
                </button>
                {!inGallery ? (
                    <button onClick={() => onAddToGallery(item.image_url)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-[10px] font-semibold">
                        <ArrowDownToLine className="w-3 h-3" /> Agregar
                    </button>
                ) : (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/40 text-emerald-200 text-[10px]">
                        <CheckCircle className="w-3 h-3" /> En galería
                    </span>
                )}
            </div>
        </div>
    );
};

// ── AIVideoTile ────────────────────────────────────────────────────────────────
const AIVideoTile = ({ item, onUseVideo, currentVideo }) => {
    const [playing, setPlaying] = useState(false);
    const isAccepted  = item.accepted === true;
    const isPending   = item.accepted === null || item.accepted === undefined;
    const isActive    = currentVideo === item.video_url;

    return (
        <div className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
            isActive ? 'border-violet-400 shadow-lg shadow-violet-400/20' : 'border-white/10 hover:border-violet-400/30'
        }`}>
            {/* Video player */}
            <div className="relative aspect-video bg-black/40">
                {playing ? (
                    <video src={item.video_url} autoPlay controls className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center cursor-pointer"
                        onClick={() => setPlaying(true)}>
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition">
                            <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Info strip */}
            <div className="px-2.5 py-2 bg-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Film className="w-3 h-3 text-violet-400 shrink-0" />
                    <div>
                        <p className="text-[9px] text-white/40">{fmtDate(item.created_at)}</p>
                        <p className={`text-[10px] font-semibold ${
                            isAccepted ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-red-400'
                        }`}>
                            {isAccepted ? '✓ Aceptado' : isPending ? '⏳ Pendiente' : '✗ Rechazado'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => window.open(item.video_url, '_blank')}
                        className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                        <Eye className="w-3 h-3 text-white/60" />
                    </button>
                    {!isActive ? (
                        <button onClick={() => onUseVideo(item.video_url)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/70 hover:bg-violet-500 text-white text-[10px] font-bold transition">
                            <ArrowDownToLine className="w-3 h-3" /> Usar
                        </button>
                    ) : (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                            <CheckCircle className="w-3 h-3" /> Activo
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── SectionHeader ──────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, label, count, color = 'violet' }) => {
    const colors = {
        violet: 'text-violet-400',
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
    };
    return (
        <div className="flex items-center gap-2 mt-5 mb-2.5">
            <Icon className={`w-3.5 h-3.5 ${colors[color]}`} />
            <span className="text-xs font-bold text-white/60 uppercase tracking-wide">{label}</span>
            {count != null && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/8 text-white/35 text-[10px] font-bold">{count}</span>
            )}
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const GalleryTab = ({
    images, video, product, isEdit,
    uploading, onUpload, onRemove, onMove, onReorder, onVideoRemove, onVideoSet, onVideoUpload,
    onOpenAurora, onClose,
    token, account,
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    // AI History hook
    const history = useAIHistory({ token, account, productId: product?.id });
    useEffect(() => {
        if (isEdit && product?.id) history.reload();
    }, [isEdit, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Classify history items
    const aiImages  = history.items.filter(i => !isVideoItem(i) && !isDescItem(i) && i.image_url);
    const aiVideos  = history.items.filter(i => isVideoItem(i) && i.video_url);

    // Strip query params for comparison to avoid cache-bust mismatches
    const stripQs = (url) => {
        if (!url) return '';
        try { return url.split('?')[0]; } catch { return url; }
    };

    const gallerySet = new Set(images.map(stripQs));

    // Add AI image to product gallery
    const handleAddToGallery = (url) => {
        if (images.length >= 4) return;
        const baseUrl = stripQs(url);
        // Check if already in gallery (compare without cache-bust params)
        if (gallerySet.has(baseUrl)) return;
        // Also check exact match
        if (images.includes(url)) return;
        onReorder([...images, url]);
    };

    // Use AI video as product video
    const handleUseVideo = (url) => {
        if (onVideoSet) onVideoSet(url);
    };

    return (
        <div className="space-y-1">

            {/* ── Toolbar ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">
                        {t('carta.aurora_gallery_images_label', { count: images.length })}
                        {video && ' · 📹'}
                    </span>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Refresh AI history */}
                    {isEdit && (
                        <button type="button" onClick={history.reload} disabled={history.loading}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/8 transition disabled:opacity-30">
                            <RefreshCw className={`w-3.5 h-3.5 ${history.loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                    {/* Aurora shortcut */}
                    {isEdit && onOpenAurora && (
                        <button type="button" onClick={() => { onClose(); onOpenAurora(product); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/15 to-indigo-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-[11px] font-bold hover:from-violet-500/25 hover:to-indigo-500/25 transition-all shadow-sm active:scale-95">
                            <Sparkles className="w-3 h-3" /> {t('carta.aurora_open_aurora')}
                        </button>
                    )}
                    {/* Upload */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || images.length >= 4}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-light-border dark:border-dark-border text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/40 dark:hover:border-dark-accent/40 transition-all disabled:opacity-40">
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {uploading ? t('carta.image_uploading') : t('carta.image_upload_short', t('carta.image_upload'))}
                    </button>
                </div>
            </div>

            {/* ── Active gallery ────────────────────────────────────── */}
            {images.length > 0 ? (
                <MediaGallery
                    images={images}
                    video={video}
                    updatedAt={product?.updated_at}
                    onRemove={onRemove}
                    onMove={onMove}
                    onReorder={onReorder}
                    onVideoRemove={onVideoRemove}
                    onVideoUpload={onVideoUpload}
                />

            ) : (
                <div className="flex flex-col items-center justify-center py-7 rounded-xl border-2 border-dashed border-light-border dark:border-dark-border gap-2">
                    <span className="text-3xl opacity-20">🖼️</span>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {t('carta.aurora_no_images')}
                    </p>
                    {isEdit && onOpenAurora && (
                        <button type="button" onClick={() => { onClose(); onOpenAurora(product); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/15 to-indigo-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-xs font-bold hover:opacity-90 transition-all shadow-sm mt-1">
                            <Sparkles className="w-3 h-3" /> {t('carta.aurora_generate_with_ai')}
                        </button>
                    )}
                </div>
            )}

            {/* ── AI Images history ─────────────────────────────────── */}
            {isEdit && (
                <>
                    <SectionHeader icon={Sparkles} label="Imágenes generadas por AI" count={aiImages.length} color="violet" />
                    {history.loading && aiImages.length === 0 ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-4 h-4 animate-spin text-violet-400 mr-2" />
                            <span className="text-xs text-white/30">Cargando historial…</span>
                        </div>
                    ) : aiImages.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                            {aiImages.map((item, idx) => (
                                <AIImageTile
                                    key={item.image_url || item.id || item._id || idx}
                                    item={item}
                                    onAddToGallery={handleAddToGallery}
                                    inGallery={gallerySet.has(stripQs(item.image_url))}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-xs text-white/25">No hay imágenes AI generadas aún.</p>
                        </div>
                    )}

                    {/* ── AI Videos history ─────────────────────────────── */}
                    <SectionHeader icon={Film} label="Videos generados por AI" count={aiVideos.length} color="violet" />
                    {aiVideos.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {aiVideos.map((item, idx) => (
                                <AIVideoTile
                                    key={item.video_url || item.id || item._id || idx}
                                    item={item}
                                    currentVideo={video}
                                    onUseVideo={handleUseVideo}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-xs text-white/25">No hay videos AI generados aún.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default GalleryTab;
