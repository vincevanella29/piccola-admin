import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    QrCode, Download, ExternalLink, Copy, Check, BarChart3,
    Upload, X, Trash2,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { inputCls } from './shared';
import QrAnalyticsPanel from './QrAnalyticsPanel';

// ── Quick center logos from the site ──────────────────────────────────────────

const QUICK_LOGOS = [
    { id: 'favicon',  label: 'Ícono',    src: '/favicon-piccola.png' },
    { id: 'logo-w',   label: 'Logo Light', src: '/logo-piccola-blanco.png' },
    { id: 'logo-b',   label: 'Logo Dark',  src: '/logo-piccola-negro.png' },
];

// ── Color presets ─────────────────────────────────────────────────────────────

const STYLE_PRESETS = [
    { id: 'classic',  label: 'Clásico',   fg: '#1a1a2e', bg: '#ffffff' },
    { id: 'midnight', label: 'Midnight',  fg: '#c4b5fd', bg: '#0c0a1a' },
    { id: 'emerald',  label: 'Esmeralda', fg: '#064e3b', bg: '#ecfdf5' },
    { id: 'royal',    label: 'Royal',     fg: '#312e81', bg: '#eef2ff' },
    { id: 'sunset',   label: 'Sunset',    fg: '#9a3412', bg: '#fff7ed' },
    { id: 'noir',     label: 'Noir',      fg: '#fafafa', bg: '#0a0a0a' },
    { id: 'rose',     label: 'Rosé',      fg: '#881337', bg: '#fff1f2' },
    { id: 'ocean',    label: 'Ocean',     fg: '#0c4a6e', bg: '#f0f9ff' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Renders the hidden QRCodeCanvas to a high-res image (with the center logo
 * already baked in by qrcode.react). Returns a Promise<HTMLImageElement>.
 */
function rasterizeQR(canvasId, size) {
    return new Promise((resolve, reject) => {
        const srcCanvas = document.getElementById(canvasId);
        if (!srcCanvas) return reject(new Error('QR canvas not found'));

        // Scale up the existing canvas content to `size`
        const out = document.createElement('canvas');
        out.width = size;
        out.height = size;
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;          // keep QR crisp
        ctx.drawImage(srcCanvas, 0, 0, size, size);

        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = out.toDataURL('image/png');
    });
}

/** Load an image from URL and return an Image element */
function loadImg(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/** Rounded rect path */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/** Trigger browser download */
function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ── Main Component ────────────────────────────────────────────────────────────

const QrTab = ({ location, form, handleChange, appState, copied, setCopied, liveVisitors = 0 }) => {
    const { t } = useTranslation();
    const q = (k) => t(`location.modal.qr.${k}`);
    const [qrSubTab, setQrSubTab] = useState('code');

    // Design state
    const [selectedStyle, setSelectedStyle] = useState('classic');
    const [centerImage, setCenterImage] = useState(null);
    const [centerImageName, setCenterImageName] = useState('');
    const [customFg, setCustomFg] = useState('');
    const [customBg, setCustomBg] = useState('');
    const [downloading, setDownloading] = useState(false);
    const fileInputRef = useRef(null);

    const slug = location.permalink_slug;
    const savedRedirectUrl = location.qr_redirect_url;
    const baseUrl = `${window.location.origin}/api/go`;
    const qrUrl = location.qr_url || (slug ? `${baseUrl}/${slug}` : '');

    // Current colors
    const preset = STYLE_PRESETS.find(s => s.id === selectedStyle) || STYLE_PRESETS[0];
    const fgColor = customFg || preset.fg;
    const bgColor = customBg || preset.bg;

    // Auto-set favicon as default center logo on mount
    useEffect(() => {
        if (!centerImage) {
            setCenterImage('/favicon-piccola.png');
            setCenterImageName('Ícono Piccola');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Image handlers ────────────────────────────────────────────────────
    const handleImageUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1_000_000) { alert('Máximo 1MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setCenterImage(ev.target.result);
            setCenterImageName(file.name);
        };
        reader.readAsDataURL(file);
    }, []);

    const selectQuickLogo = (logo) => {
        setCenterImage(logo.src);
        setCenterImageName(logo.label);
    };

    const removeCenterImage = () => {
        setCenterImage(null);
        setCenterImageName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Download: QR only (PNG, transparent bg) ──────────────────────────
    const downloadQROnly = async () => {
        setDownloading(true);
        try {
            const size = 2048;
            const qrImg = await rasterizeQR('qr-canvas-hidden', size);

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            // Transparent background — user can place on any design
            ctx.drawImage(qrImg, 0, 0, size, size);

            triggerDownload(canvas.toDataURL('image/png'), `qr-${slug || 'local'}.png`);
        } catch (err) {
            console.error('[QR] download error:', err);
        } finally {
            setDownloading(false);
        }
    };

    // ── Download: Sticker with design ────────────────────────────────────
    const downloadSticker = async () => {
        setDownloading(true);
        try {
            const W = 1200;
            const qrSize = 800;
            const padding = (W - qrSize) / 2;
            const textAreaH = 180;
            const H = padding + qrSize + textAreaH + padding / 2;

            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // Background with rounded corners (sticker-ready)
            const cornerR = 64;
            roundRect(ctx, 0, 0, W, H, cornerR);
            ctx.fillStyle = bgColor;
            ctx.fill();
            ctx.clip();

            // QR code
            const qrImg = await rasterizeQR('qr-canvas-hidden', qrSize * 2);
            const qrX = (W - qrSize) / 2;
            const qrY = padding;

            // Subtle inner shadow for QR area
            ctx.save();
            roundRect(ctx, qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 32);
            ctx.fillStyle = fgColor + '08';
            ctx.fill();
            ctx.restore();

            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Text: location name
            const textY = qrY + qrSize + 50;
            ctx.fillStyle = fgColor;
            ctx.textAlign = 'center';
            ctx.font = `700 ${Math.round(W * 0.038)}px -apple-system, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif`;
            ctx.fillText(location.nombre || '', W / 2, textY);

            // Subtitle: address (if available)
            if (location.direccion) {
                ctx.globalAlpha = 0.45;
                ctx.font = `400 ${Math.round(W * 0.022)}px -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif`;
                const addr = location.direccion.length > 55
                    ? location.direccion.substring(0, 55) + '…'
                    : location.direccion;
                ctx.fillText(addr, W / 2, textY + 50);
                ctx.globalAlpha = 1;
            }

            // "Escanea el código QR" micro-label
            ctx.globalAlpha = 0.25;
            ctx.font = `600 ${Math.round(W * 0.016)}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('ESCANEA EL CÓDIGO QR', W / 2, textY + 95);
            ctx.globalAlpha = 1;

            triggerDownload(canvas.toDataURL('image/png'), `sticker-${slug || 'local'}.png`);
        } catch (err) {
            console.error('[Sticker] download error:', err);
        } finally {
            setDownloading(false);
        }
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // QR Canvas image settings (center logo)
    const imageSettings = centerImage ? {
        src: centerImage,
        height: 36,
        width: 36,
        excavate: true,
    } : undefined;

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

            {qrSubTab === 'code' && (
                <div className="space-y-4">
                    {!slug && (
                        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ {q('noSlug')}
                        </div>
                    )}

                    {/* Live visitors */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/15">
                            <span className="relative flex h-1.5 w-1.5">
                                {liveVisitors > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${liveVisitors > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{liveVisitors}</span>
                            <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">en línea</span>
                        </div>
                    </div>

                    {/* URLs panel */}
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
                                    Sin URL configurada — fallback: lapiccolaitalia.cl/local/{slug}
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

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* QR DESIGNER                                            */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {slug && qrUrl && (
                        <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden">

                            {/* ── Design controls ─────────────────────────── */}
                            <div className="px-4 py-3 space-y-3">

                                {/* Color presets */}
                                <div>
                                    <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5 block">Paleta</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {STYLE_PRESETS.map(style => (
                                            <button
                                                key={style.id}
                                                type="button"
                                                onClick={() => { setSelectedStyle(style.id); setCustomFg(''); setCustomBg(''); }}
                                                title={style.label}
                                                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                                                    selectedStyle === style.id
                                                        ? 'border-light-accent dark:border-dark-accent scale-110 shadow-md'
                                                        : 'border-transparent'
                                                }`}
                                                style={{
                                                    background: `linear-gradient(135deg, ${style.fg} 50%, ${style.bg} 50%)`,
                                                }}
                                            />
                                        ))}
                                        {/* Custom color pickers */}
                                        <div className="flex items-center gap-1 ml-1 pl-2 border-l border-light-border/30 dark:border-dark-border/30">
                                            <div className="relative" title="Color QR">
                                                <input type="color" value={fgColor} onChange={(e) => setCustomFg(e.target.value)}
                                                    className="w-6 h-6 rounded-full border border-light-border/30 dark:border-dark-border/30 cursor-pointer opacity-0 absolute inset-0" />
                                                <div className="w-6 h-6 rounded-full border border-light-border/30 dark:border-dark-border/30 pointer-events-none" style={{ backgroundColor: fgColor }} />
                                            </div>
                                            <div className="relative" title="Fondo">
                                                <input type="color" value={bgColor} onChange={(e) => setCustomBg(e.target.value)}
                                                    className="w-6 h-6 rounded-full border border-light-border/30 dark:border-dark-border/30 cursor-pointer opacity-0 absolute inset-0" />
                                                <div className="w-6 h-6 rounded-full border border-light-border/30 dark:border-dark-border/30 pointer-events-none" style={{ backgroundColor: bgColor }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Center logo — quick picks + upload */}
                                <div>
                                    <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5 block">Logo central</span>
                                    <div className="flex items-center gap-1.5">
                                        {QUICK_LOGOS.map(logo => (
                                            <button
                                                key={logo.id}
                                                type="button"
                                                onClick={() => selectQuickLogo(logo)}
                                                title={logo.label}
                                                className={`w-9 h-9 rounded-xl border-2 overflow-hidden transition-all hover:scale-105 flex items-center justify-center ${
                                                    centerImage === logo.src
                                                        ? 'border-light-accent dark:border-dark-accent shadow-md scale-105'
                                                        : 'border-light-border/30 dark:border-dark-border/30'
                                                }`}
                                                style={{ backgroundColor: logo.id === 'logo-w' ? '#1a1a2e' : '#fff' }}
                                            >
                                                <img src={logo.src} alt={logo.label} className="w-6 h-6 object-contain" />
                                            </button>
                                        ))}

                                        {/* Upload custom */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Subir imagen"
                                            className="w-9 h-9 rounded-xl border-2 border-dashed border-light-border/40 dark:border-dark-border/40 hover:border-light-accent/50 dark:hover:border-dark-accent/50 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-all"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Remove logo */}
                                        {centerImage && (
                                            <button
                                                type="button"
                                                onClick={removeCenterImage}
                                                title="Sin logo"
                                                className="w-9 h-9 rounded-xl border-2 border-light-border/20 dark:border-dark-border/20 flex items-center justify-center text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-red-500 hover:border-red-500/30 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {centerImageName && (
                                            <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary ml-1 truncate max-w-[80px]">{centerImageName}</span>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                        onChange={handleImageUpload} className="hidden" />
                                </div>
                            </div>

                            {/* ── Preview area ────────────────────────────── */}
                            <div className="px-4 py-5 flex flex-col items-center gap-4 border-t border-light-border/15 dark:border-dark-border/15 bg-[repeating-conic-gradient(#80808012_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#80808010_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">

                                {/* Visible preview QR */}
                                <div className="relative group">
                                    <div className="absolute -inset-4 rounded-3xl opacity-15 blur-xl transition-opacity group-hover:opacity-25"
                                        style={{ backgroundColor: fgColor }} />
                                    <div className="relative p-5 rounded-2xl shadow-lg border border-light-border/15 dark:border-dark-border/15 transition-shadow hover:shadow-xl"
                                        style={{ backgroundColor: bgColor }}>
                                        <QRCodeCanvas value={qrUrl} size={180} level="H"
                                            includeMargin={false} bgColor={bgColor} fgColor={fgColor}
                                            imageSettings={imageSettings} />
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="text-center space-y-0.5">
                                    <p className="text-[11px] font-bold text-light-text-primary dark:text-dark-text-primary">{location.nombre}</p>
                                    <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary font-mono">{slug}</p>
                                </div>
                            </div>

                            {/* Hidden high-res canvas for download (off-screen) */}
                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                                <QRCodeCanvas id="qr-canvas-hidden" value={qrUrl} size={1024} level="H"
                                    includeMargin={false} bgColor={bgColor} fgColor={fgColor}
                                    imageSettings={centerImage ? {
                                        src: centerImage,
                                        height: 200,
                                        width: 200,
                                        excavate: true,
                                    } : undefined} />
                            </div>

                            {/* ── Download buttons (2 only — clean) ────────── */}
                            <div className="px-4 py-3 border-t border-light-border/15 dark:border-dark-border/15 flex gap-2">
                                <button type="button" onClick={downloadQROnly} disabled={downloading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-[11px] font-bold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary active:scale-[0.98] transition-all disabled:opacity-50">
                                    <Download className="w-3.5 h-3.5" />
                                    Solo QR
                                </button>
                                <button type="button" onClick={downloadSticker} disabled={downloading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-[11px] font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
                                    <Download className="w-3.5 h-3.5" />
                                    Con Diseño
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
