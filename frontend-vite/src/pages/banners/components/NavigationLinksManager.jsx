import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Link2, Plus, Trash2, GripVertical, ExternalLink, Save,
    CheckCircle, Loader2, Globe, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import {
    FaGem, FaShoppingBag, FaPoll, FaUserTie, FaUtensils, FaWhatsapp,
    FaInstagram, FaFacebook, FaTiktok, FaPhoneAlt, FaMapMarkerAlt,
    FaStar, FaHeart, FaGift, FaCalendar, FaBook, FaHome,
} from 'react-icons/fa';
import { fetchNavigationLinks, updateNavigationLinks } from '../../../utils/cartaData';

const ICON_OPTIONS = [
    { value: 'FaGem', label: 'Gem', Icon: FaGem },
    { value: 'FaShoppingBag', label: 'Shopping', Icon: FaShoppingBag },
    { value: 'FaPoll', label: 'Poll', Icon: FaPoll },
    { value: 'FaUserTie', label: 'User', Icon: FaUserTie },
    { value: 'FaUtensils', label: 'Menu', Icon: FaUtensils },
    { value: 'FaWhatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
    { value: 'FaInstagram', label: 'Instagram', Icon: FaInstagram },
    { value: 'FaFacebook', label: 'Facebook', Icon: FaFacebook },
    { value: 'FaTiktok', label: 'TikTok', Icon: FaTiktok },
    { value: 'FaPhoneAlt', label: 'Phone', Icon: FaPhoneAlt },
    { value: 'FaMapMarkerAlt', label: 'Location', Icon: FaMapMarkerAlt },
    { value: 'FaStar', label: 'Star', Icon: FaStar },
    { value: 'FaHeart', label: 'Heart', Icon: FaHeart },
    { value: 'FaGift', label: 'Gift', Icon: FaGift },
    { value: 'FaCalendar', label: 'Calendar', Icon: FaCalendar },
    { value: 'FaBook', label: 'Book', Icon: FaBook },
    { value: 'FaHome', label: 'Home', Icon: FaHome },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.value, o.Icon]));

const PLACEMENT_OPTIONS = [
    { key: 'sidebar', label: 'Sidebar' },
    { key: 'header', label: 'Header' },
    { key: 'footer', label: 'Footer' },
];

const INPUT = 'w-full px-3 py-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-shadow';

const EMPTY_LINK = {
    label: '',
    labelFallback: '',
    path: '',
    icon: 'FaGem',
    order: 99,
    locations: ['sidebar', 'footer'],
    external: true,
    newTab: true,
    category: 'club.category',
    homeStyle: '',
    minRoleLevel: -1,
};

// Preset: existing carta-piccola navigationLinks.json — loaded when DB is empty
const DEFAULT_LINKS = [
    {
        label: 'home.reservation',
        labelFallback: 'Reserva con Nosotros',
        path: 'https://vnlx.piccolaitalia.cl/',
        category: 'menus.category',
        icon: 'FaCalendarAlt',
        order: 0,
        orderFooter: null,
        orderHeader: null,
        orderWalletMenu: null,
        locations: ['sidebar'],
        description: 'home.reservation_desc',
        external: true,
        newTab: true,
        isMainPage: false,
        isSearchable: false,
        homeStyle: 'cta',
        minRoleLevel: -1,
    },
    {
        label: 'home.club',
        labelFallback: 'Club della Nonna',
        path: 'https://testing.lapiccolaitalia.cl/',
        category: 'club.category',
        icon: 'FaGem',
        order: 1,
        orderFooter: 2,
        orderHeader: 2,
        orderWalletMenu: null,
        locations: ['sidebar', 'header', 'footer'],
        description: 'home.club_desc',
        external: true,
        newTab: true,
        isMainPage: false,
        isSearchable: false,
        homeStyle: 'club',
        minRoleLevel: -1,
    },
    {
        label: 'external.delivery',
        labelFallback: 'Delivery',
        path: 'https://tienda.lapiccolaitalia.cl/',
        category: 'menus.category',
        icon: 'FaShoppingBag',
        order: 2,
        orderFooter: 3,
        orderHeader: 3,
        orderWalletMenu: null,
        locations: ['sidebar', 'header', 'footer'],
        description: 'external.delivery_desc',
        external: true,
        newTab: true,
        isMainPage: false,
        isSearchable: false,
        homeStyle: '',
        minRoleLevel: -1,
    },
    {
        label: 'external.survey',
        labelFallback: 'Sugerencias o Reclamos',
        path: 'https://docs.google.com/forms/d/e/1FAIpQLSeZxzSiG_F568uGfL2ubjh3diuQtyr0_dz5bvc78pyWIYG1Ww/viewform',
        category: 'club.category',
        icon: 'FaPoll',
        order: 3,
        orderFooter: 4,
        orderHeader: null,
        orderWalletMenu: null,
        locations: ['sidebar', 'footer'],
        description: 'external.survey_desc',
        external: true,
        newTab: true,
        isMainPage: false,
        isSearchable: false,
        homeStyle: '',
        minRoleLevel: -1,
    },
    {
        label: 'external.workWithUs',
        labelFallback: 'Trabaja con Nosotros',
        path: 'https://docs.google.com/forms/d/e/1FAIpQLSc9TnEFDpkrMQxwwIffldvF0_OPFC1Ys03PPgUJt4UUNVhPaQ/viewform',
        category: 'club.category',
        icon: 'FaUserTie',
        order: 4,
        orderFooter: 5,
        orderHeader: null,
        orderWalletMenu: null,
        locations: ['sidebar', 'footer'],
        description: 'external.workWithUs_desc',
        external: true,
        newTab: true,
        isMainPage: false,
        isSearchable: false,
        homeStyle: '',
        minRoleLevel: -1,
    },
];

