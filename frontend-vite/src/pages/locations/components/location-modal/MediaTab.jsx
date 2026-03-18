import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Upload, Star, Trash2 } from 'lucide-react';

const MediaTab = ({
    coverPreview, coverFile, onCoverChange,
    existingMedia, galleryFiles, onGalleryChange, onRemoveNewFile,
    deletedUrls, onToggleDelete, loading,
}) => {
    const { t } = useTranslation();
    const m = (k) => t(`location.modal.media.${k}`);

    const coverInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    return (
        <div className="space-y-6">
            {/* Cover image */}
            <div>
                <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                    {m('coverTitle')}
                </p>
                <div
                    className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-dashed border-light-border dark:border-dark-border cursor-pointer hover:border-light-accent dark:hover:border-dark-accent transition-colors group"
                    onClick={() => coverInputRef.current?.click()}
                >
                    {coverPreview ? (
                        <>
                            <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="text-white text-sm font-semibold flex items-center gap-2">
                                    <ImagePlus className="w-5 h-5" /> {m('changeCover')}
                                </div>
                            </div>
                            {coverFile && (
                                <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                    <Star className="w-3 h-3" /> {m('newCover')}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                            <ImagePlus className="w-8 h-8 opacity-40" />
                            <span className="text-sm">{m('uploadCover')}</span>
                        </div>
                    )}
                </div>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverChange} disabled={loading} />
            </div>

            {/* Gallery */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        {m('galleryTitle').replace('{{count}}', existingMedia.length + galleryFiles.length)}
                    </p>
                    <button onClick={() => galleryInputRef.current?.click()} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-xs font-semibold hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> {m('addPhotos')}
                    </button>
                </div>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onGalleryChange} disabled={loading} />

                <div className="grid grid-cols-3 gap-2">
                    {existingMedia.map((url, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden aspect-square group/img">
                            <img src={url} alt={`media-${idx}`} className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 transition-all ${deletedUrls.includes(url) ? 'bg-red-500/60' : 'bg-black/0 group-hover/img:bg-black/30'}`} />
                            <button onClick={() => onToggleDelete(url)}
                                className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                    deletedUrls.includes(url)
                                        ? 'bg-red-500 text-white opacity-100'
                                        : 'bg-black/50 text-white opacity-0 group-hover/img:opacity-100'
                                }`}>
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {galleryFiles.map((f, idx) => (
                        <div key={`new-${idx}`} className="relative rounded-xl overflow-hidden aspect-square group/img border-2 border-emerald-500/40">
                            <img src={URL.createObjectURL(f)} alt={`new-${idx}`} className="w-full h-full object-cover" />
                            <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">NEW</div>
                            <button onClick={() => onRemoveNewFile(idx)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {(existingMedia.length + galleryFiles.length) === 0 && (
                        <div className="col-span-3 flex flex-col items-center justify-center py-8 gap-2 text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                            <ImagePlus className="w-8 h-8" />
                            <p className="text-xs">{m('noPhotos')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaTab;
