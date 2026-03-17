/**
 * HistoryPanel — Historial de generaciones Aurora para un producto
 * Design: Apple dark-glass (el modal es siempre dark-glass por diseño)
 * i18n: 100% usando t() · Tailwind válido sin clases arbitrarias inválidas
 *
 * Props:
 *   items           — Array de generaciones
 *   loading         — Boolean
 *   error           — String | null
 *   onReload        — Fn para recargar
 *   onUseImage      — Fn(item) → usar como referencia AI
 *   onAcceptHistory — Fn(item) async → aceptar + hacer principal
 *   onRejectHistory — Fn(item) async → rechazar
 *   onSetMainHistory— Fn(item, allAccepted) async → hacer principal
 *   onSaveAcceptedOrder — Fn(orderedAccepted) async → guardar orden D&D
 *   isSavingOrder   — Boolean
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Film, Type, CheckCircle, X, Clock,
    Loader2, RefreshCw, Eye, Star, ArrowUp, ArrowDown,
    AlertTriangle, Image as ImageIcon, GripVertical,
    ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VIDEO_MODELS = ['aurora-video', 'grok-video', 'video'];
const isVideo = (item) => !!(item.video_url && !item.image_url) || VIDEO_MODELS.some(m => item.model?.toLowerCase().includes('video'));
const isDesc  = (item) => !!(item.description && !item.image_url && !item.video_url);
const isImg   = (item) => !!item.image_url;

const fmtDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
};

// ── Tab button ─────────────────────────────────────────────────────────────────
const TabBtn = ({ active, icon: Icon, label, count, onClick }) => (
    <button onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
            active
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
        }`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        {count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                active ? 'bg-violet-500/25 text-violet-200' : 'bg-white/10 text-white/40'
            }`}>{count}</span>
        )}
    </button>
);

// ── Empty state ────────────────────────────────────────────────────────────────
const Empty = ({ label }) => (
    <div className="py-12 flex flex-col items-center gap-3 text-white/30">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 opacity-40" />
        </div>
        <p className="text-xs text-center leading-relaxed opacity-70">{label}</p>
    </div>
);

// ── Section header (collapsible) ───────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, label, count, variant, collapsed, onToggle }) => {
    const colors = {
        emerald: { bg: 'bg-emerald-500/10 hover:bg-emerald-500/15', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
        amber:   { bg: 'bg-amber-500/10  hover:bg-amber-500/15',  text: 'text-amber-400',   badge: 'bg-amber-500/20  text-amber-300' },
        red:     { bg: 'bg-red-500/10    hover:bg-red-500/15',    text: 'text-red-400',     badge: 'bg-red-500/20    text-red-300' },
    };
    const c = colors[variant] || colors.amber;
    return (
        <button onClick={onToggle}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl mb-2 transition-colors ${c.bg}`}>
            <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${c.badge}`}>{count}</span>
            </div>
            {collapsed
                ? <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                : <ChevronUp   className="w-3.5 h-3.5 text-white/30" />
            }
        </button>
    );
};

// SaveOrderBar removed as order saves automatically

// ── Accepted image card (drag & drop + ↑↓ buttons + set main) ─────────────────
const AcceptedCard = ({
    item, index, total,
    isDragOver, isDragging,
    onDragStart, onDragEnter, onDragLeave, onDragOver, onDrop, onDragEnd,
    onMoveUp, onMoveDown,
    isMain, actionLoading,
}) => {
    const isFirst = index === 0;
    const isLast  = index === total - 1;

    return (
        <motion.div layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            draggable
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`relative rounded-2xl overflow-hidden border-2 transition-all select-none cursor-grab active:cursor-grabbing ${
                isDragOver
                    ? 'border-emerald-400 shadow-lg shadow-emerald-400/20 scale-[1.03]'
                    : isMain
                        ? 'border-amber-400/70 shadow-md shadow-amber-400/15'
                        : 'border-emerald-500/40'
            }`}>

            <img src={item.image_url} alt="" className="w-full aspect-square object-cover pointer-events-none" loading="lazy" />

            {/* Drag grip */}
            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                <GripVertical className="w-3 h-3 text-white" />
            </div>

            {/* Position badge */}
            {isMain
                ? <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-amber-400 text-black text-[9px] font-bold shadow">
                    <Star className="w-2.5 h-2.5 fill-black" /> #1
                  </div>
                : <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[9px] font-mono">
                    #{index + 1}
                  </div>
            }

            {/* Date */}
            <div className="absolute bottom-9 left-1.5">
                <span className="px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 text-[9px] font-mono">{fmtDate(item.created_at)}</span>
            </div>

            {/* Action bar — always visible at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-1.5 px-1.5 flex gap-1">
                {/* Move up */}
                <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    disabled={isFirst || !!actionLoading}
                    title="↑"
                    className="w-7 h-7 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25 disabled:cursor-not-allowed active:scale-95">
                    <ArrowUp className="w-3.5 h-3.5 text-white" />
                </button>
                {/* Move down */}
                <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    disabled={isLast || !!actionLoading}
                    title="↓"
                    className="w-7 h-7 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25 disabled:cursor-not-allowed active:scale-95">
                    <ArrowDown className="w-3.5 h-3.5 text-white" />
                </button>
                {/* Set main */}
                {!isMain && (
                    <button onClick={(e) => { e.stopPropagation(); onSetMain(item); }}
                        disabled={!!actionLoading}
                        title={btnSetMain}
                        className="flex-1 flex items-center justify-center gap-0.5 h-7 rounded-xl bg-amber-400/85 backdrop-blur-sm text-black text-[9px] font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 active:scale-95">
                        {actionLoading === item.generation_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><Star className="w-3 h-3 fill-black" />{btnSetMain}</>
                        }
                    </button>
                )}
                {/* View */}
                <button onClick={(e) => { e.stopPropagation(); window.open(item.image_url, '_blank'); }}
                    title="Ver"
                    className="w-7 h-7 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors active:scale-95">
                    <Eye className="w-3.5 h-3.5 text-white" />
                </button>
            </div>
        </motion.div>
    );
};

