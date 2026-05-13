// src/pages/chat/components/community/SectionPermsModal.jsx
// Admin modal for managing per-section community permissions
import { FaTimes, FaCog, FaCheck } from 'react-icons/fa';
import useSectionPerms from '../../../../hooks/chat/useSectionPerms';

const PERM_LABELS = {
  can_create_groups: { label: 'Crear Grupos', desc: 'Trabajadores pueden crear grupos de chat', icon: '👥' },
  can_create_channels: { label: 'Crear Canales', desc: 'Pueden crear nuevos canales (generalmente solo admin)', icon: '#️⃣' },
  can_post_announcements: { label: 'Publicar Anuncios', desc: 'Pueden postear en canales de anuncios', icon: '📢' },
  can_upload_media: { label: 'Subir Media', desc: 'Pueden subir imágenes, videos y archivos', icon: '📎' },
  can_invite_members: { label: 'Invitar Miembros', desc: 'Pueden invitar personas a sus grupos', icon: '✉️' },
  can_pin_messages: { label: 'Fijar Mensajes', desc: 'Pueden fijar mensajes en sus canales', icon: '📌' },
};

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
      checked ? 'bg-matrix-green' : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
      checked ? 'translate-x-[22px]' : 'translate-x-0.5'
    }`} />
  </button>
);

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

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/40 dark:border-dark-border/40 shadow-2xl w-full max-w-lg m-4 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-light-border/30 dark:border-dark-border/30 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FaCog className="text-matrix-green" /> Permisos por Sección
            </h3>
            <button onClick={onClose} className="text-light-text-tertiary hover:text-red-400">
              <FaTimes />
            </button>
          </div>

          <div className="flex min-h-[400px] max-h-[60vh]">
            {/* Section tabs */}
            <div className="w-36 shrink-0 border-r border-light-border/20 dark:border-dark-border/20 overflow-y-auto bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
              {loading && <div className="p-3 text-xs text-center text-light-text-tertiary">Cargando...</div>}
              {sections.map(s => (
                <button
                  key={s.seccion}
                  onClick={() => setActiveSection(s.seccion)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition border-l-2 ${
                    activeSection === s.seccion
                      ? 'bg-matrix-green/10 text-matrix-green border-matrix-green font-medium'
                      : 'border-transparent hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40 text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {s.seccion}
                </button>
              ))}
            </div>

            {/* Perms panel */}
            <div className="flex-1 p-4 overflow-y-auto">
              {currentSection ? (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                      {currentSection.seccion}
                    </h4>
                    {currentSection.updated_at && (
                      <p className="text-[10px] text-light-text-tertiary mt-0.5">
                        Última modificación: {new Date(currentSection.updated_at).toLocaleString('es-CL')}
                      </p>
                    )}
                  </div>

                  {/* Toggle rows */}
                  {Object.entries(PERM_LABELS).map(([key, { label, desc, icon }]) => (
                    <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-light-border/10 dark:border-dark-border/10">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span>{icon}</span> {label}
                        </div>
                        <p className="text-[11px] text-light-text-tertiary mt-0.5">{desc}</p>
                      </div>
                      <Toggle
                        checked={!!currentSection[key]}
                        onChange={(val) => handleToggle(currentSection.seccion, key, val)}
                        disabled={saving === currentSection.seccion}
                      />
                    </div>
                  ))}

                  {/* Max groups slider */}
                  <div className="py-2">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span>🔢</span> Máx. Grupos
                        </div>
                        <p className="text-[11px] text-light-text-tertiary mt-0.5">
                          Cantidad máxima de grupos que esta sección puede crear
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={currentSection.max_groups ?? 5}
                        onChange={e => handleMaxGroups(currentSection.seccion, e.target.value)}
                        className="w-16 px-2 py-1 rounded-md text-center text-sm bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 outline-none focus:border-matrix-green"
                      />
                    </div>
                  </div>

                  {saving === currentSection.seccion && (
                    <div className="flex items-center gap-1.5 text-xs text-matrix-green">
                      <FaCheck size={10} /> Guardando...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-light-text-tertiary">
                  Selecciona una sección
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SectionPermsModal;
