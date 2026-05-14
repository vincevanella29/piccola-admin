// src/pages/chat/components/community/SectionPermsModal.jsx
// Discord-inspired server permissions with Apple-level polish
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaShieldAlt, FaCheck, FaChevronRight, FaMinus, FaPlus } from 'react-icons/fa';
import useSectionPerms from '../../../../hooks/chat/useSectionPerms';

// ── Permission categories ────────────────────────────────
const PERM_GROUPS = [
  {
    title: 'Comunicación',
    icon: '💬',
    perms: [
      { key: 'can_create_groups',       label: 'Crear Grupos',       desc: 'Los trabajadores pueden crear sus propios grupos de chat',   icon: '👥' },
      { key: 'can_create_channels',     label: 'Crear Canales',      desc: 'Pueden crear nuevos canales públicos o privados',            icon: '#️⃣' },
      { key: 'can_post_announcements',  label: 'Publicar Anuncios',  desc: 'Pueden publicar mensajes en canales de anuncios',            icon: '📢' },
      { key: 'can_upload_media',        label: 'Subir Media',        desc: 'Pueden adjuntar imágenes, videos y archivos',                icon: '📎' },
    ],
  },
  {
    title: 'Moderación',
    icon: '🛡️',
    perms: [
      { key: 'can_invite_members',  label: 'Invitar Miembros',  desc: 'Pueden invitar nuevas personas a sus grupos',   icon: '✉️' },
      { key: 'can_pin_messages',    label: 'Fijar Mensajes',    desc: 'Pueden anclar mensajes importantes en canales',  icon: '📌' },
    ],
  },
];