// ── Pending / Rejected card ────────────────────────────────────────────────────
const ActionCard = ({ item, type, onAccept, onSetMain, onReject, actionLoading, btnAccept, btnPromote, btnReject }) => {
    const isPending  = type === 'pending';
    const isRejected = type === 'rejected';
    const isLoading  = actionLoading === item.generation_id;

    return (
        <motion.div layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                isPending  ? 'border-amber-500/30' : 'border-red-500/15 opacity-60 hover:opacity-90'
            }`}>

            <img src={item.image_url} alt="" className="w-full aspect-square object-cover" loading="lazy" />

            {/* Status badge */}
            <div className="absolute top-1.5 left-1.5">
                {isPending && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/85 text-black text-[9px] font-bold">
                        <Clock className="w-2.5 h-2.5" />
                    </span>
                )}
                {isRejected && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/85 text-white text-[9px] font-bold">
                        <X className="w-2.5 h-2.5" />
                    </span>
                )}
            </div>

            {/* Date */}
            <div className="absolute top-1.5 right-1.5">
                <span className="px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/60 text-[9px] font-mono">{fmtDate(item.created_at)}</span>
            </div>

            {/* Action bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-1.5 px-1.5 flex gap-1">
                {/* Accept / Promote */}
                <button onClick={() => onAccept(item)} disabled={isLoading} title="Aceptar y agregar al final de la galería"
                    className="flex-1 flex items-center justify-center gap-1 h-7 rounded-xl bg-emerald-500/85 backdrop-blur-sm text-white text-[9px] font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50 active:scale-95">
                    {isLoading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><ThumbsUp className="w-3 h-3" /> {isRejected ? btnPromote : (isPending ? '+ Galería' : btnAccept)}</>
                    }
                </button>
                {/* Reject (only for pending) */}
                {isPending && (
                    <button onClick={() => onReject(item)} disabled={isLoading}
                        className="w-7 h-7 rounded-xl bg-red-500/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500 transition-colors disabled:opacity-50 active:scale-95">
                        <ThumbsDown className="w-3.5 h-3.5 text-white" />
                    </button>
                )}
                {/* View */}
                <button onClick={() => window.open(item.image_url, '_blank')}
                    className="w-7 h-7 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors active:scale-95">
                    <Eye className="w-3.5 h-3.5 text-white" />
                </button>
            </div>
        </motion.div>
    );
};

// ── Description card ───────────────────────────────────────────────────────────
const DescCard = ({ item, onAccept, onReject, actionLoading }) => {
    const { t } = useTranslation();
    const accepted = item.accepted;
    const isLoading = actionLoading === item.generation_id;
    const isPending = accepted === null || accepted === undefined;

    return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-2xl border space-y-2 transition-all ${
                accepted === true  ? 'border-emerald-500/25 bg-emerald-500/5' :
                accepted === false ? 'border-red-500/15 bg-red-500/5 opacity-60' :
                                     'border-amber-500/25 bg-amber-500/5'
            }`}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white/70 leading-relaxed italic flex-1">"{item.description}"</p>
                <div className="flex items-center gap-1 shrink-0">
                    {accepted === true  && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold"><CheckCircle className="w-2.5 h-2.5" /></span>}
                    {accepted === false && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-semibold"><X className="w-2.5 h-2.5" /></span>}
                    {isPending && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-semibold"><Clock className="w-2.5 h-2.5" /></span>}
                </div>
            </div>
            <p className="text-[9px] text-white/25">{fmtDate(item.created_at)}</p>

            {/* Feedback buttons — only for pending */}
            {isPending && (
                <div className="flex gap-1.5 pt-1">
                    <button onClick={() => onAccept && onAccept(item)} disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-1 h-7 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsUp className="w-3 h-3" /> {t('carta.aurora_history_btn_accept')}</>}
                    </button>
                    <button onClick={() => onReject && onReject(item)} disabled={isLoading}
                        className="w-7 h-7 rounded-xl bg-red-500/60 hover:bg-red-500 flex items-center justify-center transition-colors disabled:opacity-50">
                        <ThumbsDown className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>
            )}
            {/* Rejected — allow re-accept */}
            {accepted === false && (
                <button onClick={() => onAccept && onAccept(item)} disabled={isLoading}
                    className="w-full flex items-center justify-center gap-1 h-7 rounded-xl bg-white/8 hover:bg-emerald-500/70 text-white/50 hover:text-white text-[10px] font-bold transition-colors disabled:opacity-50">
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsUp className="w-3 h-3" /> {t('carta.aurora_history_btn_promote')}</>}
                </button>
            )}
        </motion.div>
    );
};

