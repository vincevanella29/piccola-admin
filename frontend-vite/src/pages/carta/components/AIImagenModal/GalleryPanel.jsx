/**
 * GalleryPanel — Galería del producto con drag & drop para reordenar
 * Apple style · i18n · Tailwind
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ImageIcon, Trash2, GripVertical, Star, Sparkles, Plus } from 'lucide-react';

// ── Draggable image slot ──────────────────────────────────────────────────────

const busted = (url, upd) => {
    if (!url || typeof url !== 'string' || url.includes('?')) return url;
    if (upd) return `${url}?v=${new Date(upd).getTime()}`;
    return url;
};

const Slot = ({
    url, index, selected, isMain, isDragOver, mode, updatedAt,
    onDragStart, onDragEnter, onDragLeave, onDrop, onDragEnd,
    onClick, onRemove,
}) => {
    const { t } = useTranslation();
    const isSelectable = mode === 'image' || mode === 'video';

    if (!url) return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => onDragEnter(index)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, index)}
            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all duration-150 ${
                isDragOver
                    ? 'border-violet-500 bg-violet-500/10 scale-[1.04]'
                    : 'border-white/10 dark:border-white/8 opacity-40'
            }`}>
            {isDragOver
                ? <Plus className="w-5 h-5 text-violet-400" />
                : <>
                    <ImageIcon className="w-4 h-4 text-white/30" />
                    <span className="text-[9px] text-white/30 font-medium">{t('carta.aurora_slot', { n: index + 1 })}</span>
                  </>
            }
        </div>
    );

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={() => onDragEnter(index)}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={onDragEnd}
            onClick={() => isSelectable && onClick(url)}
            className={`relative cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden aspect-square border-2 transition-all duration-150 group select-none ${
                isDragOver
                    ? 'border-violet-500 scale-[1.04] shadow-lg shadow-violet-500/25'
                    : selected
                        ? 'border-violet-500 shadow-md shadow-violet-500/20'
                        : isMain
                            ? 'border-amber-400/80 shadow-md shadow-amber-400/15'
                            : 'border-white/10 dark:border-white/8 hover:border-violet-400/40'
            }`}>

            <img src={busted(url, updatedAt)} alt="" className="w-full h-full object-cover pointer-events-none" />

            {/* Drag handle */}
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 rounded-lg bg-black/55 backdrop-blur-sm flex items-center justify-center">
                    <GripVertical className="w-3 h-3 text-white" />
                </div>
            </div>

            {/* Principal badge */}
            {isMain && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-amber-400 text-black text-[9px] font-bold">
                    <Star className="w-2.5 h-2.5 fill-black" />
                </div>
            )}

            {/* Selected check */}
            {selected && (
                <div className="absolute inset-0 bg-violet-500/15 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-violet-500 shadow-lg flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                </div>
            )}

            {/* Remove */}
            {onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(url); }}
                    className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10">
                    <Trash2 className="w-3 h-3 text-white" />
                </button>
            )}
        </div>
    );
};

// ── Pending AI chip ───────────────────────────────────────────────────────────

