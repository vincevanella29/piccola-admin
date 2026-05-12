// src/pages/delivery/components/ProviderModal.jsx
// Modal for creating/editing delivery order providers
// On create: auto-generates Dilithium keypair + API key + BIP39 mnemonic
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSave, FaSpinner, FaShieldAlt, FaCopy, FaCheck, FaExclamationTriangle, FaSearch, FaCheckCircle, FaTimesCircle, FaSync } from 'react-icons/fa';
import * as deliveryApi from '../../../utils/deliveryData';

const PROVIDER_TYPES = [
    { value: 'api_key', labelKey: 'prov_modal_type_apikey', descKey: 'prov_modal_type_apikey_desc' },
    { value: 'webhook', labelKey: 'prov_modal_type_webhook', descKey: 'prov_modal_type_webhook_desc' },
];

const EMPTY_FORM = {
    name: '',
    slug: '',
    type: 'api_key',
    description: '',
    domain: '',
    logo_url: '',
    allowed_origins: '',
};

// ── Mnemonic Reveal Modal ────────────────────────────────────
const MnemonicReveal = ({ mnemonic, apiKey, slug, claimed, claimError, onClose, t }) => {
    const words = mnemonic ? mnemonic.split(' ') : [];
    const [copied, setCopied] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const copyMnemonic = () => {
        navigator.clipboard.writeText(mnemonic);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyApiKey = () => {
        navigator.clipboard.writeText(apiKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="relative bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-light-border/8 dark:border-dark-border/8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-matrix-green/10 rounded-xl flex items-center justify-center">
                            <FaShieldAlt className="text-matrix-green" size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                                {t('delivery.prov_mnemonic_title')}
                            </h2>
                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                Dilithium2 · Post-Quantum · {slug}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Warning */}
                <div className="mx-6 mt-4 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-start gap-3">
                    <FaExclamationTriangle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                    <div>
                        <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">
                            {t('delivery.prov_mnemonic_warning')}
                        </p>
                        <p className="text-[12px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                            {t('delivery.prov_mnemonic_warning_desc')}
                        </p>
                    </div>
                </div>

                {/* Claim status */}
                <div className={`mx-6 mt-3 px-4 py-3 rounded-xl flex items-start gap-3 ${
                    claimed
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                    {claimed ? (
                        <FaCheck className="text-green-500 shrink-0 mt-0.5" size={16} />
                    ) : (
                        <FaExclamationTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    )}
                    <div>
                        <p className={`text-sm font-semibold ${claimed ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {claimed ? t('delivery.prov_mnemonic_linked') + ' ✓' : t('delivery.prov_mnemonic_manual')}
                        </p>
                        <p className={`text-xs mt-0.5 ${claimed ? 'text-green-600/70 dark:text-green-400/70' : 'text-amber-600/70 dark:text-amber-400/70'}`}>
                            {claimed
                                ? 'La API key y mnemónica fueron configuradas automáticamente.'
                                : claimError || 'Guarda la frase y configúrala manualmente en el .env del delivery app.'
                            }
                        </p>
                    </div>
                </div>

                {/* Mnemonic Grid */}
                <div className="px-6 py-4">
                    <div className="grid grid-cols-4 gap-2">
                        {words.map((word, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg border border-light-border/10 dark:border-dark-border/10"
                            >
                                <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono w-4 text-right">
                                    {i + 1}
                                </span>
                                <span className="text-xs font-mono font-semibold text-light-text-primary dark:text-dark-text-primary">
                                    {word}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={copyMnemonic}
                        className="mt-3 w-full px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2
                            bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10
                            hover:border-matrix-green/50 text-light-text-primary dark:text-dark-text-primary"
                    >
                        {copied ? <FaCheck size={12} className="text-matrix-green" /> : <FaCopy size={12} />}
                        {copied ? t('delivery.prov_mnemonic_copied') + ' ✓' : t('delivery.prov_mnemonic_copy')}
                    </button>
                </div>

                {/* API Key */}
                <div className="px-6 pb-4">
                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        {t('delivery.prov_mnemonic_apikey')}
                    </label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl text-[11px] font-mono text-light-text-primary dark:text-dark-text-primary truncate border border-light-border/10 dark:border-dark-border/10">
                            {apiKey}
                        </code>
                        <button
                            onClick={copyApiKey}
                            className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors text-light-text-secondary dark:text-dark-text-secondary"
                        >
                            {copiedKey ? <FaCheck size={14} className="text-matrix-green" /> : <FaCopy size={14} />}
                        </button>
                    </div>
                </div>

                {/* Confirm */}
                <div className="px-6 pb-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="w-4 h-4 rounded accent-matrix-green"
                        />
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {t('delivery.prov_mnemonic_confirm')}
                        </span>
                    </label>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-light-border/10 dark:border-dark-border/10">
                    <button
                        onClick={onClose}
                        disabled={!confirmed}
                        className="w-full px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed
                            bg-matrix-green text-white hover:bg-matrix-green/90 shadow-sm"
                    >
                        <FaShieldAlt size={14} />
                        {t('delivery.prov_mnemonic_continue')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── Commissions Section (inline in edit mode) ────────────────
const CLOSING_DAYS_KEYS = [
    { value: 'monday', key: 'prov_comm_days_mon' },
    { value: 'tuesday', key: 'prov_comm_days_tue' },
    { value: 'wednesday', key: 'prov_comm_days_wed' },
    { value: 'thursday', key: 'prov_comm_days_thu' },
    { value: 'friday', key: 'prov_comm_days_fri' },
    { value: 'saturday', key: 'prov_comm_days_sat' },
    { value: 'sunday', key: 'prov_comm_days_sun' },
];

const CommissionsSection = ({ providerId, appState, t }) => {
    const [comm, setComm] = useState({ delivery_pct: 0, platform_pct: 0, payment_pct: 0, notes: '', closing_day: 'monday' });
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const getAuth = () => ({ token: appState?.token, walletAddress: appState?.account });

    useEffect(() => {
        const load = async () => {
            try {
                const data = await deliveryApi.fetchProviderCommissions({ ...getAuth(), providerId });
                if (data.commissions) setComm(data.commissions);
            } catch (_) {}
            setLoaded(true);
        };
        load();
    }, [providerId]);

    const handleSave = async () => {
        setSaving(true);
        try { await deliveryApi.updateProviderCommissions({ ...getAuth(), providerId, data: comm }); } catch (_) {}
        setSaving(false);
    };

    if (!loaded) return null;

    const inputCls = "w-full px-3 py-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/30 transition-all";
    const labelCls = "block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5";
    const commFields = [
        { key: 'delivery_pct', label: 'prov_comm_delivery', desc: 'prov_comm_delivery_desc', base: 1500 },
        { key: 'platform_pct', label: 'prov_comm_platform', desc: 'prov_comm_platform_desc', base: 15000 },
        { key: 'payment_pct', label: 'prov_comm_payment', desc: 'prov_comm_payment_desc', base: 16500 },
    ];

    return (
        <div className="pt-5 mt-5 border-t border-light-border/8 dark:border-dark-border/8">
            <h4 className="text-[13px] font-semibold text-light-text-primary dark:text-dark-text-primary mb-0.5 tracking-tight">
                {t('delivery.prov_comm_title')}
            </h4>
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mb-4">
                {t('delivery.prov_comm_subtitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {commFields.map((f) => (
                    <div key={f.key}>
                        <label className={labelCls}>% {t(`delivery.${f.label}`)}</label>
                        <input type="number" min="0" max="100" step="0.5" value={comm[f.key]}
                            onChange={(e) => setComm({ ...comm, [f.key]: parseFloat(e.target.value) || 0 })} className={inputCls} />
                        <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-1">{t(`delivery.${f.desc}`)}</p>
                        <p className="text-[10px] font-mono text-light-text-secondary/40 dark:text-dark-text-secondary/40 mt-0.5">
                            ${f.base.toLocaleString()} × {comm[f.key] || 0}% = ${Math.round(f.base * (comm[f.key] || 0) / 100).toLocaleString()}
                        </p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                    <label className={labelCls}>{t('delivery.prov_comm_closing_day')}</label>
                    <select value={comm.closing_day} onChange={(e) => setComm({ ...comm, closing_day: e.target.value })} className={inputCls}>
                        {CLOSING_DAYS_KEYS.map(d => <option key={d.value} value={d.value}>{t(`delivery.${d.key}`)}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className={labelCls}>{t('delivery.prov_comm_notes')}</label>
                    <input type="text" value={comm.notes} onChange={(e) => setComm({ ...comm, notes: e.target.value })} placeholder="..." className={inputCls} />
                </div>
            </div>
            <div className="flex justify-end mt-4">
                <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-matrix-green text-white hover:bg-matrix-green/90 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.97]">
                    {saving ? <FaSpinner size={10} className="animate-spin" /> : <FaSave size={10} />}
                    {t('delivery.prov_comm_save')}
                </button>
            </div>
        </div>
    );
};

// ── Re-Sync Section (push updated admin_api_url) ─────────────
const ResyncSection = ({ providerId, onResync, t }) => {
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState(null);

    const handleResync = async () => {
        setSyncing(true);
        setResult(null);
        try {
            const res = await onResync(providerId);
            setResult({ success: true, admin_api_url: res.admin_api_url });
        } catch (e) {
            setResult({ success: false, error: e.message || 'Error al re-sincronizar' });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="pt-5 mt-5 border-t border-light-border/8 dark:border-dark-border/8">
            <h4 className="text-[13px] font-semibold text-light-text-primary dark:text-dark-text-primary mb-0.5 tracking-tight">
                Re-Sync Config
            </h4>
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mb-3">
                Actualizar la URL del admin en la delivery app (útil después de cambiar el dominio o mover a producción).
            </p>
            <button
                onClick={handleResync}
                disabled={syncing}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-[0.97]"
            >
                {syncing ? <FaSpinner size={11} className="animate-spin" /> : <FaSync size={11} />}
                Re-Sync Admin URL
            </button>
            {result && (
                <div className={`mt-3 p-3 rounded-xl border text-xs font-medium ${
                    result.success
                        ? 'bg-green-500/5 border-green-500/20 text-green-500'
                        : 'bg-red-500/5 border-red-500/20 text-red-500'
                }`}>
                    {result.success
                        ? `✅ Config actualizada → ${result.admin_api_url}`
                        : `❌ ${result.error}`
                    }
                </div>
            )}
        </div>
    );
};

// ── Provider Modal ───────────────────────────────────────────
const ProviderModal = ({ isOpen, onClose, onSave, onAutoLink, onResync, provider = null, presets = {}, mode = 'own', t, appState }) => {
    const isEdit = !!provider;
    const isOwn = mode === 'own';
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Probe state
    const [isProbing, setIsProbing] = useState(false);
    const [probeResult, setProbeResult] = useState(null);

    // Mnemonic reveal state
    const [mnemonicData, setMnemonicData] = useState(null);

    // Init form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (provider) {
                setForm({
                    name: provider.name || '',
                    slug: provider.slug || '',
                    type: provider.type || 'api_key',
                    description: provider.description || '',
                    domain: provider.domain || '',
                    logo_url: provider.logo_url || '',
                    allowed_origins: (provider.allowed_origins || []).join(', '),
                });
            } else {
                setForm(EMPTY_FORM);
            }
            setErrors({});
            setMnemonicData(null);
            setProbeResult(null);
        }
    }, [isOpen, provider]);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    };

    // Fill from preset
    const applyPreset = (presetKey) => {
        const preset = presets[presetKey];
        if (!preset) return;
        setForm({
            name: preset.name || '',
            slug: preset.slug || '',
            type: preset.type || 'api_key',
            description: preset.description || '',
            domain: preset.domain || '',
            logo_url: preset.logo_url || '',
            allowed_origins: '',
        });
        setProbeResult(null);
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = t('delivery.prov_modal_name') + ' *';
        if (!form.slug.trim()) errs.slug = t('delivery.prov_modal_slug') + ' *';
        if (form.slug && !/^[a-z0-9_-]+$/.test(form.slug)) errs.slug = 'a-z, 0-9, -, _';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSaving(true);
        try {
            const data = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                type: form.type,
                description: form.description.trim() || null,
                domain: form.domain.trim() || null,
                logo_url: form.logo_url.trim() || null,
                allowed_origins: form.allowed_origins
                    ? form.allowed_origins.split(',').map((s) => s.trim()).filter(Boolean)
                    : [],
            };

            if (isEdit) {
                // Edit: standard update
                await onSave(data, provider._id);
                onClose();
            } else if (isOwn) {
                // Own delivery: auto-link with Dilithium
                const res = await onAutoLink(data);
                setMnemonicData({
                    mnemonic: res.mnemonic,
                    apiKey: res.api_key,
                    slug: res.slug,
                    claimed: res.claimed,
                    claimError: res.claim_error,
                });
            } else {
                // External webhook: standard create
                data.type = 'webhook';
                await onSave(data);
                onClose();
            }
        } catch (err) {
            // toast handled by hook
        } finally {
            setIsSaving(false);
        }
    };

    const handleMnemonicClose = () => {
        setMnemonicData(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <AnimatePresence>
                {isOpen && !mnemonicData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" onClick={onClose} />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', duration: 0.4 }}
                            className="relative bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-light-border/8 dark:border-dark-border/8">
                                <div>
                                    <h2 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                                        {isEdit ? t('delivery.prov_modal_edit') : isOwn ? t('delivery.prov_modal_create_own') : t('delivery.prov_modal_create_ext')}
                                    </h2>
                                    {!isEdit && isOwn && (
                                        <p className="text-[11px] text-matrix-green font-mono flex items-center gap-1 mt-0.5">
                                            <FaShieldAlt size={9} /> Dilithium2 · Post-Quantum
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>

                            {/* Presets (only for own delivery) */}
                            {!isEdit && isOwn && Object.keys(presets).length > 0 && (
                                <div className="px-6 pt-4">
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2 font-medium">{t('delivery.prov_modal_presets')}:</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {Object.entries(presets).map(([key, preset]) => (
                                            <button
                                                key={key}
                                                onClick={() => applyPreset(key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                    form.slug === preset.slug
                                                        ? 'bg-matrix-green/20 border-matrix-green text-matrix-green'
                                                        : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary hover:border-matrix-green/50'
                                                }`}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Form */}
                            <div className="px-6 py-4 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_name')} *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        placeholder="Vanellix Delivery"
                                        className={`w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all ${
                                            errors.name ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'
                                        }`}
                                    />
                                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                </div>

                                {/* Slug */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_slug')} * <span className="text-light-text-secondary/50 dark:text-dark-text-secondary/50">({t('delivery.prov_modal_slug_hint')})</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                        placeholder="vanellix"
                                        disabled={isEdit}
                                        className={`w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border text-sm font-mono text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all ${
                                            isEdit ? 'opacity-50 cursor-not-allowed' : ''
                                        } ${errors.slug ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                    />
                                    {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug}</p>}
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_type')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PROVIDER_TYPES.map((pt) => (
                                            <button
                                                key={pt.value}
                                                onClick={() => handleChange('type', pt.value)}
                                                className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                                                    form.type === pt.value
                                                        ? 'bg-matrix-green/10 border-matrix-green text-matrix-green'
                                                        : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary hover:border-matrix-green/30'
                                                }`}
                                            >
                                                <p className="text-sm font-semibold">{t(`delivery.${pt.labelKey}`)}</p>
                                                <p className="text-[10px] opacity-70 mt-0.5">{t(`delivery.${pt.descKey}`)}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_description')}
                                    </label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="..."
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all resize-none"
                                    />
                                </div>

                                {/* Domain */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_domain')} <span className="text-light-text-secondary/50 dark:text-dark-text-secondary/50">({t('delivery.prov_modal_domain_hint')})</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={form.domain}
                                            onChange={(e) => { handleChange('domain', e.target.value); setProbeResult(null); }}
                                            placeholder="http://localhost:8082"
                                            className="flex-1 px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!form.domain.trim()) return;
                                                setIsProbing(true);
                                                setProbeResult(null);
                                                try {
                                                    const res = await deliveryApi.probeDeliveryDomain({
                                                        token: appState?.token,
                                                        walletAddress: appState?.account,
                                                        domain: form.domain.trim(),
                                                    });
                                                    setProbeResult(res);
                                                } catch (err) {
                                                    setProbeResult({ success: false, error: err.message });
                                                } finally {
                                                    setIsProbing(false);
                                                }
                                            }}
                                            disabled={isProbing || !form.domain.trim()}
                                            className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                                        >
                                            {isProbing ? <FaSpinner size={11} className="animate-spin" /> : <FaSearch size={11} />}
                                            {t('delivery.prov_modal_probe')}
                                        </button>
                                    </div>

                                    {/* Probe Results */}
                                    {probeResult && (
                                        <div className={`mt-3 rounded-xl border p-3 space-y-1.5 ${probeResult.healthy ? 'bg-emerald-500/5 border-emerald-500/20' : probeResult.success === false ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                            {probeResult.success === false ? (
                                                <p className="text-xs text-red-400 font-medium">❌ {probeResult.error || t('delivery.prov_probe_fail')}</p>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-xs font-bold ${probeResult.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                            {probeResult.healthy ? '✅ ' + t('delivery.prov_probe_available') : '⚠️ ' + t('delivery.prov_probe_partial')}
                                                        </span>
                                                        <span className="text-[10px] text-light-text-secondary/50 dark:text-dark-text-secondary/50">
                                                            {t('delivery.prov_probe_routes', { available: probeResult.available, total: probeResult.total })}
                                                        </span>
                                                    </div>
                                                    {probeResult.routes?.map((r) => (
                                                        <div key={r.route} className="flex items-center gap-2 text-[11px]">
                                                            {r.available
                                                                ? <FaCheckCircle size={10} className="text-emerald-500 shrink-0" />
                                                                : <FaTimesCircle size={10} className="text-red-400 shrink-0" />
                                                            }
                                                            <span className="font-mono text-light-text-secondary dark:text-dark-text-secondary truncate">{r.path}</span>
                                                            <span className={`ml-auto text-[10px] ${r.available ? 'text-emerald-500/60' : 'text-red-400/60'}`}>
                                                                {r.status || r.error || '—'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {probeResult.claim_info?.claimed && (
                                                        <div className="mt-2 pt-2 border-t border-light-border/10 dark:border-dark-border/10">
                                                            <p className="text-[10px] text-amber-400 font-medium">⚠️ {t('delivery.prov_probe_claimed')}</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Allowed Origins */}
                                <div>
                                    <label className="block text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                                        {t('delivery.prov_modal_origins')} <span className="text-light-text-secondary/50 dark:text-dark-text-secondary/50">({t('delivery.prov_modal_origins_hint')})</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.allowed_origins}
                                        onChange={(e) => handleChange('allowed_origins', e.target.value)}
                                        placeholder="https://delivery.vanellix.com, https://..."
                                        className="w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all"
                                    />
                                </div>

                                {/* Commissions — only in edit mode */}
                                {isEdit && provider?._id && (
                                    <CommissionsSection providerId={provider._id} appState={appState} t={t} />
                                )}

                                {/* Re-Sync — only in edit mode */}
                                {isEdit && provider?._id && provider?.dilithium_pk && onResync && (
                                    <ResyncSection providerId={provider._id} onResync={onResync} t={t} />
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-light-border/8 dark:border-dark-border/8">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl text-[13px] font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                                >
                                    {t('delivery.prov_modal_cancel')}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-matrix-green text-white hover:bg-matrix-green/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                                >
                                    {isSaving ? <FaSpinner size={14} className="animate-spin" /> : isOwn ? <FaShieldAlt size={14} /> : <FaSave size={14} />}
                                    {isEdit ? t('delivery.prov_modal_save') : isOwn ? t('delivery.prov_modal_link_dilithium') + ' 🔒' : t('delivery.prov_modal_add_webhook')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mnemonic Reveal */}
            <AnimatePresence>
                {mnemonicData && (
                    <MnemonicReveal
                        mnemonic={mnemonicData.mnemonic}
                        apiKey={mnemonicData.apiKey}
                        slug={mnemonicData.slug}
                        claimed={mnemonicData.claimed}
                        claimError={mnemonicData.claimError}
                        onClose={handleMnemonicClose}
                        t={t}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default ProviderModal;
