// src/pages/chat/components/community/SectionPermsModal.jsx
// Apple-style server permissions (macOS System Settings layout, iOS Toggles)
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaShieldAlt, FaChevronRight, FaMinus, FaPlus, FaCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import useSectionPerms from '../../../../hooks/chat/useSectionPerms';

// ── iOS-style Animated Toggle ────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`
      relative w-[50px] h-[30px] rounded-full transition-colors duration-300 outline-none shrink-0
      ${checked
        ? 'bg-[#34C759] shadow-inner'
        : 'bg-[#E5E5EA] dark:bg-[#3A3A3C] shadow-inner'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`absolute top-[2px] w-[26px] h-[26px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] ${checked ? 'left-[22px]' : 'left-[2px]'
        }`}
    />
  </button>
);

// ── Number Stepper ───────────────────────────────────────
const Stepper = ({ value, onChange, min = 0, max = 50, disabled }) => (
  <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#2C2C2E] p-1 rounded-xl">
    <button
      onClick={() => !disabled && onChange(Math.max(min, value - 1))}
      disabled={disabled || value <= min}
      className="w-7 h-7 rounded-lg bg-white dark:bg-[#3A3A3C] shadow-sm flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:scale-100"
    >
      <FaMinus size={8} />
    </button>
    <div className="w-8 text-center text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">
      {value}
    </div>
    <button
      onClick={() => !disabled && onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      className="w-7 h-7 rounded-lg bg-white dark:bg-[#3A3A3C] shadow-sm flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:scale-100"
    >
      <FaPlus size={8} />
    </button>
  </div>
);

// ── Permission Row (iOS grouped table style) ─────────────
const PermRow = ({ icon, label, desc, checked, onChange, disabled, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03, duration: 0.3, ease: 'easeOut' }}
    className="flex items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-[#1C1C1E] group"
  >
    <div className="flex items-center gap-3.5 flex-1 min-w-0">
      <div className="w-8 h-8 rounded-[10px] bg-gray-50 dark:bg-[#2C2C2E] flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform border border-black/5 dark:border-white/5 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium tracking-tight text-gray-900 dark:text-white">{label}</p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5 truncate pr-2">{desc}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </motion.div>
);

// ── Section Sidebar Item ─────────────────────────────────
const SectionItem = ({ section, active, onClick, saving }) => {
  const dotColor = section.color || '#8E8E93';
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left transition-all duration-200 relative my-0.5
        ${active
          ? 'bg-[#E5E5EA] dark:bg-[#2C2C2E]'
          : 'hover:bg-black/5 dark:hover:bg-white/5'
        }
      `}
    >
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200 shadow-sm ${active ? 'scale-110' : ''}`}
        style={{ backgroundColor: dotColor }}
      />
      <span className={`text-[14px] truncate flex-1 ${active
        ? 'font-bold text-gray-900 dark:text-white'
        : 'font-medium text-gray-600 dark:text-gray-400'
        }`}>
        {section.seccion}
      </span>
      {saving && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto shrink-0">
          <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}
    </button>
  );
};

