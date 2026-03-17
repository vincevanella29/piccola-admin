/**
 * StyleOptionsPanel — Opciones de estilo Aurora para generación de imagen
 * Apple style · i18n · Tailwind dark-glass
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Settings2 } from 'lucide-react';

const PALETA_FONDO = [
    { key: 'negro_absoluto', label_key: 'Negro',    swatch: '#050505' },
    { key: 'antracita',      label_key: 'Antracita', swatch: '#1a1a2e' },
    { key: 'azul_marino',    label_key: 'Marino',    swatch: '#0a1628' },
    { key: 'verde_bosque',   label_key: 'Bosque',    swatch: '#0d1f0f' },
    { key: 'nogal_oscuro',   label_key: 'Nogal',     swatch: '#2c1a0e' },
    { key: 'granito_gris',   label_key: 'Granito',   swatch: '#2a2a2a' },
    { key: 'marmol_blanco',  label_key: 'Mármol',    swatch: '#f5f5f0' },
];

const PALETA_RECIPIENTE = [
    { key: null,              label_key: 'Original',  swatch: 'transparent', border: '#6b7280' },
    { key: 'ceramica_negra',  label_key: 'Cerámica',  swatch: '#111111' },
    { key: 'pizarra_oscura',  label_key: 'Pizarra',   swatch: '#2d2d3d' },
    { key: 'ceramica_blanca', label_key: 'Porcelana', swatch: '#f8f8f8' },
    { key: 'terracota',       label_key: 'Terracota', swatch: '#c4622d' },
    { key: 'carbon',          label_key: 'Carbón',    swatch: '#3a3a3a' },
    { key: 'marmol_negro',    label_key: 'Mármol ⬛', swatch: '#1a1a1a' },
    { key: 'cobre',           label_key: 'Cobre',     swatch: '#b87333' },
];

// ── Color chip ─────────────────────────────────────────────────────────────────
const ColorChip = ({ label, swatch, border, active, onClick }) => (
    <button onClick={onClick}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all ${
            active
                ? 'border-violet-500 bg-violet-500/15 shadow-sm shadow-violet-500/15'
                : 'border-white/10 hover:border-violet-500/30 hover:bg-white/5'
        }`}>
        <span className="w-3.5 h-3.5 rounded-full border shrink-0 shadow-inner"
            style={{
                background: swatch === 'transparent'
                    ? 'repeating-conic-gradient(#888 0% 25%, #222 0% 50%) 0 0 / 6px 6px'
                    : swatch,
                borderColor: border || 'rgba(255,255,255,0.15)',
            }} />
        <span className={`text-[11px] font-medium whitespace-nowrap ${
            active ? 'text-violet-300' : 'text-white/60'
        }`}>{label}</span>
    </button>
);

// ── Toggle chip ────────────────────────────────────────────────────────────────
const ToggleChip = ({ label, active, onClick }) => (
    <button onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
            active
                ? 'border-violet-500/40 bg-violet-500/12 text-violet-300'
                : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
        }`}>
        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${active ? 'bg-violet-400' : 'bg-white/20'}`} />
        {label}
    </button>
);

// ── Section label ──────────────────────────────────────────────────────────────
const SectionLabel = ({ label }) => (
    <div className="flex items-center gap-1.5">
        <Settings2 className="w-3 h-3 text-white/25" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</span>
    </div>
);

// ── Main ───────────────────────────────────────────────────────────────────────
const StyleOptionsPanel = ({ options, onSet, onToggle, selectedRefUrl }) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Info box */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-500/8 to-indigo-500/8 border border-violet-500/15 space-y-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-white/70">{t('carta.aurora_style_title')}</span>
                </div>
                <ul className="space-y-0.5 pl-5 list-disc">
                    <li className="text-xs text-white/40">
                        {selectedRefUrl
                            ? t('carta.aurora_style_ref_ok')
                            : t('carta.aurora_style_ref_missing')}
                    </li>
                    <li className="text-xs text-white/40">{t('carta.aurora_style_lighting')}</li>
                </ul>
            </div>

            {/* Fondo */}
            <div className="space-y-2">
                <SectionLabel label={t('carta.aurora_style_bg_label')} />
                <div className="flex flex-wrap gap-1.5">
                    {PALETA_FONDO.map(({ key, label_key, swatch }) => (
                        <ColorChip key={key} label={label_key} swatch={swatch}
                            active={options.color_fondo === key}
                            onClick={() => onSet('color_fondo', key)} />
                    ))}
                </div>
            </div>

            {/* Plato */}
            <div className="space-y-2">
                <SectionLabel label={t('carta.aurora_style_plate_label')} />
                <div className="flex flex-wrap gap-1.5">
                    {PALETA_RECIPIENTE.map(({ key, label_key, swatch, border }) => (
                        <ColorChip key={String(key)} label={label_key} swatch={swatch} border={border}
                            active={options.color_recipiente === key}
                            onClick={() => onSet('color_recipiente', key)} />
                    ))}
                </div>
                {options.color_recipiente === null && (
                    <p className="text-[10px] text-white/30">{t('carta.aurora_style_original_hint')}</p>
                )}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-1.5">
                {[
                    { key: 'mejorar_texturas',  tKey: 'aurora_style_texture' },
                    { key: 'agregar_garnitura', tKey: 'aurora_style_garnish' },
                    { key: 'agregar_branding',  tKey: 'aurora_style_branding' },
                ].map(({ key, tKey }) => (
                    <ToggleChip key={key} label={t(`carta.${tKey}`)} active={options[key]} onClick={() => onToggle(key)} />
                ))}
            </div>
        </div>
    );
};

export { PALETA_FONDO, PALETA_RECIPIENTE };
export default StyleOptionsPanel;
