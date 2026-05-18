// src/pages/delivery/components/CarrierModal.jsx
// Modal for creating/editing last-mile carriers (Uber Direct, PedidosYa, etc.)
// Includes: preset selector, test/prod mode toggle, credential fields, test connection button
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaTimes, FaSave, FaSpinner, FaShippingFast, FaPlug,
    FaCheckCircle, FaTimesCircle, FaFlask, FaRocket,
} from 'react-icons/fa';

const EMPTY_FORM = {
    name: '',
    slug: '',
    mode: 'test',
    description: '',
    auth_type: 'oauth2',
    grant_type: 'client_credentials',
    token_url: '',
    scope: '',
    client_id: '',
    client_secret: '',
    customer_id: '',
    username: '',
    password: '',
    api_key: '',
    header_name: 'Authorization',
    bearer_prefix: true,
    base_url: '',
    create_quote: '',
    create_delivery: '',
    cancel_delivery: '',
    get_delivery: '',
    webhook_secret: '',
    signature_header: '',
};

const CarrierModal = ({ isOpen, onClose, onSave, onTestConnection, carrier = null, presets = {}, t }) => {
    const isEdit = !!carrier;
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null); // null | { success, message/error }
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (carrier) {
                const auth = carrier.auth || {};
                const endpoints = carrier.endpoints || {};
                const webhook = carrier.webhook || {};
                setForm({
                    name: carrier.name || '',
                    slug: carrier.slug || '',
                    mode: carrier.mode || 'test',
                    description: carrier.description || '',
                    auth_type: auth.type || 'oauth2',
                    grant_type: auth.grant_type || 'client_credentials',
                    token_url: auth.token_url || '',
                    scope: auth.scope || '',
                    client_id: auth.client_id || '',
                    client_secret: auth.client_secret || '',
                    customer_id: auth.customer_id || '',
                    password: auth.password || '',
                    api_key: auth.api_key || '',
                    header_name: auth.header_name || 'Authorization',
                    bearer_prefix: auth.bearer_prefix !== undefined ? auth.bearer_prefix : true,
                    base_url: endpoints.base_url || '',
                    create_quote: endpoints.create_quote || '',
                    create_delivery: endpoints.create_delivery || '',
                    cancel_delivery: endpoints.cancel_delivery || '',
                    get_delivery: endpoints.get_delivery || '',
                    webhook_secret: webhook.secret || '',
                    signature_header: webhook.signature_header || '',
                });
            } else {
                setForm(EMPTY_FORM);
            }
            setErrors({});
            setTestResult(null);
        }
    }, [isOpen, carrier]);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
        setTestResult(null); // Reset test result on change
    };

    const applyPreset = (key) => {
        const preset = presets[key];
        if (!preset) return;
        const auth = preset.auth || {};
        const endpoints = preset.endpoints || {};
        const webhook = preset.webhook || {};
        setForm({
            name: preset.name || '',
            slug: preset.slug || '',
            mode: preset.mode || 'test',
            description: preset.description || '',
            auth_type: auth.type || 'oauth2',
            grant_type: auth.grant_type || 'client_credentials',
            token_url: auth.token_url || '',
            scope: auth.scope || '',
            client_id: '',
            client_secret: '',
            customer_id: '',
            password: '',
            api_key: '',
            header_name: auth.header_name || 'Authorization',
            bearer_prefix: auth.bearer_prefix !== undefined ? auth.bearer_prefix : true,
            base_url: endpoints.base_url || '',
            create_quote: endpoints.create_quote || '',
            create_delivery: endpoints.create_delivery || '',
            cancel_delivery: endpoints.cancel_delivery || '',
            get_delivery: endpoints.get_delivery || '',
            webhook_secret: '',
            signature_header: webhook.signature_header || '',
        });
        setTestResult(null);
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = 'Nombre obligatorio';
        if (!form.slug.trim()) errs.slug = 'Slug obligatorio';
        if (form.slug && !/^[a-z0-9_-]+$/.test(form.slug)) errs.slug = 'Solo letras, números, guiones';
        if (!form.base_url.trim()) errs.base_url = 'URL base obligatoria';
        if (!form.create_delivery.trim()) errs.create_delivery = 'Endpoint crear delivery obligatorio';
        if (form.auth_type === 'oauth2') {
            if (!form.client_id.trim()) errs.client_id = 'Client ID obligatorio';
            if (!form.client_secret.trim()) errs.client_secret = 'Client Secret obligatorio';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const buildPayload = () => ({
        name: form.name.trim(),
        slug: form.slug.trim(),
        mode: form.mode,
        description: form.description.trim() || null,
        auth: {
            type: form.auth_type,
            header_name: form.header_name.trim() || 'Authorization',
            bearer_prefix: form.bearer_prefix,
            ...(form.auth_type === 'oauth2' ? {
                grant_type: form.grant_type,
                token_url: form.token_url.trim(),
                scope: form.scope.trim(),
                client_id: form.client_id.trim(),
                client_secret: form.client_secret.trim(),
                customer_id: form.customer_id.trim() || null,
                ...(form.grant_type === 'password' ? {
                    username: form.username.trim(),
                    password: form.password.trim(),
                } : {}),
            } : {
                api_key: form.api_key.trim(),
                customer_id: form.customer_id.trim() || null,
            }),
        },
        endpoints: {
            base_url: form.base_url.trim(),
            create_quote: form.create_quote.trim() || null,
            create_delivery: form.create_delivery.trim(),
            cancel_delivery: form.cancel_delivery.trim() || null,
            get_delivery: form.get_delivery.trim() || null,
        },
        webhook: {
            secret: form.webhook_secret.trim(),
            signature_header: form.signature_header.trim(),
            events: [],
        },
        status_mapping: presets[form.slug]?.status_mapping || {},
        logo_url: presets[form.slug]?.logo_url || null,
    });

    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSaving(true);
        try {
            const data = buildPayload();
            await onSave(data, isEdit ? carrier._id : null);
            onClose();
        } catch (err) {
            // toast handled by hook
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const authPayload = {
                type: form.auth_type,
                ...(form.auth_type === 'oauth2' ? {
                    grant_type: form.grant_type,
                    token_url: form.token_url.trim(),
                    scope: form.scope.trim(),
                    client_id: form.client_id.trim(),
                    client_secret: form.client_secret.trim(),
                    ...(form.grant_type === 'password' ? {
                        username: form.username.trim(),
                        password: form.password.trim(),
                    } : {}),
                } : {
                    api_key: form.api_key.trim(),
                }),
            };
            const res = await onTestConnection({
                carrierId: isEdit ? carrier._id : null,
                auth: isEdit ? undefined : authPayload,
            });
            setTestResult(res);
        } catch (err) {
            setTestResult({ success: false, error: err.message });
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    const isOAuth = form.auth_type === 'oauth2';
    const isPreset = Object.values(presets).some(p => p.slug === form.slug);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.4 }}
                        className="relative bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border/10 dark:border-dark-border/10">
                            <div>
                                <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                    {isEdit ? 'Editar Carrier' : 'Agregar Carrier'}
                                </h2>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono flex items-center gap-1 mt-0.5">
                                    <FaShippingFast size={10} /> Last-mile delivery service
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors">
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Presets */}
                        {!isEdit && Object.keys(presets).length > 0 && (
                            <div className="px-6 pt-4">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2 font-medium">Seleccionar plataforma:</p>
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
                            {/* Mode Toggle */}
                            <div>
                                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">Modo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleChange('mode', 'test')}
                                        className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                                            form.mode === 'test'
                                                ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                                                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary hover:border-amber-500/30'
                                        }`}
                                    >
                                        <FaFlask size={14} />
                                        <div>
                                            <p className="text-sm font-semibold">Test</p>
                                            <p className="text-[10px] opacity-70">Sandbox — sin entregas reales</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleChange('mode', 'production')}
                                        className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                                            form.mode === 'production'
                                                ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400'
                                                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary hover:border-green-500/30'
                                        }`}
                                    >
                                        <FaRocket size={14} />
                                        <div>
                                            <p className="text-sm font-semibold">Producción</p>
                                            <p className="text-[10px] opacity-70">Entregas reales + cobros</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Name + Slug */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Nombre *</label>
                                    <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Uber Direct"
                                        className={`w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all ${errors.name ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                    />
                                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Slug *</label>
                                    <input type="text" value={form.slug} onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="uber_direct" disabled={isEdit}
                                        className={`w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all ${isEdit ? 'opacity-50 cursor-not-allowed' : ''} ${errors.slug ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                    />
                                    {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug}</p>}
                                </div>
                            </div>

                            {/* Form Fields: Preset (Simple) vs Custom (Advanced) */}
                            {isPreset ? (
                                <div className="space-y-4 p-5 rounded-2xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/10 dark:border-dark-border/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                                            {t?.('delivery.carriers.official_credentials') || 'Credenciales de Acceso'}
                                        </h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-matrix-green/10 text-matrix-green border border-matrix-green/20 font-medium flex items-center gap-1">
                                            <FaCheckCircle size={8} /> Auto-Configurado
                                        </span>
                                    </div>
                                    
                                    {form.slug === 'pedidosya' && (
                                        <div className="grid gap-3">
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.client_id') || 'Client ID'}</label>
                                                <input type="text" value={form.client_id} onChange={(e) => handleChange('client_id', e.target.value)} placeholder="courier_123456_cl"
                                                    className={`w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all ${errors.client_id ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.client_secret') || 'Client Secret'}</label>
                                                <input type="password" value={form.client_secret} onChange={(e) => handleChange('client_secret', e.target.value)} placeholder="••••••••••••••••"
                                                    className={`w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all ${errors.client_secret ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.username') || 'Username / Correo'}</label>
                                                <input type="text" value={form.username} onChange={(e) => handleChange('username', e.target.value)} placeholder="Ej: 404741-user@courierapi.com"
                                                    className="w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all hover:border-matrix-green/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.password') || 'Password'}</label>
                                                <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="••••••••"
                                                    className="w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all hover:border-matrix-green/30"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {form.slug === 'uber_direct' && (
                                        <div className="grid gap-3">
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.client_id') || 'Client ID'}</label>
                                                <input type="text" value={form.client_id} onChange={(e) => handleChange('client_id', e.target.value)} placeholder="Client ID"
                                                    className={`w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all ${errors.client_id ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.client_secret') || 'Client Secret'}</label>
                                                <input type="password" value={form.client_secret} onChange={(e) => handleChange('client_secret', e.target.value)} placeholder="••••••••••••••••"
                                                    className={`w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all ${errors.client_secret ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.customer_id') || 'Customer ID'}</label>
                                                <input type="text" value={form.customer_id} onChange={(e) => handleChange('customer_id', e.target.value)} placeholder="Customer ID"
                                                    className="w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all hover:border-matrix-green/30"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {form.slug === 'getjusto' && (
                                        <div className="grid gap-3">
                                            <div>
                                                <label className="block text-[10px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1 ml-1">{t?.('delivery.carriers.api_key') || 'API Key'}</label>
                                                <input type="password" value={form.api_key} onChange={(e) => handleChange('api_key', e.target.value)} placeholder="sk_live_..."
                                                    className="w-full px-4 py-3 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 shadow-sm transition-all hover:border-matrix-green/30"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Auth Type */}
                                    <div>
                                        <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Autenticación (Custom)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['oauth2', 'api_key'].map((at) => (
                                                <button key={at} onClick={() => handleChange('auth_type', at)}
                                                    className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                                                        form.auth_type === at
                                                            ? 'bg-matrix-green/10 border-matrix-green text-matrix-green'
                                                            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary'
                                                    }`}
                                                >
                                                    {at === 'oauth2' ? '🔐 OAuth2' : '🔑 API Key'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* OAuth2 fields */}
                                    {isOAuth && (
                                        <div className="space-y-3 p-4 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10">
                                            <input type="text" value={form.client_id} onChange={(e) => handleChange('client_id', e.target.value)} placeholder="Client ID *"
                                                className={`w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 ${errors.client_id ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                            />
                                            <input type="password" value={form.client_secret} onChange={(e) => handleChange('client_secret', e.target.value)} placeholder="Client Secret *"
                                                className={`w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 ${errors.client_secret ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                            />
                                            {form.grant_type === 'password' && (
                                                <>
                                                    <input type="text" value={form.username} onChange={(e) => handleChange('username', e.target.value)} placeholder="Username *"
                                                        className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                                    />
                                                    <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="Password *"
                                                        className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                                    />
                                                </>
                                            )}
                                            <input type="text" value={form.customer_id} onChange={(e) => handleChange('customer_id', e.target.value)} placeholder="Customer ID"
                                                className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="text" value={form.token_url} onChange={(e) => handleChange('token_url', e.target.value)} placeholder="Token URL"
                                                    className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                                />
                                                <input type="text" value={form.scope} onChange={(e) => handleChange('scope', e.target.value)} placeholder="Scope"
                                                    className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* API Key fields */}
                                    {!isOAuth && (
                                        <div className="space-y-3 p-4 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10">
                                            <input type="password" value={form.api_key} onChange={(e) => handleChange('api_key', e.target.value)} placeholder="API Key *"
                                                className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                            />
                                        </div>
                                    )}

                                    {/* Advanced Headers */}
                                    <div className="space-y-3 p-4 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10">
                                        <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">Headers & Payload Options</label>
                                        <input type="text" value={form.header_name} onChange={(e) => handleChange('header_name', e.target.value)} placeholder="Header Name (Authorization)"
                                            className="w-full px-3 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                        />
                                        <label className="flex items-center gap-2 text-sm text-light-text-primary dark:text-dark-text-primary mt-2 cursor-pointer">
                                            <input type="checkbox" checked={form.bearer_prefix} onChange={(e) => handleChange('bearer_prefix', e.target.checked)} className="rounded border-light-border/20 dark:border-dark-border/20 text-matrix-green focus:ring-matrix-green/40 bg-light-surface dark:bg-dark-surface" />
                                            <span>Incluir prefijo "Bearer " en el header {form.header_name || 'Authorization'}</span>
                                        </label>
                                    </div>

                                    {/* Endpoints */}
                                    <details className="group">
                                        <summary className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary cursor-pointer hover:text-matrix-green transition-colors">
                                            📡 Endpoints API
                                        </summary>
                                        <div className="space-y-2 mt-2">
                                            {[
                                                { key: 'base_url', label: 'Base URL *', placeholder: 'https://api.uber.com' },
                                                { key: 'create_delivery', label: 'Crear delivery *', placeholder: '/v1/customers/{customer_id}/deliveries' },
                                                { key: 'create_quote', label: 'Cotizar', placeholder: '/v1/customers/{customer_id}/delivery_quotes' },
                                                { key: 'cancel_delivery', label: 'Cancelar', placeholder: '/deliveries/{id}/cancel' },
                                                { key: 'get_delivery', label: 'Consultar', placeholder: '/deliveries/{id}' },
                                            ].map(({ key, label, placeholder }) => (
                                                <div key={key}>
                                                    <label className="block text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mb-0.5">{label}</label>
                                                    <input type="text" value={form[key]} onChange={(e) => handleChange(key, e.target.value)} placeholder={placeholder}
                                                        className={`w-full px-3 py-1.5 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border text-xs font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 ${errors[key] ? 'border-red-500' : 'border-light-border/20 dark:border-dark-border/20'}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </details>

                                    {/* Webhooks */}
                                    <details className="group">
                                        <summary className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary cursor-pointer hover:text-matrix-green transition-colors">
                                            🔔 Webhook Config
                                        </summary>
                                        <div className="space-y-2 mt-2">
                                            <input type="password" value={form.webhook_secret} onChange={(e) => handleChange('webhook_secret', e.target.value)} placeholder="Webhook Secret"
                                                className="w-full px-3 py-1.5 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-xs font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                            />
                                            <input type="text" value={form.signature_header} onChange={(e) => handleChange('signature_header', e.target.value)} placeholder="Signature Header"
                                                className="w-full px-3 py-1.5 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-xs font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
                                            />
                                        </div>
                                    </details>
                                </>
                            )}
                            
                            {/* Test Connection Button */}
                            <button
                                onClick={handleTestConnection}
                                disabled={isTesting}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2
                                    bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10
                                    hover:border-matrix-green/50 text-light-text-primary dark:text-dark-text-primary disabled:opacity-50"
                            >
                                {isTesting ? (
                                    <FaSpinner size={14} className="animate-spin" />
                                ) : testResult?.success ? (
                                    <FaCheckCircle size={14} className="text-green-500" />
                                ) : testResult && !testResult.success ? (
                                    <FaTimesCircle size={14} className="text-red-500" />
                                ) : (
                                    <FaPlug size={14} />
                                )}
                                {isTesting ? 'Probando...' : testResult?.success ? '✓ Conexión exitosa' : testResult ? '✗ Error' : 'Probar conexión'}
                            </button>
                            {testResult && !testResult.success && testResult.error && (
                                <p className="text-xs text-red-500 -mt-2 px-1">{testResult.error}</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-light-border/10 dark:border-dark-border/10">
                            <button onClick={onClose}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button onClick={handleSubmit} disabled={isSaving}
                                className="px-5 py-2 rounded-xl text-sm font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSaving ? <FaSpinner size={14} className="animate-spin" /> : <FaSave size={14} />}
                                {isEdit ? 'Guardar' : 'Crear Carrier'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CarrierModal;
