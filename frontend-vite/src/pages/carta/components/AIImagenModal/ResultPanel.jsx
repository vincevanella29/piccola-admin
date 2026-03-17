/**
 * ResultPanel — Resultado de generación Aurora
 * Apple dark-glass style · i18n · Tailwind
 *
 * Todos los tipos (imagen, descripción, video) requieren Aceptar o Rechazar explícito.
 * Ninguno se guarda automáticamente — el feedback es obligatorio.
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Eye, ThumbsUp, ThumbsDown,
    CheckCircle, Star, ImageIcon, AlertTriangle,
    Loader2, X, GripVertical, LayoutGrid, Film, Type,
} from 'lucide-react';

// ── Mini gallery organizer (drag & drop) ──────────────────────────────────────

const MiniGalleryOrganizer = ({ images, onReorder }) => {
    const { t } = useTranslation();
    const [dragFrom, setDragFrom] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const dragRef = useRef(null);

    const handleDragStart = (e, i) => {
        dragRef.current = i; setDragFrom(i);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDrop = (e, to) => {
        e.preventDefault();
        const from = dragRef.current;
        if (from === null || from === to) { setDragOver(null); return; }
        const next = [...images];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onReorder(next);
        setDragFrom(null); setDragOver(null); dragRef.current = null;
    };
    const handleDragEnd = () => { setDragFrom(null); setDragOver(null); dragRef.current = null; };

    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    {t('carta.aurora_organize_label')}
                </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => {
                    const url = images[i];
                    const isOver = dragOver === i && dragFrom !== i;
                    const isPrincipal = i === 0;

                    if (!url) return (
                        <div key={`empty-${i}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={(e) => handleDrop(e, i)}
                            className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all ${
                                isOver ? 'border-emerald-500 bg-emerald-500/10 scale-105' : 'border-white/10 opacity-25'
                            }`}>
                            <ImageIcon className="w-4 h-4 text-white/30" />
                        </div>
                    );

                    return (
                        <div key={url + i}
                            draggable
                            onDragStart={(e) => handleDragStart(e, i)}
                            onDragEnter={() => setDragOver(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, i)}
                            onDragEnd={handleDragEnd}
                            className={`relative cursor-grab active:cursor-grabbing aspect-square rounded-xl overflow-hidden border-2 transition-all group select-none ${
                                isOver
                                    ? 'border-emerald-500 scale-105 shadow-lg shadow-emerald-500/25'
                                    : isPrincipal
                                        ? 'border-amber-400/70 shadow-md shadow-amber-400/15'
                                        : 'border-white/10 hover:border-emerald-400/40'
                            } ${dragFrom === i ? 'opacity-40' : ''}`}>
                            <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                            <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isPrincipal ? 'bg-amber-400 text-black' : 'bg-black/60 text-white'
                            }`}>
                                {isPrincipal ? '★' : `#${i + 1}`}
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-5 h-5 rounded bg-black/55 flex items-center justify-center">
                                    <GripVertical className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-[9px] text-white/30 flex items-center gap-1">
                <GripVertical className="w-3 h-3 shrink-0" />
                {t('carta.aurora_organize_hint')}
            </p>

        </div>
    );
};

// ── Shared feedback buttons ───────────────────────────────────────────────────

const FeedbackButtons = ({ feedbackStatus, feedbackSent, onFeedback, acceptLabel, rejectLabel, pendingQuestion }) => {
    const { t } = useTranslation();

    return (
        <AnimatePresence mode="wait">
            {feedbackStatus === 'saving' && (
                <motion.div key="saving"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('carta.aurora_status_saving')}
                </motion.div>
            )}

            {feedbackStatus === 'saved' && (
                <motion.div key="saved"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col gap-1 py-3 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        {t('carta.aurora_status_saved')}
                    </div>
                    <p className="text-[11px] text-emerald-400/60">{t('carta.aurora_status_saved_hint')}</p>
                </motion.div>
            )}

            {feedbackStatus === 'rejected' && (
                <motion.div key="rejected"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 py-3 px-4 rounded-2xl bg-white/5 border border-white/8 text-white/50 text-sm">
                    <X className="w-4 h-4 text-red-400 shrink-0" />
                    {t('carta.aurora_status_rejected')}
                </motion.div>
            )}

            {feedbackStatus === 'error' && (
                <motion.div key="error"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 py-3 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {t('carta.aurora_status_error')}
                </motion.div>
            )}

            {feedbackStatus === 'idle' && !feedbackSent && (
                <motion.div key="buttons"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-2">
                    <p className="text-xs text-center text-white/40">
                        {pendingQuestion || t('carta.aurora_feedback_question')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => onFeedback(true)}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.97]">
                            <ThumbsUp className="w-4 h-4" />
                            {acceptLabel || t('carta.aurora_btn_accept')}
                        </button>
                        <button onClick={() => onFeedback(false)}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/8 hover:bg-white/12 text-white/60 hover:text-white/80 text-sm font-semibold border border-white/10 transition-all active:scale-[0.97]">
                            <ThumbsDown className="w-4 h-4" />
                            {rejectLabel || t('carta.aurora_btn_reject')}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ── Image result ──────────────────────────────────────────────────────────────

const ImageResult = ({
    result, beforeUrl, feedbackSent, feedbackStatus, onFeedback,
    galleryImages, onReorderGallery,
}) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Before / After */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 text-center mb-1.5">
                        {t('carta.aurora_result_before')}
                    </p>
                    {beforeUrl
                        ? <img src={beforeUrl} alt="" className="w-full aspect-square rounded-2xl object-cover opacity-50 border border-white/8" />
                        : <div className="w-full aspect-square rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-white/15" />
                          </div>
                    }
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 mb-1.5">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                            {t('carta.aurora_result_aurora')}
                        </p>
                    </div>
                    <div className="relative">
                        <img src={result.image_url} alt=""
                            className={`w-full aspect-square rounded-2xl object-cover border-2 shadow-lg transition-all ${
                                feedbackStatus === 'saved'
                                    ? 'border-emerald-500 shadow-emerald-500/20'
                                    : 'border-violet-500/30 shadow-violet-500/10'
                            }`} />
                        {feedbackStatus === 'saved' && (
                            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                                className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-emerald-500 text-white text-[9px] font-bold shadow">
                                <Star className="w-2.5 h-2.5 fill-white" />
                            </motion.div>
                        )}
                        <button onClick={() => window.open(result.image_url, '_blank')}
                            className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors">
                            <Eye className="w-3.5 h-3.5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Feedback */}
            <FeedbackButtons
                feedbackStatus={feedbackStatus}
                feedbackSent={feedbackSent}
                onFeedback={onFeedback}
                acceptLabel={t('carta.aurora_btn_accept')}
                rejectLabel={t('carta.aurora_btn_reject')}
                pendingQuestion={t('carta.aurora_feedback_question')}
            />

            {/* Post-accept gallery organizer */}
            {feedbackStatus === 'saved' && galleryImages && galleryImages.length > 1 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="p-3 rounded-2xl bg-white/5 border border-white/8">
                    <MiniGalleryOrganizer images={galleryImages} onReorder={onReorderGallery} />
                </motion.div>
            )}
        </>
    );
};

