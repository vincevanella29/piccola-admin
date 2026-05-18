import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSave, FaUserShield, FaCrown, FaUserSlash, FaUserMinus, FaChevronDown } from 'react-icons/fa';
import useGroupModal from '../../../../hooks/chat/useGroupModal';

// --- Acordeón Animado ---
const Accordion = ({ title, count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-light-border/40 dark:border-dark-border/40 rounded-xl overflow-hidden bg-light-surface-secondary/10 dark:bg-dark-surface-secondary/10">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-light-surface-tertiary/20 dark:hover:bg-dark-surface-tertiary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</span>
          {count > 0 && (
            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              {count} sel.
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} className="text-light-text-tertiary">
          <FaChevronDown size={12} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-light-border/20 dark:border-dark-border/20 mt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const GroupModal = ({ open, onClose, group, token, walletAddress, isAdmin, onUpdated, appState }) => {
  const {
    isEditMode, activeTab, setActiveTab, loading, error,
    name, setName, icon, setIcon, isSectionBased, setIsSectionBased,
    allowedSecciones, allowedCargos, secciones, cargos,
    members, isOwner, myRole, isMod, canManageRoles, canKick,
    handleSaveGeneral, handleRoleChange, handleKick,
    toggleSeccion, toggleCargo
  } = useGroupModal({ open, group, token, walletAddress, isAdmin, onUpdated, onClose, appState });

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-light-border/50 dark:border-dark-border/50 rounded-[32px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* Header */}
        <div className="shrink-0 p-6 border-b border-light-border/30 dark:border-dark-border/30 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl drop-shadow-md">{icon || '👥'}</span>
              {isEditMode ? 'Ajustes del Grupo' : 'Crear Nuevo Grupo'}
            </h2>
            {isEditMode && (
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 opacity-80">
                {group.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition">
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        {isEditMode && (
          <div className="shrink-0 flex items-center px-4 pt-2 border-b border-light-border/40 dark:border-dark-border/40 gap-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-purple-500 text-purple-400' : 'border-transparent text-light-text-secondary hover:text-light-text-primary'}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'members' ? 'border-purple-500 text-purple-400' : 'border-transparent text-light-text-secondary hover:text-light-text-primary'}`}
            >
              Miembros
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm border border-red-500/30">
              {error}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Sala de reuniones..."
                  className="w-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                  Ícono (Emoji)
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  placeholder="Ej: 🍕"
                  maxLength={5}
                  className="w-full bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 border border-light-border/50 dark:border-dark-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors backdrop-blur-md"
                />
              </div>

              {/* Secciones y Cargos */}
              <div className="p-5 rounded-2xl border border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold">Auto-Unir Trabajadores</label>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      Invita automáticamente a los trabajadores que coincidan con la configuración.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isSectionBased}
                      onChange={e => setIsSectionBased(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-light-border dark:bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500 shadow-inner"></div>
                  </label>
                </div>

                {isSectionBased && (
                  <div className="space-y-3 pt-2">
                    <Accordion title="Secciones Completas" count={allowedSecciones.length} defaultOpen={allowedSecciones.length > 0}>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {secciones.map(sec => {
                          const active = allowedSecciones.includes(sec);
                          return (
                            <button
                              key={sec}
                              onClick={() => toggleSeccion(sec)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${active ? 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-light-surface dark:bg-dark-surface border-light-border/60 dark:border-dark-border/60 text-light-text-secondary hover:text-light-text-primary'}`}
                            >
                              {sec.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </Accordion>

                    <Accordion title="Cargos Específicos" count={allowedCargos.length} defaultOpen={allowedCargos.length > 0}>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {cargos.map(car => {
                          const active = allowedCargos.includes(car);
                          return (
                            <button
                              key={car}
                              onClick={() => toggleCargo(car)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${active ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-light-surface dark:bg-dark-surface border-light-border/60 dark:border-dark-border/60 text-light-text-secondary hover:text-light-text-primary'}`}
                            >
                              {car.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </Accordion>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSaveGeneral}
                  disabled={loading || !name.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaSave /> {isEditMode ? 'Guardar Cambios' : 'Crear Grupo'}
                </button>
              </div>
            </div>
          )}

          {isEditMode && activeTab === 'members' && (
            <div className="space-y-2">
              {members.map(member => {
                const isTargetOwner = member.role === 'owner';
                const isTargetMod = member.role === 'mod';
                const isMe = member.wallet?.toLowerCase() === walletAddress?.toLowerCase();
                
                const canChangeThisRole = canManageRoles && !isTargetOwner;
                
                const canKickThis = !isMe && !isTargetOwner && (
                  (isAdmin || isOwner) ||
                  (isMod && !isTargetMod)
                );

                return (
                  <div key={member.wallet} className="flex items-center gap-3 p-3 rounded-xl bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40 border border-light-border/30 dark:border-dark-border/30 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition">
                    <div className="w-10 h-10 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border/50 dark:border-dark-border/50 overflow-hidden flex items-center justify-center font-bold text-sm">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (member.display_name || '?')[0].toUpperCase()
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm truncate">{member.display_name || 'Usuario'}</h4>
                        {isTargetOwner && <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-bold"><FaCrown /> Dueño</span>}
                        {isTargetMod && <span className="flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold"><FaUserShield /> Mod</span>}
                      </div>
                      <p className="text-[11px] text-light-text-tertiary truncate">
                        {member.cargo ? `${member.cargo} · ` : ''}{member.seccion || 'Sin sección'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {canChangeThisRole && (
                        <button
                          disabled={loading}
                          onClick={() => handleRoleChange(member.wallet, isTargetMod ? 'member' : 'mod')}
                          className={`p-2 rounded-lg text-xs transition ${isTargetMod ? 'text-red-400 hover:bg-red-500/20' : 'text-purple-400 hover:bg-purple-500/20'}`}
                          title={isTargetMod ? 'Quitar moderador' : 'Hacer moderador'}
                        >
                          {isTargetMod ? <FaUserSlash size={14} /> : <FaUserShield size={14} />}
                        </button>
                      )}
                      {canKickThis && (
                        <button
                          disabled={loading}
                          onClick={() => {
                            if(window.confirm(`¿Seguro que quieres expulsar a ${member.display_name}?`)) {
                              handleKick(member.wallet);
                            }
                          }}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
                          title="Expulsar"
                        >
                          <FaUserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {members.length === 0 && (
                <p className="text-center text-light-text-tertiary text-sm py-4">No hay miembros para mostrar.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GroupModal;
