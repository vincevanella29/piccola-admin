import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ImageIcon, Plus, Star, Trash2, GripVertical, Film,
    Upload, Loader2, Play, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * MediaGallery — 4-slot drag-and-drop image gallery + video strip.
 *
 * Slot 0 = principal (amber star badge).
 * Video strip: shows active video + allows manual upload to R2 OR paste URL.
 *
 * Props:
 *   images       string[]
 *   video        string | ''
 *   updatedAt    string | null
 *   onRemove     (i: number) => void
 *   onVideoRemove () => void
 *   onReorder    (imgs: string[]) => void
 *   onVideoUpload (file: File) => Promise<void>   ← NEW
 */
const MediaGallery = ({ images, video, updatedAt, onRemove, onVideoRemove, onReorder, onVideoUpload }) => {
    const { t } = useTranslation();
    const [dragFrom, setDragFrom]   = useState(null);
    const [dragOver, setDragOver]   = useState(null);
    const [videoPlay, setVideoPlay] = useState(false);
    const [uploadingVid, setUploadingVid] = useState(false);
    const [vidError, setVidError]   = useState(null);
    const dragRef    = useRef(null);
    const videoInput = useRef(null);

    const busted = (url) => {
        if (!url || typeof url !== 'string' || url.includes('?')) return url;
        if (updatedAt) return `${url}?v=${new Date(updatedAt).getTime()}`;
        return url;
    };

    // ── Image D&D ─────────────────────────────────────────────────────────
    const handleDragStart = (e, i) => {
        dragRef.current = i;
        setDragFrom(i);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e, toIdx) => {
        e.preventDefault();
        const fromIdx = dragRef.current;
        if (fromIdx === null || fromIdx === undefined || fromIdx === toIdx) {
            setDragOver(null);
            return;
        }
        // Clamp toIdx to valid range — don't allow gaps
        const clampedTo = Math.min(toIdx, images.length - 1);
        if (fromIdx === clampedTo) { setDragOver(null); return; }
        const next = [...images];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(clampedTo, 0, moved);
        // Deduplicate — safety net
        const seen = new Set();
        const deduped = next.filter(url => {
            if (seen.has(url)) return false;
            seen.add(url);
            return true;
        });
        if (onReorder) onReorder(deduped);
        setDragFrom(null); setDragOver(null); dragRef.current = null;
    };

    const handleDragEnd = () => { setDragFrom(null); setDragOver(null); dragRef.current = null; };

    // ── Video upload ──────────────────────────────────────────────────────
    const handleVideoFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !onVideoUpload) return;
        setVidError(null);
        setUploadingVid(true);
        try {
            await onVideoUpload(file);
            setVideoPlay(false);
        } catch (err) {
            setVidError(err?.detail || err?.message || 'Error subiendo video');
        } finally {
            setUploadingVid(false);
            if (videoInput.current) videoInput.current.value = '';
        }
    };

    return (
        <div className="space-y-3">

            {/* ── Image slots ───────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => {
                    const url         = images[i];
                    const isPrincipal = i === 0;
                    const isOver      = dragOver === i && dragFrom !== i;

                    if (!url) return (
                        <div key={`empty-${i}`}
                            onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={e => handleDrop(e, i)}
                            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                                isOver
                                    ? 'border-amber-400 bg-amber-400/10 scale-105'
                                    : 'border-light-border dark:border-dark-border opacity-30'
                            }`}>
                            {isOver
                                ? <Plus className="w-5 h-5 text-amber-400" />
                                : <>
                                    <ImageIcon className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                    <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {t('carta.aurora_slot', { n: i + 1 })}
                                    </span>
                                  </>
                            }
                        </div>
                    );

                    // Stable key: use a hash of the URL instead of url+index
                    // This prevents React from confusing elements on reorder
                    const stableKey = `slot-${url}`;

                    return (
                        <div key={stableKey}
                            draggable
                            onDragStart={e => handleDragStart(e, i)}
                            onDragEnter={() => setDragOver(i)}
                            onDragLeave={() => {}}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, i)}
                            onDragEnd={handleDragEnd}
                            className={`relative cursor-grab active:cursor-grabbing rounded-xl overflow-hidden aspect-square border-2 group transition-all select-none ${
                                isOver
                                    ? 'border-amber-400 scale-105 shadow-lg shadow-amber-400/30'
                                    : isPrincipal
                                        ? 'border-amber-400 shadow-md shadow-amber-400/20'
                                        : 'border-light-border dark:border-dark-border hover:border-amber-400/40'
                            } ${dragFrom === i ? 'opacity-40' : ''}`}>
                            <img src={busted(url)} alt={`img ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />

                            {/* Drag handle */}
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <div className="w-5 h-5 rounded bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                    <GripVertical className="w-3 h-3 text-white" />
                                </div>
                            </div>

                            {/* Principal badge */}
                            <AnimatePresence>
                                {isPrincipal && (
                                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                        className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-400 text-black text-[8px] font-bold flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-black" /> {t('carta.aurora_history_btn_set_main')}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Slot number */}
                            {!isPrincipal && (
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                    #{i + 1}
                                </div>
                            )}

                            {/* Remove overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                <button onClick={() => onRemove(i)}
                                    className="w-6 h-6 rounded-lg bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors">
                                    <Trash2 className="w-3 h-3 text-white" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Video section ─────────────────────────────────────── */}
            <div className="space-y-2">
                {/* Active video */}
                {video ? (
                    <div className="rounded-xl overflow-hidden border border-violet-500/30 bg-black/5 dark:bg-white/5">
                        {/* Player / thumbnail row */}
                        <div className="relative group">
                            {videoPlay ? (
                                <video src={video} autoPlay controls
                                    className="w-full rounded-t-xl max-h-40 object-contain bg-black" />
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2.5">
                                    {/* Thumbnail play button */}
                                    <button onClick={() => setVideoPlay(true)}
                                        className="w-9 h-9 shrink-0 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 flex items-center justify-center transition-colors">
                                        <Play className="w-4 h-4 text-violet-400 fill-violet-400" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Film className="w-3 h-3 text-violet-500 shrink-0" />
                                            <span className="text-[10px] font-semibold text-light-text-primary dark:text-dark-text-primary">Video del producto</span>
                                        </div>
                                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary truncate block max-w-full">{video}</span>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Replace video upload */}
                                        <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
                                            className="hidden" onChange={handleVideoFile} />
                                        {onVideoUpload && (
                                            <button onClick={() => videoInput.current?.click()} disabled={uploadingVid}
                                                title="Reemplazar video"
                                                className="w-6 h-6 rounded-lg bg-violet-500/15 hover:bg-violet-500/30 flex items-center justify-center transition-colors disabled:opacity-40">
                                                {uploadingVid
                                                    ? <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                                                    : <Upload className="w-3 h-3 text-violet-400" />}
                                            </button>
                                        )}
                                        <button onClick={onVideoRemove}
                                            title="Quitar video"
                                            className="w-6 h-6 rounded-lg bg-red-500/15 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                            <X className="w-3 h-3 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Collapse player */}
                            {videoPlay && (
                                <button onClick={() => setVideoPlay(false)}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors">
                                    <X className="w-3 h-3 text-white" />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* No video — upload CTA */
                    <div className="rounded-xl border-2 border-dashed border-violet-500/20 dark:border-violet-500/15 hover:border-violet-500/40 transition-colors">
                        <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
                            className="hidden" onChange={handleVideoFile} />
                        <button type="button" onClick={() => videoInput.current?.click()} disabled={uploadingVid}
                            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-violet-500 dark:text-violet-400 text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-40">
                            {uploadingVid
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo a R2…</>
                                : <><Upload className="w-4 h-4" /> <Film className="w-3.5 h-3.5 -ml-1.5" /> Subir video (mp4 · mov · webm)</>
                            }
                        </button>
                    </div>
                )}

                {/* Upload error */}
                {vidError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5 px-1">
                        <X className="w-3 h-3 shrink-0" /> {vidError}
                    </p>
                )}
            </div>

            {/* Hint */}
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 shrink-0" />
                {t('carta.aurora_gallery_drag_hint')} &middot; <strong>1era Imagen = Principal ★</strong>
            </p>
        </div>
    );
};

export default MediaGallery;
