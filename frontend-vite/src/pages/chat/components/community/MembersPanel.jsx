// src/pages/chat/components/community/MembersPanel.jsx
// Discord-style right sidebar — members grouped by SECTION first, then by presence within
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaChevronDown, FaChevronRight, FaCircle, FaTimes, FaUserSlash, FaEnvelope, FaUserCheck, FaAt } from 'react-icons/fa';
import { getSectionColor, getSectionIcon } from './sectionColors';

const STATUS_DOT = {
  online: 'text-green-400',
  idle: 'text-yellow-400',
  offline: 'text-gray-500',
  unregistered: 'text-gray-600',
};

const MemberRow = ({ member, onClick, onDm }) => (
  <div className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40 transition group">
    <button
      onClick={() => onClick?.(member)}
      className="flex-1 flex items-center gap-2.5 min-w-0"
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
      {/* Name + cargo/email */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <div className={`text-[13px] font-medium truncate ${member.status === 'offline' || member.status === 'unregistered' ? 'opacity-50' : ''}`}>
            {member.name}
          </div>
          {member.has_user && (
            <FaUserCheck size={10} className="text-blue-400 shrink-0" title="Usuario Registrado (Web3)" />
          )}
        </div>
        {(member.cargo || member.email) && (
          <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary truncate opacity-70 flex items-center gap-1">
            {member.cargo && <span>{member.cargo}</span>}
            {member.cargo && member.email && <span>•</span>}
            {member.email && <span className="truncate">{member.email}</span>}
          </div>
        )}
      </div>
    </button>
    
    {/* Hover Actions: Email & DM */}
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
      {member.email && (
        <a
          href={`mailto:${member.email}`}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md text-light-text-tertiary hover:text-green-400 hover:bg-green-400/10 transition"
          title="Enviar correo"
        >
          <FaAt size={11} />
        </a>
      )}
    {/* DM button — hover reveal */}
    {member.wallet && onDm && (
      <button
        onClick={(e) => { e.stopPropagation(); onDm(member); }}
        className="p-1.5 rounded-md text-light-text-tertiary hover:text-blue-400 hover:bg-blue-400/10 transition"
        title="Mensaje directo"
      >
        <FaEnvelope size={11} />
      </button>
    )}
    </div>
  </div>
);

const SectionBlock = ({ seccion, members, defaultOpen = true, onClickMember, onDmMember }) => {
  const [open, setOpen] = useState(defaultOpen);
  const sc = getSectionColor(seccion);
  const icon = getSectionIcon(seccion);

  // Count presence within section
  const onlineCount = members.filter(m => m.status === 'online').length;
  const idleCount = members.filter(m => m.status === 'idle').length;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-light-surface-tertiary/30 dark:hover:bg-dark-surface-tertiary/20 rounded-md transition"
        style={{ color: sc.color }}
      >
        {open ? <FaChevronDown size={7} /> : <FaChevronRight size={7} />}
        <span>{icon} {seccion}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal opacity-70">
          {onlineCount > 0 && (
            <span className="flex items-center gap-0.5">
              <FaCircle size={5} className="text-green-400" />{onlineCount}
            </span>
          )}
          {idleCount > 0 && (
            <span className="flex items-center gap-0.5">
              <FaCircle size={5} className="text-yellow-400" />{idleCount}
            </span>
          )}
          <span className="opacity-60">{members.length}</span>
        </span>
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
              <MemberRow key={m.wallet || m.rut || m.name} member={m} onClick={onClickMember} onDm={onDmMember} />
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
  unregisteredBySection = {},
  onlineCount = 0,
  idleCount = 0,
  offlineCount = 0,
  unregisteredCount = 0,
  activeGroup = null,
  onClickMember,
  onDmMember,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [showUnregistered, setShowUnregistered] = useState(false);

  const sectionOrder = ['General', 'Cocina', 'Sala', 'Delivery', 'Bar', 'Caja', 'Admin'];

  // Merge all members into a single map: section → members[] (sorted: online → idle → offline)
  const mergedBySection = useMemo(() => {
    const map = {};

    const addMembers = (sectionMap, status) => {
      for (const [sec, members] of Object.entries(sectionMap)) {
        if (!map[sec]) map[sec] = [];
        map[sec].push(...members.map(m => ({ ...m, status })));
      }
    };

    addMembers(onlineBySection, 'online');
    addMembers(idleBySection, 'idle');
    addMembers(offlineBySection, 'offline');

    // Sort within each section: online first, then idle, then offline
    const statusPriority = { online: 0, idle: 1, offline: 2 };
    for (const sec of Object.keys(map)) {
      map[sec].sort((a, b) => (statusPriority[a.status] || 9) - (statusPriority[b.status] || 9));
    }

    return map;
  }, [onlineBySection, idleBySection, offlineBySection]);

  // Flatten all members to deduplicate and split by has_user
  const allMembers = useMemo(() => {
    const list = [];
    const seen = new Set();
    
    const add = (members) => {
      members.forEach(m => {
        // Fallback to name if no rut or wallet
        const id = m.wallet || m.rut || m.name;
        if (!seen.has(id)) {
          seen.add(id);
          list.push(m);
        }
      });
    };

    Object.values(mergedBySection).forEach(add);
    Object.values(unregisteredBySection).forEach(add);
    
    return list;
  }, [mergedBySection, unregisteredBySection]);

  // Filter all members
  const filterMember = (m) => {
    const q = search.trim().toLowerCase();
    
    const validWallets = activeGroup && !activeGroup.is_section_based
      ? new Set((activeGroup.members || []).map(gm => gm.wallet?.toLowerCase()))
      : null;

    const allowedSections = activeGroup && activeGroup.is_section_based
      ? (activeGroup.allowed_secciones || []).map(s => s.toLowerCase())
      : null;
      
    const allowedCargos = activeGroup && activeGroup.is_section_based
      ? (activeGroup.allowed_cargos || []).map(c => c.toLowerCase())
      : null;

    if (validWallets && !validWallets.has((m.wallet || '').toLowerCase())) return false;
    
    if (allowedSections !== null || allowedCargos !== null) {
      const userSec = (m.seccion || '').toLowerCase();
      const userCar = (m.cargo || '').toLowerCase();
      const hasSec = allowedSections && allowedSections.length > 0 && allowedSections.includes(userSec);
      const hasCar = allowedCargos && allowedCargos.length > 0 && allowedCargos.includes(userCar);
      if (!hasSec && !hasCar && (allowedSections.length > 0 || allowedCargos.length > 0)) return false;
    }

    if (q && !m.name?.toLowerCase().includes(q) && !m.cargo?.toLowerCase().includes(q)) return false;
    return true;
  };

  const filteredMembers = useMemo(() => allMembers.filter(filterMember), [allMembers, search, activeGroup]);

  // Group by section, split by has_user
  const { conUsuario, sinUsuario } = useMemo(() => {
    const con = {};
    const sin = {};
    
    filteredMembers.forEach(m => {
      const sec = m.seccion || 'General';
      if (m.has_user) {
        if (!con[sec]) con[sec] = [];
        con[sec].push(m);
      } else {
        if (!sin[sec]) sin[sec] = [];
        sin[sec].push(m);
      }
    });

    // Helper to sort object by sectionOrder
    const sortObj = (obj) => {
      const keys = Object.keys(obj);
      const ordered = sectionOrder.filter(s => keys.some(k => k.toLowerCase() === s.toLowerCase()));
      const matchedKeys = new Set(ordered.map(o => keys.find(k => k.toLowerCase() === o.toLowerCase())));
      const rest = keys.filter(k => !matchedKeys.has(k)).sort();
      
      const sorted = {};
      [...Array.from(matchedKeys), ...rest].forEach(k => {
        sorted[k] = obj[k];
      });
      return sorted;
    };

    return { conUsuario: sortObj(con), sinUsuario: sortObj(sin) };
  }, [filteredMembers]);

  const totalUsuarios = Object.values(conUsuario).reduce((s, m) => s + m.length, 0);
  const totalSinUsuarios = Object.values(sinUsuario).reduce((s, m) => s + m.length, 0);

  return (
    <div className="h-full flex flex-col bg-light-surface/50 dark:bg-dark-surface/50">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary">
          👥 Miembros
        </h3>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-green-400">
            <FaCircle size={5} /> {onlineCount}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-light-text-tertiary hover:text-red-400 transition">
              <FaTimes size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 py-2 border-b border-light-border/20 dark:border-dark-border/20">
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

      {/* Members list — con usuario */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 space-y-1 py-2 pb-4 custom-scrollbar">
        {totalUsuarios > 0 ? (
          Object.entries(conUsuario).map(([sec, members]) => (
            <SectionBlock
              key={`con-${sec}`}
              seccion={sec}
              members={members}
              onClickMember={onClickMember}
              onDmMember={onDmMember}
            />
          ))
        ) : (
          <div className="text-center py-8 text-xs text-light-text-tertiary">
            {search ? 'Sin resultados' : 'Sin usuarios activos'}
          </div>
        )}

        {/* Members list — sin usuario */}
        {totalSinUsuarios > 0 && (
          <div className="mt-3 pt-3 border-t border-light-border/20 dark:border-dark-border/20">
            <button
              onClick={() => setShowUnregistered(v => !v)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-400 rounded-md transition"
            >
              {showUnregistered ? <FaChevronDown size={7} /> : <FaChevronRight size={7} />}
              <FaUserSlash size={10} />
              <span>Sin Usuario — {totalSinUsuarios}</span>
            </button>
            <AnimatePresence>
              {showUnregistered && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden pl-1 space-y-1 mt-1"
                >
                  {Object.entries(sinUsuario).map(([sec, members]) => (
                    <SectionBlock
                      key={`sin-${sec}`}
                      seccion={sec}
                      members={members}
                      defaultOpen={true}
                      onClickMember={onClickMember}
                      onDmMember={onDmMember}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembersPanel;
