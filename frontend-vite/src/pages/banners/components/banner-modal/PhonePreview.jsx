/**
 * PhonePreview — Vista previa del banner EXACTA a la carta digital
 * Replica el layout real de BannerPopup.jsx en la carta:
 *   - image_size → aspect ratio del contenedor
 *   - button_config → CTA en bottom bar (no overlay)
 *   - title + description en bottom bar
 *
 * Modo 9:16 = "story": la imagen llena la pantalla del celular completa.
 */
import React from 'react';
import { Smartphone, Wifi, Battery, Signal, Monitor } from 'lucide-react';

/* ── Aspect-ratio map — idéntico al de la carta ──────────────────────────── */
const ASPECT_MAP = {
    '3:1':  '3 / 1',
    '2:1':  '2 / 1',
    '16:9': '16 / 9',
    '4:3':  '4 / 3',
    '1:1':  '1 / 1',
    '9:16': '9 / 16',
};

/* ── Button style helper — mismo que getButtonClasses en BannerPopup ───── */
const getBtnInlineStyle = (cfg) => {
    const base = {
        fontSize: '7px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '9999px',
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
    };
    if (cfg.style === 'outline') return {
        ...base,
        backgroundColor: 'transparent',
        color: cfg.color || '#22c55e',
        border: `1.5px solid ${cfg.color || '#22c55e'}`,
    };
    if (cfg.style === 'glass') return {
        ...base,
        backgroundColor: `${cfg.color || '#22c55e'}80`,
        color: cfg.text_color || '#fff',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
    };
    return {
        ...base,
        backgroundColor: cfg.color || '#22c55e',
        color: cfg.text_color || '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    };
};

/* ── Component ─────────────────────────────────────────────────────────── */
const PhonePreview = ({ form }) => {
    const btn = form.button_config || {};
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const showButton = btn.visible && btn.text;
    const is916 = form.image_size === '9:16';
    const aspectRatio = ASPECT_MAP[form.image_size] || ASPECT_MAP['16:9'];
    const devices = form.display_devices || ['mobile', 'desktop'];
    const mobileEnabled = devices.includes('mobile');
    const desktopEnabled = devices.includes('desktop');

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
                <Smartphone className="w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />
                <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                    Vista celular
                </span>
            </div>

            {/* ── Phone frame ─────────────────────────────────────── */}
            <div className={`relative w-[180px] rounded-[22px] bg-[#1a1a1a] p-[6px] shadow-2xl ring-1 ring-white/10 transition-opacity ${!mobileEnabled ? 'opacity-40' : ''}`}>
                {/* Disabled overlay */}
                {!mobileEnabled && (
                    <div className="absolute inset-0 z-30 rounded-[22px] bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
                        <Smartphone className="w-5 h-5 text-red-400/80" />
                        <span className="text-[8px] font-bold text-red-400/80 uppercase tracking-wider">Deshabilitado</span>
                    </div>
                )}
                {/* Dynamic Island */}
                <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[60px] h-[14px] bg-[#1a1a1a] rounded-b-xl z-20 flex items-center justify-center">
                    <div className="w-[24px] h-[4px] bg-[#333] rounded-full" />
                </div>

                {/* Screen */}
                <div className="rounded-[18px] overflow-hidden bg-[#0a0a0a] relative">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-3 py-1 text-white/70 bg-black/60 text-[7px] relative z-10">
                        <span className="font-semibold">{time}</span>
                        <div className="flex items-center gap-1">
                            <Signal className="w-2 h-2" />
                            <Wifi className="w-2 h-2" />
                            <Battery className="w-2.5 h-2.5" />
                        </div>
                    </div>

                    {/* App header */}
                    <div className="bg-[#111] px-3 py-1.5 flex items-center justify-between border-b border-white/5">
                        <span className="text-[8px] text-white/40 font-medium">☰</span>
                        <span className="text-[8px] text-white font-bold tracking-wide">Piccola Italia</span>
                        <span className="text-[8px] text-white/40">🛒</span>
                    </div>

                    {/*
                     * ── Banner popup overlay ──────────────────────────
                     * Simula EXACTO el BannerPopup de la carta:
                     *   - bg-black/75 backdrop-blur overlay
                     *   - rounded-3xl border-2 border-white/20
                     *   - aspect ratio del admin
                     *   - bottom bar con title + description + CTA
                     *
                     * Para 9:16 el banner ocupa la pantalla completa
                     * como un story de Instagram.
                     */}
                    <div className="relative bg-black/75 flex items-center justify-center"
                        style={{ minHeight: is916 ? '260px' : '180px' }}>

                        {/* Banner card — simula el motion.div popup */}
                        <div className={`relative overflow-hidden border-2 border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.6)]
                            ${is916 ? 'w-[65%] rounded-2xl' : 'w-[92%] rounded-2xl'}`}>

                            {/* Close button */}
                            <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-[8px] leading-none">
                                ×
                            </div>

                            {/* Image — aspect ratio del admin */}
                            <div className="relative w-full overflow-hidden"
                                style={{ aspectRatio }}>
                                {form.image_url ? (
                                    <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
                                        <span className="text-[8px] text-white/20">Banner</span>
                                    </div>
                                )}
                            </div>

                            {/* Bottom bar — title + desc + CTA (misma estructura que la carta) */}
                            {(form.title || form.description || showButton) && (
                                <div className="px-2 py-1.5 bg-[#111]/90 backdrop-blur-md border-t border-white/10 flex items-center gap-1.5">
                                    {/* Text */}
                                    <div className="flex-1 min-w-0">
                                        {form.title && (
                                            <p className="text-[7px] font-semibold text-white truncate">
                                                {form.title}
                                            </p>
                                        )}
                                        {form.description && (
                                            <p className="text-[5.5px] text-white/50 line-clamp-1 mt-px">
                                                {form.description}
                                            </p>
                                        )}
                                    </div>
                                    {/* CTA button */}
                                    {showButton && (
                                        <span className="shrink-0" style={getBtnInlineStyle(btn)}>
                                            {btn.text}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom nav bar */}
                    <div className="flex items-center justify-around py-2 border-t border-white/5 bg-[#111]">
                        {['🏠', '🔍', '📋', '👤'].map((ico, i) => (
                            <span key={i} className="text-[8px]" style={{ opacity: i === 0 ? 1 : 0.3 }}>{ico}</span>
                        ))}
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pb-1">
                        <div className="w-8 h-[3px] rounded-full bg-white/20" />
                    </div>
                </div>
            </div>

            {/* ── Desktop mini-preview ────────────────────────────── */}
            <div className="flex items-center gap-1.5 mt-2">
                <Monitor className="w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />
                <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                    Vista PC
                </span>
            </div>
            <div className={`w-[180px] rounded-xl bg-[#1a1a1a] p-1 ring-1 ring-white/10 relative transition-opacity ${!desktopEnabled ? 'opacity-40' : ''}`}>
                {/* Disabled overlay */}
                {!desktopEnabled && (
                    <div className="absolute inset-0 z-30 rounded-xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
                        <Monitor className="w-5 h-5 text-red-400/80" />
                        <span className="text-[8px] font-bold text-red-400/80 uppercase tracking-wider">Deshabilitado</span>
                    </div>
                )}
                {/* Browser chrome */}
                <div className="flex items-center gap-1 px-2 py-1 bg-[#222] rounded-t-lg">
                    <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                    </div>
                    <div className="flex-1 h-2 bg-white/5 rounded ml-1" />
                </div>
                {/* Desktop banner popup simulation */}
                <div className="bg-black/80 flex items-center justify-center py-3 rounded-b-lg">
                    <div className={`overflow-hidden rounded-xl border-2 border-white/15 shadow-lg
                        ${is916 ? 'w-[45%]' : 'w-[85%]'}`}>
                        {/* Image */}
                        <div className="relative w-full overflow-hidden"
                            style={{ aspectRatio }}>
                            {form.image_url ? (
                                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
                                    <span className="text-[6px] text-white/20">Banner</span>
                                </div>
                            )}
                        </div>
                        {/* Bottom bar */}
                        {(form.title || showButton) && (
                            <div className="px-1.5 py-1 bg-[#111]/90 border-t border-white/10 flex items-center gap-1">
                                <span className="text-[5px] font-semibold text-white truncate flex-1">{form.title}</span>
                                {showButton && (
                                    <span className="shrink-0 text-[5px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: btn.style === 'solid' ? (btn.color || '#22c55e') : 'transparent',
                                            color: btn.text_color || '#fff',
                                            border: btn.style === 'outline' ? `1px solid ${btn.color}` : 'none',
                                        }}>
                                        {btn.text}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhonePreview;
