import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Globe, MapPin, Tag, Layers, Calendar, Clock, Eye, EyeOff, Smartphone, Monitor } from 'lucide-react';

const TARGET_ICONS = { global: Globe, location: MapPin, dish: Tag, category: Layers };

const BannerCard = ({ banner, index, onEdit, onDelete, locations = [] }) => {
    const { t } = useTranslation();

    const hasSchedule = !!(banner.schedule_start || banner.schedule_end || banner.schedule_days?.length);
    const TargetIcon = TARGET_ICONS[banner.target_type] || Globe;

    const locationNames = (banner.location_ids || []).length > 0
        ? locations
            .filter(l => (banner.location_ids || []).includes(String(l.id || l._id)))
            .map(l => l.nombre)
            .slice(0, 2)
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="group bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden hover:shadow-xl hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all duration-300"
        >
            {/* Image */}
            <div className="relative h-36 overflow-hidden bg-gradient-to-br from-light-surface-secondary to-light-surface dark:from-dark-surface-secondary dark:to-dark-surface">
                {banner.image_url ? (
                    <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                        <Eye className="w-10 h-10" />
                    </div>
                )}

                {/* Overlay badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase backdrop-blur-sm
                        ${banner.active
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-red-500/90 text-white'
                        }`}
                    >
                        {banner.active ? t('banners.active') : t('banners.inactive')}
                    </span>
                    {hasSchedule && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/90 text-white backdrop-blur-sm flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {t('banners.scheduled')}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(banner)}
                        className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => { if (confirm(t('banners.confirm_delete'))) onDelete(banner.id); }}
                        className="p-1.5 rounded-lg bg-red-500/60 backdrop-blur-sm text-white hover:bg-red-500/80 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="px-4 py-3">
                <h3 className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary line-clamp-1 mb-2">
                    {banner.title}
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Target type */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        <TargetIcon className="w-3 h-3" />
                        <span className="capitalize">{banner.target_type}</span>
                    </span>

                    {/* Priority */}
                    {(banner.priority || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            #{banner.priority}
                        </span>
                    )}

                    {/* Image size */}
                    {banner.image_size && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-mono font-bold">
                            {banner.image_size}
                        </span>
                    )}

                    {/* Device badges */}
                    {(() => {
                        const devices = banner.display_devices || ['mobile', 'desktop'];
                        const isBoth = devices.includes('mobile') && devices.includes('desktop');
                        if (isBoth) return null; // don't clutter if both
                        return (
                            <>
                                {devices.includes('mobile') && (
                                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                                        <Smartphone className="w-2.5 h-2.5" /> Móvil
                                    </span>
                                )}
                                {devices.includes('desktop') && (
                                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                        <Monitor className="w-2.5 h-2.5" /> PC
                                    </span>
                                )}
                            </>
                        );
                    })()}

                    {/* Locations */}
                    {locationNames && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                            <MapPin className="w-2.5 h-2.5" />
                            {locationNames.join(', ')}
                            {(banner.location_ids || []).length > 2 && ` +${(banner.location_ids || []).length - 2}`}
                        </span>
                    )}

                    {/* Schedule */}
                    {banner.schedule_time_from && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                            <Clock className="w-2.5 h-2.5" />
                            {banner.schedule_time_from}–{banner.schedule_time_to || '∞'}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default BannerCard;
