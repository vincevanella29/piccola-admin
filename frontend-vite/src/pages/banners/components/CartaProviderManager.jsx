import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Shield, Wifi, WifiOff, Link2, CheckCircle2, XCircle,
    Copy, RefreshCw, Loader2, Globe, Zap,
    AlertTriangle, ChevronDown, ChevronUp, Key
} from 'lucide-react';
import {
    fetchCartaProviders,
    fetchCartaProviderPresets,
    probeCartaDomain,
    autoLinkCarta,
    deleteCartaProvider,
} from '../../../utils/cartaData';

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const colors = {
        active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        disabled: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || colors.disabled}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500 animate-pulse' : status === 'paused' ? 'bg-amber-500' : 'bg-red-500'}`} />
            {status}
        </span>
    );
};


// ── Probe Results ────────────────────────────────────────────────────────────
const ProbeResults = ({ probe }) => {
    if (!probe) return null;
    return (
        <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
                {probe.healthy ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                    {probe.available}/{probe.total} rutas disponibles
                </span>
            </div>
            <div className="grid gap-1">
                {probe.routes?.map(r => (
                    <div key={r.route} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
                        {r.available ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                            <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        )}
                        <span className="font-mono text-light-text-secondary dark:text-dark-text-secondary">{r.route}</span>
                        <span className="ml-auto text-light-text-tertiary dark:text-dark-text-tertiary">{r.status || r.error}</span>
                    </div>
                ))}
            </div>
            {probe.claim_info && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        {probe.claim_info.claimed ? (
                            <>⚠️ Ya reclamada por <strong>{probe.claim_info.claimed_by}</strong></>
                        ) : (
                            <>✅ Disponible para reclamar</>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};


// ── Main Component ───────────────────────────────────────────────────────────
const CartaProviderManager = ({ appState }) => {
    const { t } = useTranslation();

    const [providers, setProviders] = useState([]);
    const [presets, setPresets] = useState({});
    const [routes, setRoutes] = useState({});
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Setup form
    const [domain, setDomain] = useState('http://localhost:8083');
    const [probeResult, setProbeResult] = useState(null);
    const [probing, setProbing] = useState(false);

    // Auto-link result
    const [linkResult, setLinkResult] = useState(null);
    const [showMnemonic, setShowMnemonic] = useState(false);

    // Detail toggle
    const [expandedId, setExpandedId] = useState(null);

    const auth = { token: appState?.token, account: appState?.account };

    // ── Load ──────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [provRes, presetRes] = await Promise.all([
                fetchCartaProviders(auth),
                fetchCartaProviderPresets(auth),
            ]);
            setProviders(provRes?.providers || []);
            setPresets(presetRes?.presets || {});
            setRoutes(presetRes?.routes || {});
        } catch (e) {
            console.error('Error loading carta providers:', e);
        } finally {
            setLoading(false);
        }
    }, [appState?.token, appState?.account]);

    useEffect(() => { load(); }, [load]);

    // ── Probe ─────────────────────────────────────────────────────────────────
    const handleProbe = async () => {
        if (!domain.trim()) return;
        setProbing(true);
        setProbeResult(null);
        try {
            const res = await probeCartaDomain({ ...auth, domain: domain.trim() });
            setProbeResult(res);
        } catch (e) {
            setProbeResult({ healthy: false, available: 0, total: 0, routes: [], error: e.message });
        } finally {
            setProbing(false);
        }
    };

    // ── Auto-Link ─────────────────────────────────────────────────────────────
    const handleAutoLink = async () => {
        if (!domain.trim()) return;
        setActionLoading(true);
        setLinkResult(null);
        try {
            const preset = presets?.carta || {};
            const res = await autoLinkCarta({
                ...auth,
                name: preset.name || 'Carta Digital',
                slug: preset.slug || 'carta',
                type: 'api_key',
                domain: domain.trim(),
                description: preset.description || '',
            });
            setLinkResult(res);
            setShowMnemonic(true);
            await load();
        } catch (e) {
            setLinkResult({ success: false, claim_error: e.message || 'Error al vincular' });
        } finally {
            setActionLoading(false);
        }
    };

    // ── Disable ───────────────────────────────────────────────────────────────
    const handleDisable = async (id) => {
        if (!confirm('¿Desactivar esta conexión?')) return;
        try {
            await deleteCartaProvider({ ...auth, providerId: id });
            await load();
        } catch (e) {
            console.error('Error disabling provider:', e);
        }
    };

    const activeProvider = providers.find(p => p.status === 'active');

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-light-accent dark:text-dark-accent" />
            </div>
        );
    }

    // ── Linked state ──────────────────────────────────────────────────────────
    if (activeProvider) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                {activeProvider.name}
                                <StatusBadge status={activeProvider.status} />
                            </h3>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                Vinculada el {new Date(activeProvider.created_at).toLocaleDateString('es-CL')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleDisable(activeProvider._id)}
                        className="text-xs text-red-400 hover:text-red-500 transition-colors"
                    >
                        Desactivar
                    </button>
                </div>

                {/* Connection info — NO keys exposed */}
                <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border space-y-3">
                    <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="font-mono">{activeProvider.domain}</span>
                    </div>
                    {activeProvider.description && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {activeProvider.description}
                        </p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                        {activeProvider.dilithium_secured && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-surface-secondary dark:bg-dark-surface-secondary text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                <Shield className="w-2.5 h-2.5" />
                                {activeProvider.dilithium_algorithm || 'Dilithium2'}
                            </span>
                        )}
                        <span className="text-[10px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary">
                            {activeProvider.slug}
                        </span>
                    </div>
                </div>

                {/* Routes */}
                <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
                    <button
                        onClick={() => setExpandedId(expandedId ? null : 'routes')}
                        className="flex items-center gap-2 w-full text-left"
                    >
                        <Globe className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">Rutas sincronización</span>
                        {expandedId === 'routes' ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                    </button>
                    {expandedId === 'routes' && (
                        <div className="mt-3 grid gap-1">
                            {Object.entries(routes).map(([key, path]) => (
                                <div key={key} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
                                    <span className="font-mono text-light-accent dark:text-dark-accent">{key}</span>
                                    <span className="text-light-text-tertiary dark:text-dark-text-tertiary ml-auto font-mono">{activeProvider.domain}{path}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mnemonic warning (shown once after link — NEVER again) */}
                {linkResult?.mnemonic && showMnemonic && (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                ⚠️ Frase mnemónica — GUÁRDALA AHORA
                            </span>
                        </div>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                            Esta frase se muestra UNA SOLA VEZ. Es tu respaldo de la firma criptográfica Dilithium.
                            Las API keys y claves privadas nunca se muestran en la interfaz.
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {linkResult.mnemonic.split(' ').map((word, i) => (
                                <div key={i} className="flex items-center gap-1 px-2 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg border border-light-border/10 dark:border-dark-border/10">
                                    <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono w-3 text-right">{i + 1}</span>
                                    <span className="text-[11px] font-mono font-semibold text-light-text-primary dark:text-dark-text-primary">{word}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(linkResult.mnemonic);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-xs font-medium border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors flex items-center justify-center gap-2"
                        >
                            <Copy className="w-3 h-3" /> Copiar frase completa
                        </button>
                        <button
                            onClick={() => setShowMnemonic(false)}
                            className="text-xs text-amber-500 hover:text-amber-600 underline"
                        >
                            Ya la guardé, ocultar para siempre
                        </button>
                    </div>
                )}

                {/* Refresh */}
                <button
                    onClick={load}
                    className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar estado
                </button>
            </div>
        );
    }

    // ── Unlinked state (setup form) ───────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
                    <WifiOff className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                        Carta no vinculada
                    </h3>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        Conecta la carta digital para sincronizar automáticamente banners, menú y navegación.
                    </p>
                </div>
            </div>

            {/* Domain input */}
            <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border space-y-4">
                <div>
                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                        Dominio de la carta
                    </label>
                    <div className="flex gap-2">
                        <input
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            placeholder="http://localhost:8083"
                            className="flex-1 px-3 py-2 text-sm rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50"
                        />
                        <button
                            onClick={handleProbe}
                            disabled={probing || !domain.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-sm font-medium text-light-text-primary dark:text-dark-text-primary hover:bg-light-border dark:hover:bg-dark-border transition-colors disabled:opacity-50"
                        >
                            {probing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                            Probe
                        </button>
                    </div>
                </div>

                <ProbeResults probe={probeResult} />

                {/* Auto-Link button */}
                <button
                    onClick={handleAutoLink}
                    disabled={actionLoading || !domain.trim()}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-light-accent to-light-accent-hover dark:from-dark-accent dark:to-dark-accent-hover text-white text-sm font-semibold shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:opacity-90 transition-all disabled:opacity-50"
                >
                    {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Zap className="w-4 h-4" />
                    )}
                    Auto-Link con Dilithium
                </button>

                {/* Link result feedback */}
                {linkResult && !linkResult.success && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <p className="text-xs text-red-500">
                            ❌ {linkResult.claim_error || 'Error desconocido'}
                        </p>
                    </div>
                )}

                {linkResult?.success && !linkResult.claimed && linkResult.claim_error && (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ Provider creado pero claim falló: {linkResult.claim_error}
                        </p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                            La carta necesita tener el endpoint /admin/claim implementado.
                        </p>
                    </div>
                )}
            </div>

            {/* How it works */}
            <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
                <h4 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                    Cómo funciona
                </h4>
                <div className="space-y-2">
                    {[
                        { icon: Key, text: 'Genera un par de claves CRYSTALS-Dilithium (post-quantum)' },
                        { icon: Link2, text: 'Crea una API key segura para la comunicación' },
                        { icon: Shield, text: 'Envía las credenciales a la carta (first-claim-wins)' },
                        { icon: Wifi, text: 'La sincronización usa las URLs configuradas automáticamente' },
                    ].map(({ icon: Icon, text }, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-md bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="w-3 h-3 text-light-accent dark:text-dark-accent" />
                            </div>
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Disabled providers history */}
            {providers.length > 0 && (
                <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
                    <h4 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
                        Historial de conexiones
                    </h4>
                    {providers.map(p => (
                        <div key={p._id} className="flex items-center justify-between py-2 border-b border-light-border/50 dark:border-dark-border/50 last:border-0">
                            <div>
                                <span className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary">{p.name}</span>
                                <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary ml-2">{p.domain}</span>
                            </div>
                            <StatusBadge status={p.status} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CartaProviderManager;