const PendingChip = ({ url, onAdd, disabled, updatedAt }) => (
    <div className="relative rounded-xl overflow-hidden w-14 h-14 border-2 border-dashed border-violet-400/40 group flex-shrink-0">
        <img src={busted(url, updatedAt)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
                onClick={() => !disabled && onAdd(url)}
                disabled={disabled}
                className="w-7 h-7 rounded-full bg-violet-500 hover:bg-violet-400 flex items-center justify-center shadow transition-colors disabled:opacity-40">
                <Plus className="w-4 h-4 text-white" />
            </button>
        </div>
        <div className="absolute top-0.5 left-0.5">
            <Sparkles className="w-3 h-3 text-violet-400 drop-shadow" />
        </div>
    </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const GalleryPanel = ({
    gallery, mode, selectedRefUrl, mainImage, hasVideo, updatedAt,
    onSelect, onRemove, onReorder,
    pendingImages = [], onAddPending,
}) => {
    const { t } = useTranslation();
    const [dragFrom, setDragFrom] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const dragRef = useRef(null);

    const handleDragStart = (e, i) => {
        dragRef.current = i; setDragFrom(i);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragEnter = (i) => { if (dragRef.current !== null) setDragOver(i); };
    const handleDragLeave = () => {};
    const handleDrop = (e, to) => {
        e.preventDefault();
        const from = dragRef.current;
        if (from === null || from === to) { setDragOver(null); return; }
        const next = [...gallery];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        if (onReorder) onReorder(next);
        setDragFrom(null); setDragOver(null); dragRef.current = null;
    };
    const handleDragEnd = () => { setDragFrom(null); setDragOver(null); dragRef.current = null; };

    const galleryFull = gallery.length >= 4;
    const pendingFiltered = pendingImages.filter(u => !gallery.includes(u));

    return (
        <div className="px-4 pt-3.5 pb-3 border-b border-white/8 dark:border-white/6 bg-black/20 backdrop-blur-sm">

            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {t('carta.aurora_gallery_label', { count: gallery.length })}
                        {hasVideo && ' · 📹'}
                        {galleryFull && <span className="text-amber-400 ml-1">· {t('carta.aurora_gallery_full')}</span>}
                    </span>
                </div>
                {gallery.length > 1 && (
                    <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                        <GripVertical className="w-3 h-3" />
                        {t('carta.aurora_gallery_drag_hint')}
                    </span>
                )}
            </div>

            {/* Context hint */}
            {mode === 'image' && gallery.length > 0 && (
                <p className="text-[10px] text-violet-400 font-medium mb-2">
                    🎯 {t('carta.aurora_gallery_select_hint')}
                    {selectedRefUrl
                        ? ` — ${t('carta.aurora_gallery_select_change')}`
                        : ` — ${t('carta.aurora_gallery_select_tap')}`}
                </p>
            )}
            {mode === 'video' && gallery.length > 0 && !selectedRefUrl && (
                <p className="text-[10px] text-violet-400 font-medium mb-2">
                    🎬 {t('carta.aurora_gallery_video_hint')}
                </p>
            )}

            {/* 4-slot grid */}
            <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => {
                    const url = gallery[i];
                    return (
                        <Slot
                            key={`slot-${i}`}
                            url={url} index={i}
                            selected={(mode === 'image' || mode === 'video') && selectedRefUrl === url}
                            isMain={i === 0 && !!url}
                            isDragOver={dragOver === i && dragFrom !== i}
                            mode={mode}
                            updatedAt={updatedAt}
                            onDragStart={handleDragStart}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            onClick={onSelect}
                            onRemove={onRemove}
                        />
                    );
                })}
            </div>

            {/* Pending AI images */}
            {pendingFiltered.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/8">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
                            {t('carta.aurora_pending_label')}
                        </span>
                        {galleryFull && (
                            <span className="text-[9px] text-amber-400">({t('carta.aurora_pending_full')})</span>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {pendingFiltered.map(url => (
                            <PendingChip key={url} url={url} disabled={galleryFull} onAdd={onAddPending} updatedAt={updatedAt} />
                        ))}
                    </div>
                    {!galleryFull && (
                        <p className="text-[9px] text-white/30 mt-1.5">{t('carta.aurora_pending_tap_hint')}</p>
                    )}
                </div>
            )}

            {/* Empty state */}
            {mode === 'image' && gallery.length === 0 && (
                <p className="text-xs text-white/30 text-center mt-2">{t('carta.aurora_gallery_empty_image')}</p>
            )}
            {mode === 'video' && gallery.length === 0 && (
                <p className="text-xs text-amber-400 text-center mt-2">{t('carta.aurora_gallery_empty_video')}</p>
            )}
        </div>
    );
};

export default GalleryPanel;
