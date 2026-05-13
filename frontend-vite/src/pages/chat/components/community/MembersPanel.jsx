// src/pages/chat/components/community/MembersPanel.jsx
// Discord-style right sidebar showing all community members by section + presence
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaChevronDown, FaChevronRight, FaCircle, FaTimes } from 'react-icons/fa';

const STATUS_DOT = {
  online: 'text-green-400',
  idle: 'text-yellow-400',
  offline: 'text-gray-500',
};

const SECTION_ICONS = {
  cocina: '🍳', delivery: '🍕', sala: '🍽️', general: '💬', default: '🏷️',
};

const MemberRow = ({ member, onClick }) => (
  <button
    onClick={() => onClick?.(member)}
    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40 transition group"
  >
    {/* Avatar with status dot */}
    <div className="relative shrink-0">
      <div className="w-8 h-8 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-xs font-bold overflow-hidden">
        {member.profile_image_url
          ? <img src={member.profile_image_url} className="w-8 h-8 rounded-full object-cover" alt="" />
          : (member.name || '?')[0]?.toUpperCase()
        }
      </div>
      <FaCircle
        size={9}
        className={`absolute -bottom-0.5 -right-0.5 ${STATUS_DOT[member.status] || STATUS_DOT.offline} drop-shadow-sm`}
      />
    </div>
    {/* Name + cargo */}
    <div className="flex-1 min-w-0 text-left">
      <div className={`text-[13px] font-medium truncate ${member.status === 'offline' ? 'opacity-50' : ''}`}>
        {member.name}
      </div>
      {member.cargo && (
        <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary truncate opacity-70">
          {member.cargo}
        </div>
      )}
    </div>
  </button>
);