const NavigationLinksManager = ({ appState }) => {
    const { t } = useTranslation();
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchNavigationLinks({
                token: appState?.token,
                account: appState?.account,
            });
            const fetched = res?.links || [];
            // If DB is empty, pre-populate with existing carta-piccola defaults
            setLinks(fetched.length > 0 ? fetched : DEFAULT_LINKS);
        } catch (err) {
            console.error('Error loading navigation links:', err);
            // Even on error, show defaults so the admin has something to work with
            setLinks(DEFAULT_LINKS);
        } finally {
            setLoading(false);
        }
    }, [appState?.token, appState?.account]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = () => {
        setLinks(prev => [...prev, { ...EMPTY_LINK, order: prev.length + 1 }]);
        setExpandedIdx(links.length);
        setShowSuccess(false);
    };

    const handleRemove = (idx) => {
        setLinks(prev => prev.filter((_, i) => i !== idx));
        setExpandedIdx(null);
        setShowSuccess(false);
    };

    const handleChange = (idx, field, val) => {
        setLinks(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: val };
            return copy;
        });
        setShowSuccess(false);
    };

    const handleTogglePlacement = (idx, placement) => {
        setLinks(prev => {
            const copy = [...prev];
            const locs = [...(copy[idx].locations || [])];
            if (locs.includes(placement)) {
                copy[idx] = { ...copy[idx], locations: locs.filter(l => l !== placement) };
            } else {
                copy[idx] = { ...copy[idx], locations: [...locs, placement] };
            }
            return copy;
        });
        setShowSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateNavigationLinks({
                token: appState?.token,
                account: appState?.account,
                links,
            });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const moveLink = (idx, dir) => {
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= links.length) return;
        setLinks(prev => {
            const copy = [...prev];
            [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
            return copy.map((l, i) => ({ ...l, order: i + 1 }));
        });
        setExpandedIdx(newIdx);
        setShowSuccess(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-light-accent dark:text-dark-accent" size={40} />
                <p className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm">
                    {t('carta_config.loading_links', 'Cargando links...')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header info */}
            <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 rounded-2xl p-4 border border-light-border/30 dark:border-dark-border/30">
                <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                    <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                        {t('carta_config.nav_title', 'Links de Navegación')}
                    </h3>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {t('carta_config.nav_desc', 'Links que aparecen en el sidebar, header y footer de la carta digital pública.')}
                </p>
            </div>

            {/* Links list */}
            <div className="space-y-2">
                <AnimatePresence initial={false}>
                    {links.map((link, idx) => {
                        const IconComp = ICON_MAP[link.icon] || FaGem;
                        const isExpanded = expandedIdx === idx;

                        return (
                            <motion.div
                                key={idx}
                                layout
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden shadow-sm"
                            >
                                {/* Collapsed row */}
                                <div
                                    className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition-colors"
                                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                >
                                    <div className="hidden sm:flex text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                                        <GripVertical className="w-4 h-4 opacity-40" />
                                    </div>

                                    <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
                                        <IconComp className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                                            {link.labelFallback || link.label || 'Sin título'}
                                        </p>
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate">
                                            {link.path || 'Sin URL'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {link.homeStyle && (
                                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${link.homeStyle === 'cta'
                                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                                }`}>
                                                {link.homeStyle}
                                            </span>
                                        )}
                                        {(link.locations || []).map(loc => (
                                            <span key={loc} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
                                                {loc}
                                            </span>
                                        ))}
                                    </div>

                                    <ChevronDown className={`w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Expanded editor */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-4 pt-0 space-y-3 border-t border-light-border/20 dark:border-dark-border/20">
                                                <div className="h-px" />

                                                {/* Row 1: Label + Label Fallback */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                                            {t('carta_config.nav_i18n_key', 'Key i18n')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="home.club"
                                                            value={link.label}
                                                            onChange={e => handleChange(idx, 'label', e.target.value)}
                                                            className={INPUT}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                                            {t('carta_config.nav_fallback', 'Texto visible')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="Club della Nonna"
                                                            value={link.labelFallback || ''}
                                                            onChange={e => handleChange(idx, 'labelFallback', e.target.value)}
                                                            className={INPUT}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 2: URL + Icon */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                                            URL
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="https://..."
                                                                value={link.path}
                                                                onChange={e => handleChange(idx, 'path', e.target.value)}
                                                                className={INPUT}
                                                            />
                                                            <ExternalLink className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                                            {t('carta_config.nav_icon', 'Ícono')}
                                                        </label>
                                                        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 border border-light-border/30 dark:border-dark-border/30">
                                                            {ICON_OPTIONS.map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => handleChange(idx, 'icon', opt.value)}
                                                                    title={opt.label}
                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${link.icon === opt.value
                                                                        ? 'bg-light-accent dark:bg-dark-accent text-white scale-110 shadow-sm'
                                                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
                                                                        }`}
                                                                >
                                                                    <opt.Icon className="w-3 h-3" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 3: Placement + Toggles */}
                                                <div className="flex flex-wrap items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                                            {t('carta_config.nav_show_in', 'Mostrar en')}
                                                        </span>
                                                        {PLACEMENT_OPTIONS.map(p => (
                                                            <button
                                                                key={p.key}
                                                                onClick={() => handleTogglePlacement(idx, p.key)}
                                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${(link.locations || []).includes(p.key)
                                                                    ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent'
                                                                    : 'border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent dark:hover:border-dark-accent'
                                                                    }`}
                                                            >
                                                                {p.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={link.external ?? true}
                                                            onChange={e => handleChange(idx, 'external', e.target.checked)}
                                                            className="accent-[var(--accent)] w-3.5 h-3.5"
                                                        />
                                                        <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Externo
                                                        </span>
                                                    </label>

                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={link.newTab ?? true}
                                                            onChange={e => handleChange(idx, 'newTab', e.target.checked)}
                                                            className="accent-[var(--accent)] w-3.5 h-3.5"
                                                        />
                                                        <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Nueva pestaña
                                                        </span>
                                                    </label>
                                                </div>

                                                {/* Row 4: Home Style */}
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                                        Estilo en Home
                                                    </label>
                                                    <select
                                                        value={link.homeStyle || ''}
                                                        onChange={e => handleChange(idx, 'homeStyle', e.target.value)}
                                                        className={INPUT}
                                                    >
                                                        <option value="">Normal (gris)</option>
                                                        <option value="cta">CTA Principal (Dorado)</option>
                                                        <option value="club">Club (Morado)</option>
                                                    </select>
                                                </div>

                                                {/* Actions row */}
                                                <div className="flex items-center justify-between pt-2 border-t border-light-border/20 dark:border-dark-border/20">
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => moveLink(idx, -1)}
                                                            disabled={idx === 0}
                                                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-30 hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                                                        >
                                                            ↑ Subir
                                                        </button>
                                                        <button
                                                            onClick={() => moveLink(idx, 1)}
                                                            disabled={idx === links.length - 1}
                                                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-30 hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                                                        >
                                                            ↓ Bajar
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemove(idx)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {links.length === 0 && (
                    <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl py-14 text-center bg-light-surface-secondary/10">
                        <Link2 className="mx-auto text-light-text-secondary dark:text-dark-text-secondary mb-3 opacity-30" size={40} />
                        <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {t('carta_config.nav_none_title', 'Sin links configurados')}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {t('carta_config.nav_none_desc', 'Agrega links para el sidebar, header y footer de la carta digital.')}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-light-border/30 dark:border-dark-border/30">
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" /> {t('carta_config.nav_add', 'Agregar Link')}
                </button>
                <div className="flex items-center gap-3">
                    <AnimatePresence>
                        {showSuccess && (
                            <motion.span
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                {t('carta_config.saved', '¡Guardado!')}
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold shadow-neon hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('carta_config.save', 'Guardar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NavigationLinksManager;