// ── Animated Toggle ──────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`
      relative w-12 h-7 rounded-full transition-all duration-300 outline-none
      ${checked
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
        : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md ${
        checked ? 'left-[23px]' : 'left-[3px]'
      }`}
    />
  </button>
);

// ── Number Stepper ───────────────────────────────────────
const Stepper = ({ value, onChange, min = 0, max = 50, disabled }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => !disabled && onChange(Math.max(min, value - 1))}
      disabled={disabled || value <= min}
      className="w-7 h-7 rounded-lg bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 border border-light-border/30 dark:border-dark-border/30 flex items-center justify-center text-xs text-light-text-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition disabled:opacity-30"
    >
      <FaMinus size={8} />
    </button>
    <div className="w-10 h-7 rounded-lg bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40 border border-light-border/30 dark:border-dark-border/30 flex items-center justify-center text-sm font-bold tabular-nums">
      {value}
    </div>
    <button
      onClick={() => !disabled && onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      className="w-7 h-7 rounded-lg bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 border border-light-border/30 dark:border-dark-border/30 flex items-center justify-center text-xs text-light-text-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition disabled:opacity-30"
    >
      <FaPlus size={8} />
    </button>
  </div>
);

// ── Permission Row (animated stagger) ────────────────────
const PermRow = ({ icon, label, desc, checked, onChange, disabled, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.04, duration: 0.25 }}
    className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40 transition-colors group"
  >
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span className="text-lg shrink-0 group-hover:scale-110 transition-transform duration-200">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </motion.div>
);

// ── Section Sidebar Item ─────────────────────────────────
const SectionItem = ({ section, active, onClick, saving }) => {
  const dotColor = section.color || '#6b7280';
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group relative
        ${active
          ? 'bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 shadow-sm'
          : 'hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40'
        }
      `}
    >
      {/* Active indicator bar */}
      {active && (
        <motion.div
          layoutId="section-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-500"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {/* Color dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}
        style={{ backgroundColor: dotColor, boxShadow: active ? `0 0 8px ${dotColor}66` : 'none' }}
      />
      <span className={`text-[13px] truncate transition-colors ${
        active
          ? 'font-bold text-light-text-primary dark:text-dark-text-primary'
          : 'font-medium text-light-text-secondary dark:text-dark-text-secondary'
      }`}>
        {section.seccion}
      </span>
      {saving && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-auto"
        >
          <FaCheck className="text-emerald-500" size={10} />
        </motion.div>
      )}
      {!saving && active && (
        <FaChevronRight className="ml-auto text-light-text-tertiary shrink-0" size={9} />
      )}
    </button>
  );
};

// ── Main Modal ───────────────────────────────────────────
const SectionPermsModal = ({ open, onClose, token, walletAddress, appState }) => {
  const {
    sections,
    loading,
    saving,
    activeSection,
    setActiveSection,
    currentSection,
    handleToggle,
    handleMaxGroups,
  } = useSectionPerms({ open, token, walletAddress, appState });

  // Computed index for animation key
  const sectionKey = currentSection?.seccion || 'none';

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-light-border/50 dark:border-dark-border/50 rounded-[32px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* ─── Header ─── */}
        <div className="shrink-0 px-6 py-5 border-b border-light-border/30 dark:border-dark-border/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <FaShieldAlt className="text-emerald-500" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Permisos de Sección</h2>
              <p className="text-[11px] text-light-text-tertiary mt-0.5">Configura qué puede hacer cada sección de tu equipo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition text-light-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* ─── Body: Sidebar + Content ─── */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r border-light-border/20 dark:border-dark-border/20 p-3 overflow-y-auto custom-scrollbar bg-light-surface-secondary/10 dark:bg-dark-surface-secondary/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-tertiary px-3 mb-2">
              Secciones
            </p>
            {loading && (
              <div className="space-y-2 px-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-9 rounded-xl bg-light-border/30 dark:bg-dark-border/30 animate-pulse" />
                ))}
              </div>
            )}
            <div className="space-y-0.5">
              {sections.map(s => (
                <SectionItem
                  key={s.seccion}
                  section={s}
                  active={activeSection === s.seccion}
                  onClick={() => setActiveSection(s.seccion)}
                  saving={saving === s.seccion}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {currentSection ? (
                <motion.div
                  key={sectionKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  {/* Section header chip */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-light-surface dark:ring-offset-dark-surface"
                        style={{
                          backgroundColor: currentSection.color || '#6b7280',
                          ringColor: currentSection.color || '#6b7280',
                        }}
                      />
                      <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                        {currentSection.seccion}
                      </h3>
                    </div>
                    {currentSection.updated_at && (
                      <span className="text-[10px] text-light-text-tertiary bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 px-2.5 py-1 rounded-full">
                        {new Date(currentSection.updated_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Permission groups */}
                  {PERM_GROUPS.map((group, gi) => (
                    <div key={group.title}>
                      <div className="flex items-center gap-2 px-4 mb-1">
                        <span className="text-xs">{group.icon}</span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-tertiary">
                          {group.title}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 overflow-hidden divide-y divide-light-border/15 dark:divide-dark-border/15">
                        {group.perms.map((perm, pi) => (
                          <PermRow
                            key={perm.key}
                            icon={perm.icon}
                            label={perm.label}
                            desc={perm.desc}
                            checked={!!currentSection[perm.key]}
                            onChange={(val) => handleToggle(currentSection.seccion, perm.key, val)}
                            disabled={saving === currentSection.seccion}
                            index={gi * 4 + pi}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Limits & Appearance */}
                  <div>
                    <div className="flex items-center gap-2 px-4 mb-1">
                      <span className="text-xs">⚙️</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-tertiary">
                        Límites y Apariencia
                      </p>
                    </div>
                    <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 overflow-hidden divide-y divide-light-border/15 dark:divide-dark-border/15">
                      {/* Max groups */}
                      <div className="flex items-center justify-between gap-4 py-3 px-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg shrink-0">🔢</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">Máx. Grupos</p>
                            <p className="text-[11px] text-light-text-tertiary leading-tight mt-0.5">Cantidad máxima de grupos que puede crear esta sección</p>
                          </div>
                        </div>
                        <Stepper
                          value={currentSection.max_groups ?? 5}
                          onChange={(v) => handleMaxGroups(currentSection.seccion, v)}
                          disabled={saving === currentSection.seccion}
                        />
                      </div>
                      {/* Section color */}
                      <div className="flex items-center justify-between gap-4 py-3 px-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg shrink-0">🎨</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">Color</p>
                            <p className="text-[11px] text-light-text-tertiary leading-tight mt-0.5">Color personalizado de la sección</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="relative cursor-pointer">
                            <input
                              type="color"
                              value={currentSection.color || '#6b7280'}
                              onChange={e => handleToggle(currentSection.seccion, 'color', e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <div
                              className="w-8 h-8 rounded-xl border-2 border-light-border/40 dark:border-dark-border/40 transition-all hover:scale-110 hover:shadow-lg"
                              style={{ backgroundColor: currentSection.color || '#6b7280' }}
                            />
                          </label>
                          {currentSection.color && (
                            <button
                              onClick={() => handleToggle(currentSection.seccion, 'color', null)}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition px-2 py-1 rounded-lg hover:bg-red-500/10"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saving indicator */}
                  <AnimatePresence>
                    {saving === currentSection.seccion && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-500"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full"
                        />
                        Guardando cambios...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full py-16 text-center px-6"
                >
                  <div className="w-16 h-16 rounded-3xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 flex items-center justify-center text-2xl mb-4">
                    🛡️
                  </div>
                  <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                    Selecciona una sección
                  </p>
                  <p className="text-[11px] text-light-text-tertiary mt-1">
                    Elige una sección del panel izquierdo para configurar sus permisos
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SectionPermsModal;