// ── Video card ─────────────────────────────────────────────────────────────────
const VideoCard = ({ item, onAccept, onReject, actionLoading }) => {
    const { t } = useTranslation();
    const accepted = item.accepted;
    const isLoading = actionLoading === item.generation_id;
    const isPending = accepted === null || accepted === undefined;
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl overflow-hidden border-2 ${
                accepted === true  ? 'border-emerald-500/40' :
                accepted === false ? 'border-red-500/15 opacity-70' :
                                     'border-amber-500/25'
            }`}>
            <video src={item.video_url} controls loop muted className="w-full aspect-video object-cover bg-black" />
            <div className="px-3 py-2 space-y-2 bg-white/5">
                <div className="flex items-center justify-between">
                    {accepted === true  && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold"><CheckCircle className="w-2.5 h-2.5" /> {t('carta.aurora_video_saved')}</span>}
                    {accepted === false && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-semibold"><X className="w-2.5 h-2.5" /> {t('carta.aurora_status_rejected_short')}</span>}
                    {isPending && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-semibold"><Clock className="w-2.5 h-2.5" /> {t('carta.aurora_status_pending')}</span>}
                    <span className="text-[9px] text-white/30 ml-auto">{fmtDate(item.created_at)}</span>
                </div>
                {/* Feedback buttons — pending */}
                {isPending && (
                    <div className="flex gap-1.5">
                        <button onClick={() => onAccept && onAccept(item)} disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-1 h-7 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsUp className="w-3 h-3" /> {t('carta.aurora_history_btn_accept')}</>}
                        </button>
                        <button onClick={() => onReject && onReject(item)} disabled={isLoading}
                            className="w-7 h-7 rounded-xl bg-red-500/60 hover:bg-red-500 flex items-center justify-center transition-colors disabled:opacity-50">
                            <ThumbsDown className="w-3.5 h-3.5 text-white" />
                        </button>
                    </div>
                )}
                {/* Rejected — allow re-accept */}
                {accepted === false && (
                    <button onClick={() => onAccept && onAccept(item)} disabled={isLoading}
                        className="w-full flex items-center justify-center gap-1 h-7 rounded-xl bg-white/8 hover:bg-emerald-500/70 text-white/50 hover:text-white text-[10px] font-bold transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsUp className="w-3 h-3" /> {t('carta.aurora_history_btn_promote')}</>}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const HistoryPanel = ({
    items = [],
    loading, error,
    onReload,
    onAcceptHistory,
    onRejectHistory,
    onSaveAcceptedOrder,
    isSavingOrder,
    onAcceptHistoryVideo,
    onRejectHistoryVideo,
    onAcceptHistoryDesc,
    onRejectHistoryDesc,
}) => {
    const { t } = useTranslation();
    const [tab, setTab]               = useState('images');
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectedOpen, setRejectedOpen]   = useState(false);
    const [pendingOpen,  setPendingOpen]     = useState(true);

    // Drag state for accepted images
    const [acceptedOrder, setAcceptedOrder] = useState(null);
    const [dragFrom, setDragFrom] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const dragRef = useRef(null);

    const images = items.filter(isImg);
    const descs  = items.filter(isDesc);
    const videos = items.filter(isVideo);

    const accepted = images.filter(i => i.accepted === true);
    const pending  = images.filter(i => i.accepted === null || i.accepted === undefined);
    const rejected = images.filter(i => i.accepted === false);

    // Build display order for accepted
    const displayAccepted = acceptedOrder
        ? acceptedOrder
            .map(genId => accepted.find(a => a.generation_id === genId))
            .filter(Boolean)
            .concat(accepted.filter(a => !acceptedOrder.includes(a.generation_id)))
        : accepted;

    // D&D handlers
    const hdDragStart  = (e, i) => { dragRef.current = i; setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; };
    const hdDragEnter  = (i)    => { if (dragRef.current !== null) setDragOver(i); };
    const hdDragLeave  = ()     => {};
    const hdDrop       = (e, to) => {
        e.preventDefault();
        const from = dragRef.current;
        if (from === null || from === to) { setDragOver(null); return; }
        const next = [...displayAccepted];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setAcceptedOrder(next.map(a => a.generation_id));
        setDragFrom(null); setDragOver(null); dragRef.current = null;
        if (onSaveAcceptedOrder) onSaveAcceptedOrder(next);
    };
    const hdDragEnd    = ()    => { setDragFrom(null); setDragOver(null); dragRef.current = null; };

    const handleMoveUp   = (idx) => {
        if (idx === 0) return;
        const next = [...displayAccepted];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        setAcceptedOrder(next.map(a => a.generation_id));
        if (onSaveAcceptedOrder) onSaveAcceptedOrder(next);
    };
    const handleMoveDown = (idx) => {
        if (idx === displayAccepted.length - 1) return;
        const next = [...displayAccepted];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        setAcceptedOrder(next.map(a => a.generation_id));
        if (onSaveAcceptedOrder) onSaveAcceptedOrder(next);
    };

    const handleAccept = async (item) => {
        if (!onAcceptHistory) return;
        setActionLoading(item.generation_id);
        try { await onAcceptHistory(item); setAcceptedOrder(null); }
        finally { setActionLoading(null); }
    };
    const handleReject = async (item) => {
        if (!onRejectHistory) return;
        setActionLoading(item.generation_id);
        try { await onRejectHistory(item); }
        finally { setActionLoading(null); }
    };

    const stats = [
        { label: t('carta.aurora_history_total'),    val: images.length,   color: 'text-white/50' },
        { label: t('carta.aurora_history_accepted'), val: accepted.length,  color: 'text-emerald-400' },
        { label: t('carta.aurora_history_pending'),  val: pending.length,   color: 'text-amber-400' },
        { label: t('carta.aurora_history_rejected'), val: rejected.length,  color: 'text-red-400' },
    ];

    return (
        <div className="flex flex-col">

            {/* Tabs + Reload */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/8">
                <div className="flex items-center gap-1 flex-wrap">
                    <TabBtn active={tab === 'images'}       icon={ImageIcon} label={t('carta.aurora_history_images')}       count={images.length}  onClick={() => setTab('images')} />
                    <TabBtn active={tab === 'descriptions'} icon={Type}      label={t('carta.aurora_history_descriptions')} count={descs.length}   onClick={() => setTab('descriptions')} />
                    <TabBtn active={tab === 'videos'}       icon={Film}      label={t('carta.aurora_history_videos')}       count={videos.length}  onClick={() => setTab('videos')} />
                </div>
                <button onClick={onReload} disabled={loading}
                    className="w-7 h-7 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/8 transition-colors disabled:opacity-40 shrink-0">
                    {loading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        : <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                    }
                </button>
            </div>

            {/* Stats row (images only) */}
            {tab === 'images' && (
                <div className="flex items-center gap-5 px-4 py-2 border-b border-white/6">
                    {stats.map(s => (
                        <div key={s.label} className="text-center">
                            <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                            <div className="text-[9px] text-white/25 leading-tight">{s.label}</div>
                        </div>
                    ))}
                    {displayAccepted.length > 1 && (
                        <div className="ml-auto flex items-center gap-0.5 text-[9px] text-white/30">
                            <GripVertical className="w-3 h-3" />
                            {t('carta.aurora_history_drag_hint')}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-4">

                {/* Loading spinner */}
                {loading && items.length === 0 && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                    </div>
                )}

                <AnimatePresence mode="wait">

                    {/* ─── IMAGES TAB ─────────────────────────────────────── */}
                    {tab === 'images' && (
                        <motion.div key="images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="space-y-4">

                            {images.length === 0 && !loading && !error && (
                                <Empty label={t('carta.aurora_history_empty', { type: t('carta.aurora_history_images').toLowerCase() })} />
                            )}

                            {/* ★ ACCEPTED */}
                            {displayAccepted.length > 0 && (
                                <div>
                                    <SectionHeader
                                        icon={CheckCircle}
                                        label={t('carta.aurora_history_section_accepted', { count: displayAccepted.length })}
                                        count={displayAccepted.length}
                                        variant="emerald"
                                        collapsed={false}
                                        onToggle={() => {}}
                                    />

                                    <p className="text-[10px] text-emerald-400/60 mb-2 flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-emerald-400 text-emerald-400 shrink-0" />
                                        {t('carta.aurora_history_accepted_hint')}
                                    </p>



                                    <div className="grid grid-cols-3 gap-2">
                                        <AnimatePresence>
                                            {displayAccepted.map((item, idx) => (
                                                <AcceptedCard
                                                    key={item.generation_id}
                                                    item={item} index={idx} total={displayAccepted.length}
                                                    isDragOver={dragOver === idx && dragFrom !== idx}
                                                    isDragging={dragFrom === idx}
                                                    onDragStart={(e) => hdDragStart(e, idx)}
                                                    onDragEnter={() => hdDragEnter(idx)}
                                                    onDragLeave={hdDragLeave}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => hdDrop(e, idx)}
                                                    onDragEnd={hdDragEnd}
                                                    onMoveUp={() => handleMoveUp(idx)}
                                                    onMoveDown={() => handleMoveDown(idx)}
                                                    isMain={idx === 0}
                                                    actionLoading={actionLoading}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {/* ⏳ PENDING */}
                            {pending.length > 0 && (
                                <div>
                                    <SectionHeader
                                        icon={Clock}
                                        label={t('carta.aurora_history_section_pending')}
                                        count={pending.length}
                                        variant="amber"
                                        collapsed={!pendingOpen}
                                        onToggle={() => setPendingOpen(o => !o)}
                                    />
                                    <AnimatePresence>
                                        {pendingOpen && (
                                            <motion.div key="pending-body"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden">
                                                <div className="grid grid-cols-3 gap-2 pb-1">
                                                    <AnimatePresence>
                                                        {pending.map(item => (
                                                            <ActionCard key={item.generation_id}
                                                                item={item} type="pending"
                                                                onAccept={handleAccept} onReject={handleReject}
                                                                actionLoading={actionLoading}
                                                                btnAccept={t('carta.aurora_history_btn_accept')}
                                                                btnPromote={t('carta.aurora_history_btn_promote')}
                                                                btnReject={t('carta.aurora_history_btn_reject')}
                                                            />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* ✕ REJECTED */}
                            {rejected.length > 0 && (
                                <div>
                                    <SectionHeader
                                        icon={X}
                                        label={t('carta.aurora_history_section_rejected')}
                                        count={rejected.length}
                                        variant="red"
                                        collapsed={!rejectedOpen}
                                        onToggle={() => setRejectedOpen(o => !o)}
                                    />
                                    <AnimatePresence>
                                        {rejectedOpen && (
                                            <motion.div key="rejected-body"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden">
                                                <p className="text-[10px] text-white/30 mb-2">{t('carta.aurora_history_rejected_hint')}</p>
                                                <div className="grid grid-cols-3 gap-2 pb-1">
                                                    <AnimatePresence>
                                                        {rejected.map(item => (
                                                            <ActionCard key={item.generation_id}
                                                                item={item} type="rejected"
                                                                onAccept={handleAccept} onReject={handleReject}
                                                                actionLoading={actionLoading}
                                                                btnAccept={t('carta.aurora_history_btn_accept')}
                                                                btnPromote={t('carta.aurora_history_btn_promote')}
                                                                btnReject={t('carta.aurora_history_btn_reject')}
                                                            />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ─── DESCRIPTIONS TAB ───────────────────────────────── */}
                    {tab === 'descriptions' && (
                        <motion.div key="descs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {descs.length === 0 && !loading && (
                                <Empty label={t('carta.aurora_history_empty', { type: t('carta.aurora_history_descriptions').toLowerCase() })} />
                            )}
                            <div className="space-y-2">
                                {descs.map(item => (
                                    <DescCard key={item.generation_id} item={item}
                                        onAccept={onAcceptHistoryDesc}
                                        onReject={onRejectHistoryDesc}
                                        actionLoading={actionLoading}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ─── VIDEOS TAB ─────────────────────────────────────── */}
                    {tab === 'videos' && (
                        <motion.div key="videos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {videos.length === 0 && !loading && (
                                <Empty label={t('carta.aurora_history_empty', { type: t('carta.aurora_history_videos').toLowerCase() })} />
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {videos.map(item => (
                                    <VideoCard key={item.generation_id} item={item}
                                        onAccept={onAcceptHistoryVideo}
                                        onReject={onRejectHistoryVideo}
                                        actionLoading={actionLoading}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
};

export default HistoryPanel;