const SectionBlock = ({ seccion, members, icon, defaultOpen = true, onClickMember }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary transition"
      >
        {open ? <FaChevronDown size={7} /> : <FaChevronRight size={7} />}
        <span>{icon} {seccion}</span>
        <span className="ml-auto text-[10px] font-normal opacity-60">{members.length}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden pl-1"
          >
            {members.map(m => (
              <MemberRow key={m.wallet} member={m} onClick={onClickMember} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MembersPanel = ({
  onlineBySection = {},
  idleBySection = {},
  offlineBySection = {},
  onlineCount = 0,
  idleCount = 0,
  offlineCount = 0,
  activeGroup = null,
  onClickMember,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grupos'); // 'grupos' or 'todos'

  const sectionOrder = ['General', 'Cocina', 'Sala', 'Delivery'];

  const sortSections = (sectionMap) => {
    const keys = Object.keys(sectionMap);
    const ordered = sectionOrder.filter(s => keys.some(k => k.toLowerCase() === s.toLowerCase()));
    const matchedKeys = new Set(ordered.map(o => keys.find(k => k.toLowerCase() === o.toLowerCase())));
    const rest = keys.filter(k => !matchedKeys.has(k)).sort();
    return [...Array.from(matchedKeys), ...rest];
  };

  // Filter by search and group rules
  const filterMembers = (sectionMap) => {
    const q = search.trim().toLowerCase();
    const filtered = {};
    
    const validWallets = viewMode === 'grupos' && activeGroup && !activeGroup.is_section_based
      ? new Set((activeGroup.members || []).map(m => m.wallet?.toLowerCase()))
      : null;

    const allowedSections = viewMode === 'grupos' && activeGroup && activeGroup.is_section_based
      ? (activeGroup.allowed_secciones || []).map(s => s.toLowerCase())
      : null;
      
    const allowedCargos = viewMode === 'grupos' && activeGroup && activeGroup.is_section_based
      ? (activeGroup.allowed_cargos || []).map(c => c.toLowerCase())
      : null;

    for (const [sec, members] of Object.entries(sectionMap)) {
      const match = members.filter(m => {
        // If it's a manual group, check validWallets
        if (validWallets && !validWallets.has((m.wallet || '').toLowerCase())) return false;
        
        // If it's a section-based group, check seccion and cargo
        if (allowedSections !== null || allowedCargos !== null) {
          const userSec = (m.seccion || '').toLowerCase();
          const userCar = (m.cargo || '').toLowerCase();
          const hasSec = allowedSections && allowedSections.length > 0 && allowedSections.includes(userSec);
          const hasCar = allowedCargos && allowedCargos.length > 0 && allowedCargos.includes(userCar);
          if (!hasSec && !hasCar && (allowedSections.length > 0 || allowedCargos.length > 0)) return false;
        }

        if (q && !m.name?.toLowerCase().includes(q) && !m.cargo?.toLowerCase().includes(q)) return false;
        return true;
      });
      if (match.length > 0) filtered[sec] = match;
    }
    return filtered;
  };

  const filteredOnline = useMemo(() => filterMembers(onlineBySection), [onlineBySection, search, viewMode, activeGroup]);
  const filteredIdle = useMemo(() => filterMembers(idleBySection), [idleBySection, search, viewMode, activeGroup]);
  const filteredOffline = useMemo(() => filterMembers(offlineBySection), [offlineBySection, search, viewMode, activeGroup]);

  const totalOnline = Object.values(filteredOnline).reduce((s, m) => s + m.length, 0);
  const totalIdle = Object.values(filteredIdle).reduce((s, m) => s + m.length, 0);
  const totalOffline = Object.values(filteredOffline).reduce((s, m) => s + m.length, 0);

  return (
    <div className="h-full flex flex-col bg-light-surface/50 dark:bg-dark-surface/50">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary">
          👥 Miembros
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-light-text-tertiary hover:text-red-400 transition">
            <FaTimes size={12} />
          </button>
        )}
      </div>

      {/* Search and Toggle */}
      <div className="shrink-0 px-2 py-2 flex flex-col gap-2 border-b border-light-border/20 dark:border-dark-border/20">
        <div className="flex bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode('grupos')}
            className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md transition ${viewMode === 'grupos' ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-tertiary hover:text-light-text-secondary'}`}
          >
            Grupos
          </button>
          <button
            onClick={() => setViewMode('todos')}
            className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md transition ${viewMode === 'todos' ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-tertiary hover:text-light-text-secondary'}`}
          >
            Todos
          </button>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/20 dark:border-dark-border/20">
          <FaSearch size={10} className="text-light-text-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="flex-1 bg-transparent text-xs outline-none text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary/50"
          />
        </div>
      </div>

      {/* Members list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 space-y-2 py-2 pb-4 custom-scrollbar">
        {viewMode === 'grupos' ? (
          <>
            {/* Online */}
            {totalOnline > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-green-400 flex items-center gap-1.5">
                  <FaCircle size={6} /> En Línea — {totalOnline}
                </div>
                {sortSections(filteredOnline).map(sec => (
                  <SectionBlock
                    key={`on-${sec}`}
                    seccion={sec}
                    members={filteredOnline[sec]}
                    icon={SECTION_ICONS[sec.toLowerCase()] || SECTION_ICONS.default}
                    onClickMember={onClickMember}
                  />
                ))}
              </div>
            )}

            {/* Idle */}
            {totalIdle > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400 flex items-center gap-1.5 mt-2">
                  <FaCircle size={6} /> Ausente — {totalIdle}
                </div>
                {sortSections(filteredIdle).map(sec => (
                  <SectionBlock
                    key={`idle-${sec}`}
                    seccion={sec}
                    members={filteredIdle[sec]}
                    icon={SECTION_ICONS[sec.toLowerCase()] || SECTION_ICONS.default}
                    defaultOpen={false}
                    onClickMember={onClickMember}
                  />
                ))}
              </div>
            )}

            {/* Offline */}
            {totalOffline > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 mt-2">
                  <FaCircle size={6} /> Desconectado — {totalOffline}
                </div>
                {sortSections(filteredOffline).map(sec => (
                  <SectionBlock
                    key={`off-${sec}`}
                    seccion={sec}
                    members={filteredOffline[sec]}
                    icon={SECTION_ICONS[sec.toLowerCase()] || SECTION_ICONS.default}
                    defaultOpen={false}
                    onClickMember={onClickMember}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-0.5">
            {[
              ...Object.values(filteredOnline).flat(),
              ...Object.values(filteredIdle).flat(),
              ...Object.values(filteredOffline).flat()
            ].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
              <MemberRow key={m.wallet} member={m} onClick={onClickMember} />
            ))}
          </div>
        )}

        {totalOnline === 0 && totalIdle === 0 && totalOffline === 0 && (
          <div className="text-center py-8 text-xs text-light-text-tertiary">
            {search ? 'Sin resultados' : 'Conectándose...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MembersPanel;
