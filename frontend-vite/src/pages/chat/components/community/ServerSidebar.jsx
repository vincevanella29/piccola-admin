// src/pages/chat/components/community/ServerSidebar.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHashtag, FaBullhorn, FaPlus, FaChevronDown,
  FaChevronRight, FaCog, FaUsers, FaEnvelope, FaCircle
} from 'react-icons/fa';
import useServerSidebar from '../../../../hooks/chat/useServerSidebar';

const SECTION_ICONS = {
  cocina: '🍳', delivery: '🍕', sala: '🍽️', general: '💬',
  anuncios: '📢', recetas: '📖', default: '#',
};

const SectionGroup = ({ label, icon, children, defaultOpen = true, isAdmin, onSettings }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary transition"
        >
          {open ? <FaChevronDown size={8} /> : <FaChevronRight size={8} />}
          <span>{icon} {label}</span>
        </button>
        {isAdmin && onSettings && (
          <button
            onClick={(e) => { e.stopPropagation(); onSettings(label); }}
            className="p-1 rounded text-light-text-tertiary dark:text-dark-text-tertiary hover:text-matrix-green transition opacity-0 group-hover:opacity-100 hover:opacity-100"
            title={`Permisos: ${label}`}
            style={{ opacity: 1 }}
          >
            <FaCog size={10} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChannelRow = ({ channel, isActive, onClick }) => {
  const icon = channel.channel_type === 'announcement' ? <FaBullhorn size={12} /> : <FaHashtag size={12} />;
  return (
    <button
      onClick={() => onClick(channel.slug)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition group ${isActive
        ? 'bg-matrix-green/15 text-matrix-green font-medium'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}
    >
      <span className="opacity-60 group-hover:opacity-100 transition">{icon}</span>
      <span className="truncate flex-1 text-left">{channel.name}</span>
      {channel.member_count > 0 && (
        <span className="text-[10px] opacity-40">{channel.member_count}</span>
      )}
    </button>
  );
};

const GroupRow = ({ group, isActive, onClick, onSettingsClick, canManage }) => (
  <div className="group relative flex items-center w-full">
    <button
      onClick={() => onClick(group.group_id)}
      className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition pr-8 ${isActive
        ? 'bg-purple-500/15 text-purple-400 font-medium'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50'
        }`}
    >
      <span className="text-xs">{group.icon || '👥'}</span>
      <span className="truncate flex-1 text-left">{group.name}</span>
      <span className="text-[10px] opacity-40">{group.member_count || 0}</span>
    </button>
    {canManage && (
      <button
        onClick={(e) => { e.stopPropagation(); onSettingsClick?.(group); }}
        className={`absolute right-2 p-1.5 rounded-md text-light-text-tertiary hover:text-purple-400 transition opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}
        title="Configurar Grupo"
      >
        <FaCog size={12} />
      </button>
    )}
  </div>
);

const ServerSidebar = ({
  channels = [],
  groups = [],
  activeSlug,
  activeGroupId,
  onSelectChannel,
  onSelectGroup,
  onCreateChannel,
  onCreateGroup,
  onOpenDm,
  onToggleMembers,
  onOpenSectionPerms,
  onOpenGroupSettings,
  isAdmin = false,
  onlineCount = 0,
  showMembersPanel = false,
  walletAddress = '',
}) => {
  const { sectionMap, sortedSections } = useServerSidebar({ channels });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-light-border/40 dark:border-dark-border/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          🍝 Piccola Community
        </h3>
        {isAdmin && (
          <button
            onClick={() => onOpenSectionPerms?.()}
            className="p-1.5 rounded-md text-light-text-tertiary hover:text-matrix-green hover:bg-matrix-green/10 transition"
            title="Permisos de secciones"
          >
            <FaCog size={13} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-2 space-y-1">
        {/* Channels by section */}
        {sortedSections.map(sec => (
          <SectionGroup
            key={sec}
            label={sec.charAt(0).toUpperCase() + sec.slice(1)}
            icon={SECTION_ICONS[sec] || SECTION_ICONS.default}
            isAdmin={isAdmin}
            onSettings={onOpenSectionPerms}
          >
            {sectionMap[sec].map(ch => (
              <ChannelRow
                key={ch.slug}
                channel={ch}
                isActive={activeSlug === ch.slug}
                onClick={onSelectChannel}
              />
            ))}
          </SectionGroup>
        ))}

        {/* Create channel (admin) */}
        {isAdmin && (
          <button
            onClick={onCreateChannel}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-light-text-tertiary dark:text-dark-text-tertiary hover:text-matrix-green transition rounded-md"
          >
            <FaPlus size={10} /> Crear Canal
          </button>
        )}

        {/* Groups section */}
        {(groups.length > 0 || true) && (
          <SectionGroup label="Grupos" icon="👥" defaultOpen={true}>
            {groups.map(g => {
              const safeWallet = walletAddress ? walletAddress.toLowerCase() : '';
              const isOwner = g.owner_wallet?.toLowerCase() === safeWallet;
              const isMod = (g.members || []).some(m => m.wallet?.toLowerCase() === safeWallet && m.role === 'mod');
              const canManage = isAdmin || isOwner || isMod;

              return (
                <GroupRow
                  key={g.group_id}
                  group={g}
                  isActive={activeGroupId === g.group_id}
                  onClick={onSelectGroup}
                  onSettingsClick={onOpenGroupSettings}
                  canManage={canManage}
                />
              );
            })}
            <button
              onClick={onCreateGroup}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-light-text-tertiary dark:text-dark-text-tertiary hover:text-purple-400 transition rounded-md"
            >
              <FaPlus size={10} /> Crear Grupo
            </button>
          </SectionGroup>
        )}
      </div>

      {/* Bottom bar: DM + Members toggle */}
      <div className="shrink-0 px-3 py-2 border-t border-light-border/30 dark:border-dark-border/30 space-y-1.5">
        {/* Members toggle */}
        <button
          onClick={onToggleMembers}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${showMembersPanel
            ? 'bg-matrix-green/15 text-matrix-green'
            : 'bg-light-surface-tertiary/30 dark:bg-dark-surface-tertiary/30 hover:bg-matrix-green/10 hover:text-matrix-green text-light-text-secondary dark:text-dark-text-secondary'
            }`}
        >
          <FaUsers size={12} />
          <span className="flex-1 text-left">Miembros</span>
          {onlineCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]">
              <FaCircle size={6} className="text-green-400" />
              {onlineCount}
            </span>
          )}
        </button>

        {/* DM */}
        <button
          onClick={onOpenDm}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-light-surface-tertiary/30 dark:bg-dark-surface-tertiary/30 hover:bg-purple-500/10 hover:text-purple-400 text-light-text-secondary dark:text-dark-text-secondary transition"
        >
          <FaEnvelope size={12} /> Mensaje Directo
        </button>
      </div>
    </div>
  );
};

export default ServerSidebar;