const SectionPermsModal = ({ open, onClose, token, walletAddress, appState }) => {
  const { t } = useTranslation('');
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

  const sectionKey = currentSection?.seccion || 'none';

  const PERM_GROUPS = useMemo(() => [
    {
      title: t('perms.title_communication', 'COMUNICACIÓN'),
      icon: '💬',
      perms: [
        { key: 'can_create_groups', label: t('chat.perms.perm_create_groups', 'Crear Grupos'), desc: t('chat.perms.perm_create_groups_desc', 'Trabajadores pueden crear sus propios grupos de chat'), icon: '👥' },
        { key: 'can_create_channels', label: t('chat.perms.perm_create_channels', 'Crear Canales'), desc: t('chat.perms.perm_create_channels_desc', 'Pueden crear nuevos canales públicos o privados'), icon: '#️⃣' },
        { key: 'can_post_announcements', label: t('chat.perms.perm_post_announcements', 'Publicar Anuncios'), desc: t('chat.perms.perm_post_announcements_desc', 'Pueden publicar mensajes en canales de anuncios'), icon: '📢' },
        { key: 'can_upload_media', label: t('chat.perms.perm_upload_media', 'Subir Media'), desc: t('chat.perms.perm_upload_media_desc', 'Pueden adjuntar imágenes, videos y archivos'), icon: '📎' },
      ],
    },
    {
      title: t('perms.title_moderation', 'MODERACIÓN'),
      icon: '🛡️',
      perms: [
        { key: 'can_invite_members', label: t('chat.perms.perm_invite_members', 'Invitar Miembros'), desc: t('chat.perms.perm_invite_members_desc', 'Pueden invitar nuevas personas a sus grupos'), icon: '✉️' },
        { key: 'can_pin_messages', label: t('chat.perms.perm_pin_messages', 'Fijar Mensajes'), desc: t('chat.perms.perm_pin_messages_desc', 'Pueden anclar mensajes importantes en canales'), icon: '📌' },
      ],
    },
  ], [t]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px]"
        onClick={onClose}
      />

      {/* Modal - macOS System Settings Layout */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full h-full max-w-full max-h-full sm:max-h-[calc(100%-2rem)] sm:max-w-[calc(100%-2rem)] md:max-w-[900px] bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-[40px] border border-light-border/50 dark:border-dark-border/50 sm:rounded-[28px] shadow-2xl flex flex-col md:flex-row overflow-hidden"
      >
        {/* ─── Left Sidebar ─── */}
        <div className="w-full md:w-[260px] shrink-0 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border-b md:border-b-0 md:border-r border-light-border/50 dark:border-dark-border/50 flex flex-col h-[30vh] md:h-auto overflow-hidden">
          {/* Header */}
          <div className="px-5 md:px-6 py-4 md:py-7 md:pb-4 shrink-0">
            <h2 className="text-xl md:text-[22px] font-bold tracking-tight text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
              <FaShieldAlt className="text-light-text-tertiary dark:text-dark-text-tertiary" size={18} />
              {t('perms.modal_title', 'Permisos')}
            </h2>
            <p className="text-xs md:text-[13px] text-light-text-secondary dark:text-dark-text-secondary mt-1 font-medium hidden md:block">{t('perms.modal_desc', 'Gestión de secciones')}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 md:pb-6 no-scrollbar">
            {loading && (
              <div className="space-y-2 px-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 rounded-[12px] bg-light-surface-tertiary/20 dark:bg-dark-surface-tertiary/20 animate-pulse" />
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
        </div>

        {/* ─── Right Content ─── */}
        <div className="flex-1 flex flex-col relative min-h-0">
          {/* Content Header */}
          <div className="px-5 md:px-8 h-[60px] md:h-[68px] shrink-0 border-b border-light-border/30 dark:border-dark-border/30 flex items-center justify-between bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-xl z-10 sticky top-0">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: currentSection?.color || 'transparent' }}
              />
              <h3 className="text-base md:text-[17px] font-bold tracking-tight text-light-text-primary dark:text-dark-text-primary">
                {currentSection ? currentSection.seccion : t('perms.content_default_title', 'Ajustes de Sección')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-[28px] h-[28px] rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center text-light-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-all"
            >
              <FaTimes size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
            <AnimatePresence mode="wait">
              {currentSection ? (
                <motion.div
                  key={sectionKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="p-5 md:p-8 max-w-[600px] mx-auto space-y-6 md:space-y-8"
                >
                  {/* Saving Banner */}
                  <AnimatePresence>
                    {saving === currentSection.seccion && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-light-success/10 text-light-success border border-light-success/20 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-[13px] font-bold">
                          <div className="w-3.5 h-3.5 border-2 border-light-success border-t-transparent rounded-full animate-spin" />
                          {t('perms.saving', 'Guardando preferencias...')}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Permission Groups */}
                  {PERM_GROUPS.map((group, gi) => (
                    <div key={group.title}>
                      <p className="text-[12px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-2 px-4 uppercase tracking-widest flex items-center gap-1.5">
                        {group.icon} {group.title}
                      </p>
                      <div className="rounded-[20px] overflow-hidden bg-white dark:bg-dark-surface-secondary border border-light-border/40 dark:border-dark-border/40 shadow-sm divide-y divide-light-border/20 dark:divide-dark-border/20">
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

                  {/* Settings Group */}
                  <div>
                    <p className="text-[12px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-2 px-4 uppercase tracking-widest flex items-center gap-1.5">
                      ⚙️ {t('perms.title_limits', 'LÍMITES Y APARIENCIA')}
                    </p>
                    <div className="rounded-[20px] overflow-hidden bg-white dark:bg-dark-surface-secondary border border-light-border/40 dark:border-dark-border/40 shadow-sm divide-y divide-light-border/20 dark:divide-dark-border/20">
                      {/* Max Groups */}
                      <div className="flex items-center justify-between gap-4 py-3.5 px-4">
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-[10px] bg-light-surface-secondary dark:bg-dark-surface-tertiary flex items-center justify-center text-lg shrink-0 border border-light-border/40 dark:border-dark-border/40">
                            🔢
                          </div>
                          <div className="min-w-0">
                            <p className="text-[16px] font-medium tracking-tight text-light-text-primary dark:text-dark-text-primary">{t('perms.max_groups', 'Máximo de Grupos')}</p>
                            <p className="text-[13px] text-light-text-secondary dark:text-dark-text-secondary leading-snug mt-0.5 truncate">{t('perms.max_groups_desc', 'Límite de grupos activos permitidos')}</p>
                          </div>
                        </div>
                        <Stepper
                          value={currentSection.max_groups ?? 5}
                          onChange={(v) => handleMaxGroups(currentSection.seccion, v)}
                          disabled={saving === currentSection.seccion}
                        />
                      </div>

                      {/* Color Picker */}
                      <div className="flex items-center justify-between gap-4 py-3.5 px-4">
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-[10px] bg-light-surface-secondary dark:bg-dark-surface-tertiary flex items-center justify-center text-lg shrink-0 border border-light-border/40 dark:border-dark-border/40">
                            🎨
                          </div>
                          <div className="min-w-0">
                            <p className="text-[16px] font-medium tracking-tight text-light-text-primary dark:text-dark-text-primary">{t('perms.color', 'Color de Identidad')}</p>
                            <p className="text-[13px] text-light-text-secondary dark:text-dark-text-secondary leading-snug mt-0.5 truncate">{t('perms.color_desc', 'Etiquetas y avatares de esta sección')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="relative cursor-pointer group">
                            <input
                              type="color"
                              value={currentSection.color || '#8E8E93'}
                              onChange={e => handleToggle(currentSection.seccion, 'color', e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <div
                              className="w-[30px] h-[30px] rounded-full border-2 border-white dark:border-dark-surface-secondary shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-transform group-hover:scale-110"
                              style={{ backgroundColor: currentSection.color || '#8E8E93' }}
                            />
                          </label>
                          {currentSection.color && (
                            <button
                              onClick={() => handleToggle(currentSection.seccion, 'color', null)}
                              className="text-[12px] font-bold text-light-error dark:text-dark-error hover:text-white bg-light-error/10 dark:bg-dark-error/10 hover:bg-light-error dark:hover:bg-dark-error px-3 py-1.5 rounded-full transition-all"
                            >
                              {t('perms.reset', 'Reset')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full py-16 md:py-24 text-center px-6 mt-12 md:mt-0"
                >
                  <div className="w-20 h-20 rounded-[24px] bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 flex items-center justify-center text-3xl mb-5 border border-light-border/40 dark:border-dark-border/40 shadow-inner">
                    🛡️
                  </div>
                  <p className="text-[18px] font-bold tracking-tight text-light-text-primary dark:text-dark-text-primary">
                    {t('perms.empty_title', 'Configuración de Sección')}
                  </p>
                  <p className="text-[14px] text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-[260px] mx-auto leading-relaxed">
                    {t('perms.empty_desc', 'Selecciona una sección en la barra lateral para gestionar sus privilegios.')}
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
