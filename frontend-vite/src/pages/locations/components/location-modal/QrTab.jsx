import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    QrCode, Download, ExternalLink, Copy, Check, BarChart3, Eye,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { inputCls } from './shared';
import QrAnalyticsPanel from './QrAnalyticsPanel';

// ── QR Tab ────────────────────────────────────────────────────────────────────
const QrTab = ({ location, form, handleChange, appState, copied, setCopied, liveVisitors = 0 }) => {
    const { t } = useTranslation();
    const q = (k) => t(`location.modal.qr.${k}`);
    const [qrSubTab, setQrSubTab] = useState('code');

    const slug = location.permalink_slug;
    const savedRedirectUrl = location.qr_redirect_url;
    const baseUrl = `${window.location.origin}/api/go`;
    const qrUrl = location.qr_url || (slug ? `${baseUrl}/${slug}` : '');

    const downloadQR = (format = 'png') => {
        const svgEl = document.getElementById('qr-svg-canvas');
        if (!svgEl) return;
        if (format === 'svg') {
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `qr-${slug || 'local'}.svg`;
            a.click(); URL.revokeObjectURL(url);
            return;
        }
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 1024, 1024);
            ctx.drawImage(img, 0, 0, 1024, 1024);
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `qr-${slug || 'local'}.png`;
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Segmented control */}
            <div className="flex p-0.5 rounded-xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border/20 dark:border-dark-border/20">
                {[
                    { id: 'code', label: q('codeTab'), icon: QrCode },
                    { id: 'metrics', label: q('metricsTab'), icon: BarChart3 },
                ].map(tab => (
                    <button key={tab.id} type="button" onClick={() => setQrSubTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                            qrSubTab === tab.id
                                ? 'bg-white dark:bg-dark-surface shadow-sm text-light-text-primary dark:text-dark-text-primary'
                                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                        }`}>
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CODE sub-tab */}
            {qrSubTab === 'code' && (
                <div className="space-y-4">
                    {!slug && (
                        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ {q('noSlug')}
                        </div>
                    )}

                    {/* Live visitors pill */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/15">
                            <span className="relative flex h-1.5 w-1.5">
                                {liveVisitors > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${liveVisitors > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{liveVisitors}</span>
                            <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">en línea ahora</span>
                        </div>
                    </div>

                    {/* URLs */}
                    <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden">
                        <div className="px-4 py-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-b border-light-border/20 dark:border-dark-border/20">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <QrCode className="w-3 h-3 text-light-accent dark:text-dark-accent" />
                                    <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{q('qrUrl')}</span>
                                </div>
                                {qrUrl && (
                                    <button type="button" onClick={copyUrl}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                                            copied ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
                                        }`}>
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copied ? q('copied') : q('copy')}
                                    </button>
                                )}
                            </div>
                            <div className="px-2.5 py-1.5 rounded-lg bg-light-surface/80 dark:bg-dark-surface/80 text-[11px] font-mono text-light-text-primary dark:text-dark-text-primary truncate">
                                {qrUrl || '—'}
                            </div>
                        </div>
                        <div className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="relative flex h-1.5 w-1.5">
                                    {savedRedirectUrl && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${savedRedirectUrl ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                </span>
                                <ExternalLink className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    URL de redirección
                                </span>
                            </div>
                            {savedRedirectUrl ? (
                                <a href={savedRedirectUrl} target="_blank" rel="noopener noreferrer"
                                    className="block px-2.5 py-1.5 rounded-lg bg-emerald-500/6 dark:bg-emerald-400/6 border border-emerald-500/15 dark:border-emerald-400/15 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 truncate hover:underline">
                                    {savedRedirectUrl}
                                </a>
                            ) : (
                                <div className="px-2.5 py-1.5 rounded-lg bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-[11px] text-light-text-secondary dark:text-dark-text-secondary italic">
                                    Sin URL configurada — usará fallback: lapiccolaitalia.cl/local/{slug}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit redirect URL */}
                    <div className="rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 p-3">
                        <span className="text-[9px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5 block">
                            {q('destination')}
                        </span>
                        <div className="relative">
                            <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                            <input type="url" value={form.qr_redirect_url} onChange={handleChange('qr_redirect_url')}
                                placeholder={q('destinationPlaceholder')} className={`${inputCls} pl-8 !text-[11px] !py-2`} />
                        </div>
                        {form.qr_redirect_url !== (savedRedirectUrl || '') && (
                            <p className="text-[9px] text-amber-500 font-semibold mt-1">⚡ Cambio pendiente — guarda para aplicar</p>
                        )}
                    </div>

                    {/* QR Preview + Download */}
                    {slug && qrUrl && (
                        <div className="flex items-start gap-4 justify-center">
                            <div className="p-4 bg-white rounded-2xl shadow-md border border-light-border/30 dark:border-dark-border/30">
                                <QRCodeSVG id="qr-svg-canvas" value={qrUrl} size={160} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#1a1a2e" />
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <p className="text-[11px] font-semibold text-light-text-primary dark:text-dark-text-primary">{location.nombre}</p>
                                <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary font-mono">{slug}</p>
                                <button type="button" onClick={() => downloadQR('png')}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white text-[10px] font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all">
                                    <Download className="w-3 h-3" /> PNG
                                </button>
                                <button type="button" onClick={() => downloadQR('svg')}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-[10px] font-bold hover:text-light-accent dark:hover:text-dark-accent transition-all">
                                    <Download className="w-3 h-3" /> SVG
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* METRICS sub-tab */}
            {qrSubTab === 'metrics' && slug && <QrAnalyticsPanel slug={slug} appState={appState} />}
            {qrSubTab === 'metrics' && !slug && (
                <div className="flex flex-col items-center py-8 gap-2 opacity-30">
                    <BarChart3 className="w-6 h-6" />
                    <p className="text-[11px]">{q('noSlugMetrics')}</p>
                </div>
            )}
        </div>
    );
};

export default QrTab;