// ── Description result ────────────────────────────────────────────────────────

const DescriptionResult = ({ result, feedbackSent, feedbackStatus, onFeedback }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-3">
            {/* Preview */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/8 to-indigo-500/8 border border-violet-500/15">
                <div className="flex items-center gap-2 mb-3">
                    <Type className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-white/70">{t('carta.aurora_desc_generated')}</span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed italic">"{result.description}"</p>
            </div>

            {/* ⚠️ Feedback obligatorio — no se guarda hasta que el usuario acepta */}
            <FeedbackButtons
                feedbackStatus={feedbackStatus}
                feedbackSent={feedbackSent}
                onFeedback={onFeedback}
                acceptLabel={t('carta.aurora_desc_btn_accept')}
                rejectLabel={t('carta.aurora_desc_btn_reject')}
                pendingQuestion={t('carta.aurora_desc_feedback_question')}
            />
        </div>
    );
};

// ── Video result ──────────────────────────────────────────────────────────────

const VideoResult = ({ result, feedbackSent, feedbackStatus, onFeedback }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-3">
            {/* Player */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-violet-500/20 shadow-lg shadow-violet-500/8">
                <video src={result.video_url} controls autoPlay loop
                    className="w-full rounded-2xl" />
                <button onClick={() => window.open(result.video_url, '_blank')}
                    className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors">
                    <Eye className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                    <Film className="w-3 h-3 text-violet-400" />
                    <span className="text-[9px] font-semibold text-violet-300">Aurora Video</span>
                </div>
            </div>

            {/* ⚠️ Feedback obligatorio */}
            <FeedbackButtons
                feedbackStatus={feedbackStatus}
                feedbackSent={feedbackSent}
                onFeedback={onFeedback}
                acceptLabel={t('carta.aurora_video_btn_accept')}
                rejectLabel={t('carta.aurora_video_btn_reject')}
                pendingQuestion={t('carta.aurora_video_feedback_question')}
            />
        </div>
    );
};

// ── Error ──────────────────────────────────────────────────────────────────────

const ErrorPanel = ({ error }) => {
    const { t } = useTranslation();
    return (
        <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div>
                <p className="text-sm font-semibold text-white/70">{t('carta.aurora_error_title')}</p>
                <p className="text-xs text-red-400 mt-1 max-w-[280px]">{error}</p>
            </div>
        </div>
    );
};

// ── Main export ───────────────────────────────────────────────────────────────

const ResultPanel = ({
    result, error, step, beforeUrl,
    feedbackSent, feedbackStatus = 'idle', onFeedback,
    galleryImages, onReorderGallery,
}) => {
    if (step === 'error' && error) return <ErrorPanel error={error} />;
    if (!result) return null;

    return (
        <div className="space-y-4">
            {result.type === 'image' && (
                <ImageResult
                    result={result} beforeUrl={beforeUrl}
                    feedbackSent={feedbackSent} feedbackStatus={feedbackStatus} onFeedback={onFeedback}
                    galleryImages={galleryImages} onReorderGallery={onReorderGallery}
                />
            )}
            {result.type === 'description' && (
                <DescriptionResult
                    result={result}
                    feedbackSent={feedbackSent} feedbackStatus={feedbackStatus} onFeedback={onFeedback}
                />
            )}
            {result.type === 'video' && (
                <VideoResult
                    result={result}
                    feedbackSent={feedbackSent} feedbackStatus={feedbackStatus} onFeedback={onFeedback}
                />
            )}
        </div>
    );
};

export default ResultPanel;
