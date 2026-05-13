// src/pages/chat/components/community/CreateModals.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaHashtag, FaUsers, FaBullhorn, FaSearch } from 'react-icons/fa';
import { useCreateChannelModal, useDmPickerModal } from '../../../../hooks/chat/useCreateModals';

const Overlay = ({ children, onClose }) => (
  <motion.div
    className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      onClick={e => e.stopPropagation()}
      initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
      className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/40 dark:border-dark-border/40 shadow-2xl w-full max-w-md m-4 overflow-hidden"
    >
      {children}
    </motion.div>
  </motion.div>
);

// ─── Selector Pill (multi-select chips) ────────────────────────
const PillSelector = ({ options = [], value = [], onChange, placeholder = 'Seleccionar...', color = 'matrix-green' }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (opt) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div>
      {/* Selected pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-${color}/15 text-${color} border border-${color}/30`}>
              {v}
              <button onClick={() => toggle(v)} className="hover:text-red-400 transition">✕</button>
            </span>
          ))}
        </div>
      )}
      {/* Search + dropdown */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30">
          <FaSearch size={10} className="text-light-text-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary/50"
          />
        </div>
        {(search.trim() || value.length === 0) && filtered.length > 0 && (
          <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-light-border/20 dark:border-dark-border/20 bg-light-surface dark:bg-dark-surface">
            {filtered.slice(0, 20).map(opt => (
              <button
                key={opt}
                onClick={() => { toggle(opt); setSearch(''); }}
                className={`w-full text-left px-3 py-1.5 text-sm transition ${
                  value.includes(opt)
                    ? `bg-matrix-green/10 text-matrix-green font-medium`
                    : 'hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40'
                }`}
              >
                {value.includes(opt) ? '✓ ' : ''}{opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Single selector (dropdown) ────────────────────────────────
const SingleSelector = ({ options = [], value, onChange, placeholder = 'Seleccionar...', allowEmpty = true }) => (
  <select
    value={value || ''}
    onChange={e => onChange(e.target.value || null)}
    className="w-full px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-sm outline-none focus:border-matrix-green text-light-text-primary dark:text-dark-text-primary"
  >
    {allowEmpty && <option value="">{placeholder}</option>}
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ─── Create Channel Modal ──────────────────────────────────────
export const CreateChannelModal = ({ open, onClose, token, walletAddress, onCreated }) => {
  const {
    name, setName, type, setType, section, setSection,
    description, setDescription, icon, setIcon, minRole, setMinRole,
    loading, suggestions, catalogs, applySuggestion, handleCreate
  } = useCreateChannelModal({ open, token, walletAddress, onCreated, onClose });

  if (!open) return null;

  return (
    <Overlay onClose={onClose}>
      <div className="px-6 py-4 border-b border-light-border/30 dark:border-dark-border/30 flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center gap-2"><FaHashtag className="text-matrix-green" /> Crear Canal</h3>
        <button onClick={onClose} className="text-light-text-tertiary hover:text-red-400"><FaTimes /></button>
      </div>
      <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <label className="text-xs font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase mb-1 block">Sugeridos</label>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button key={s.slug} onClick={() => applySuggestion(s)}
                  className="px-2.5 py-1 text-xs rounded-full bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 transition border border-matrix-green/20">
                  {s.icon} {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-sm outline-none focus:border-matrix-green" placeholder="ej: cocina, anuncios..." />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Tipo</label>
          <div className="flex gap-2">
            <button onClick={() => setType('text')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${type === 'text' ? 'bg-matrix-green/15 text-matrix-green border border-matrix-green/40' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border border-transparent'}`}>
              <FaHashtag className="inline mr-1" /> Texto
            </button>
            <button onClick={() => setType('announcement')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${type === 'announcement' ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/40' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border border-transparent'}`}>
              <FaBullhorn className="inline mr-1" /> Anuncios
            </button>
          </div>
        </div>

        {/* Section - REAL SELECTOR from cargos_intranet */}
        <div>
          <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Sección</label>
          <SingleSelector
            options={catalogs.secciones}
            value={section}
            onChange={setSection}
            placeholder="Todas las secciones (sin filtro)"
          />
          <p className="text-[10px] text-light-text-tertiary mt-1">Solo trabajadores de esta sección verán el canal (nivel 6-7)</p>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Descripción</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-sm outline-none" />
        </div>

        {/* Icon + Role */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Ícono</label>
            <input value={icon} onChange={e => setIcon(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-sm outline-none" placeholder="🍳" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-light-text-tertiary uppercase mb-1 block">Nivel mínimo</label>
            <select value={minRole} onChange={e => setMinRole(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-sm outline-none">
              <option value={3}>3 - Admin</option>
              <option value={4}>4 - Subadmin</option>
              <option value={5}>5 - Miembro</option>
              <option value={6}>6 - Staff</option>
              <option value={7}>7 - Trabajador</option>
            </select>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-light-border/30 dark:border-dark-border/30">
        <button onClick={handleCreate} disabled={!name.trim() || loading}
          className="w-full py-2.5 rounded-xl bg-matrix-green text-dark-bg font-bold disabled:opacity-40 hover:bg-matrix-green/90 transition">
          {loading ? 'Creando...' : 'Crear Canal'}
        </button>
      </div>
    </Overlay>
  );
};



// ─── DM Picker Modal ───────────────────────────────────────────
export const DmPickerModal = ({ open, onClose, onSelectPeer, token, walletAddress }) => {
  const {
    members, search, setSearch, sectionFilter, setSectionFilter,
    catalogs, loading
  } = useDmPickerModal({ open, token, walletAddress });

  if (!open) return null;

  return (
    <Overlay onClose={onClose}>
      <div className="px-6 py-4 border-b border-light-border/30 dark:border-dark-border/30 flex justify-between items-center">
        <h3 className="text-lg font-bold">💬 Mensaje Directo</h3>
        <button onClick={onClose} className="text-light-text-tertiary hover:text-red-400"><FaTimes /></button>
      </div>
      <div className="px-6 py-4 space-y-3">
        {/* Section filter */}
        <SingleSelector
          options={catalogs.secciones}
          value={sectionFilter}
          onChange={setSectionFilter}
          placeholder="Todas las secciones"
        />
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30">
          <FaSearch size={10} className="text-light-text-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cargo..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {/* Members */}
        <div className="max-h-72 overflow-y-auto space-y-0.5 rounded-lg">
          {loading && <div className="text-sm text-center py-4 text-light-text-tertiary">Cargando...</div>}
          {!loading && members.length === 0 && <div className="text-sm text-center py-4 text-light-text-tertiary">Sin resultados</div>}
          {members.filter(m => m.wallet && m.wallet.toLowerCase() !== (walletAddress || '').toLowerCase()).map(m => (
            <button
              key={m.wallet}
              onClick={() => { onSelectPeer(m); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40 transition"
            >
              <div className="w-9 h-9 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                {m.profile_image_url
                  ? <img src={m.profile_image_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                  : (m.name || '?')[0]?.toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary truncate">{m.name}</div>
                <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary truncate">{m.cargo} · {m.seccion}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
};
