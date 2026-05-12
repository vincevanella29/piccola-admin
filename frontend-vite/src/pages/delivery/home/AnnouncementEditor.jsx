// src/pages/delivery/home/AnnouncementEditor.jsx
// Editor for the announcement bar
import React from 'react';
import { FaToggleOn, FaToggleOff, FaBullhorn } from 'react-icons/fa';

const inputCls = "w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all";

const AnnouncementEditor = ({ announcement = {}, onUpdate }) => (
  <div className="space-y-3">
    <h2 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-1.5">
      <FaBullhorn size={11} className="text-matrix-green" /> Barra de Anuncio
    </h2>
    <div className="p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 space-y-3">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => onUpdate({ ...announcement, active: !announcement.active })}
          className={`p-1.5 rounded-xl transition-colors ${announcement.active ? 'bg-green-500/10 text-green-500' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary'}`}
        >
          {announcement.active ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
        </button>
        <span className="text-xs text-light-text-primary dark:text-dark-text-primary font-medium">
          {announcement.active ? 'Activo' : 'Desactivado'}
        </span>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-1">Texto</label>
        <input
          value={announcement.text || ''}
          onChange={(e) => onUpdate({ ...announcement, text: e.target.value })}
          placeholder="🔥 Envío gratis sobre $15.000"
          className={inputCls}
        />
      </div>
      {announcement.active && announcement.text && (
        <div className="p-2 rounded-xl bg-gradient-to-r from-[#DE141D] to-[#B91016]">
          <p className="text-[10px] font-bold text-center text-white">
            {announcement.text}
          </p>
        </div>
      )}
    </div>
  </div>
);

export default AnnouncementEditor;
