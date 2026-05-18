import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMedal, FaStar, FaBuilding, FaBriefcase, FaIdBadge, FaEnvelope, FaUserCheck, FaUserTimes, FaAt } from 'react-icons/fa';
import useMemberProfile from '../../../../hooks/chat/useMemberProfile';

// Truncate wallet for display: 0x1234...abcd
const shortWallet = (w) => {
  if (!w) return '';
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
};

const MemberProfileModal = ({ open, member, onClose, onDm, appState }) => {
  const { loading, error, data, employee, totals, meritPoints, level } = useMemberProfile({ open, member, appState });

  if (!open) return null;

  // Resolve display name with wallet fallback
  const fullName = [employee.nombre || employee.name, employee.apellido].filter(Boolean).join(' ').trim();
  const displayName = fullName || member.name || shortWallet(member.wallet) || 'Usuario';
  const avatarLetter = (displayName || '?')[0]?.toUpperCase() || '?';
  const isWalletOnly = !fullName && !member.name && !!member.wallet;
  const hasUser = employee.has_user || member.has_user;
  const contactEmail = employee.email || member.email;

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-light-border/50 dark:border-dark-border/50 rounded-[32px] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
      >
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-purple-500 to-blue-500 relative shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-6 flex justify-between items-end -mt-12 relative z-10 shrink-0">
          <div className="w-20 h-20 rounded-full border-4 border-light-surface dark:border-dark-surface bg-light-surface-tertiary dark:bg-dark-surface-tertiary overflow-hidden flex items-center justify-center text-2xl font-bold shadow-lg">
            {(employee.profile_image_url || member.profile_image_url) ? (
              <img src={employee.profile_image_url || member.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              avatarLetter
            )}
          </div>
          
          <div className="mb-2">
            <div className="flex flex-col items-center justify-center bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border rounded-xl px-3.5 py-1.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Nivel</span>
              <span className="text-lg font-bold text-purple-500">{level}</span>
            </div>
          </div>
        </div>

        {/* Info — scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-6 pt-3">
            {/* Name */}
            <h2 className="text-lg font-bold truncate">{displayName}</h2>
            {isWalletOnly && (
              <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono truncate mt-0.5">
                {member.wallet}
              </p>
            )}
            {member.cargo && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary opacity-80 mt-0.5">{member.cargo}</p>}

            <div className="mt-1 flex items-center gap-2">
              {hasUser ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                  <FaUserCheck size={9} /> Registrado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-500/10 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  <FaUserTimes size={9} /> Sin Usuario
                </span>
              )}
            </div>
            
            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              {member.wallet && onDm && (
                <button
                  onClick={() => { onDm(member); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition text-sm font-semibold"
                >
                  <FaEnvelope size={13} />
                  Mensaje
                </button>
              )}
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/15 text-green-500 border border-green-500/25 hover:bg-green-500/25 transition text-sm font-semibold"
                >
                  <FaAt size={13} />
                  Correo
                </a>
              )}
            </div>
            
            {/* Info cards */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/30 dark:border-dark-border/30">
                <FaBriefcase className="text-blue-400 shrink-0" size={13} />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase opacity-60">Cargo</p>
                  <p className="text-xs font-bold truncate">{employee.cargo || member.cargo || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/30 dark:border-dark-border/30">
                <FaBuilding className="text-orange-400 shrink-0" size={13} />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase opacity-60">Local</p>
                  <p className="text-xs font-bold truncate">{employee.local || employee.sucursal || member.sucursal || '—'}</p>
                </div>
              </div>
            </div>

            {/* Merits section */}
            <div className="mt-5 border-t border-light-border/30 dark:border-dark-border/30 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <FaMedal className="text-yellow-500" />
                Méritos
              </h3>

              {loading ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-light-border/50 dark:bg-dark-border/50 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-light-border/50 dark:bg-dark-border/50 rounded"></div>
                      <div className="h-4 bg-light-border/50 dark:bg-dark-border/50 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              ) : error ? (
                <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>
              ) : (
                <div className="space-y-3">
                  {/* Points card */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/20 text-purple-500">
                        <FaStar size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Puntos de Mérito</p>
                        <p className="text-xl font-bold text-purple-500">{meritPoints}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Activity — capped at 5 items */}
                  {data?.history && data.history.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase opacity-60 mb-2 font-bold pl-1">Actividad Reciente</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {data.history[0].items.slice(0, 8).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40 transition border border-transparent hover:border-light-border/30 dark:hover:border-dark-border/30">
                            <FaIdBadge className="text-light-text-tertiary mt-0.5 shrink-0" size={12} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{item.name || 'Logro'}</p>
                              <p className="text-[10px] opacity-60 text-purple-400 font-bold">+{item.merit_points} pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MemberProfileModal;
