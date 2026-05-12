// src/pages/marketing/templates/TemplateList.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaPaperPlane, FaEnvelope } from 'react-icons/fa';

const TYPE_COLORS = {
  transactional: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  automation: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  campaign: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const TYPE_LABELS = {
  transactional: 'Transaccional',
  automation: 'Automatización',
  campaign: 'Campaña',
};

const TemplateList = ({ templates, loading, onCreate, onEdit, onDelete, onSendTest }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <FaEnvelope className="text-matrix-green" />
          Email Templates ({templates.length})
        </h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-matrix-green/20 hover:bg-matrix-green/30 text-matrix-green rounded-xl font-medium transition-colors text-sm border border-matrix-green/20"
        >
          <FaPlus size={12} />
          Nuevo Template
        </button>
      </div>

      {/* Grid */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-light-text-secondary dark:text-dark-text-secondary">
          <FaEnvelope size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No hay templates aún</p>
          <button onClick={onCreate} className="mt-3 text-matrix-green text-sm hover:underline">
            Crear tu primer template →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl, i) => (
            <motion.div
              key={tpl._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 hover:border-matrix-green/30 transition-all group"
            >
              {/* Type badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${TYPE_COLORS[tpl.type] || TYPE_COLORS.campaign}`}>
                  {TYPE_LABELS[tpl.type] || tpl.type}
                </span>
                <span className={`w-2 h-2 rounded-full ${tpl.active !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>

              {/* Name & subject */}
              <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm mb-1 truncate">
                {tpl.name}
              </h3>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mb-3">
                {tpl.subject}
              </p>

              {/* Description */}
              {tpl.description && (
                <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mb-3 line-clamp-2">
                  {tpl.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-light-border/5 dark:border-dark-border/5">
                <button
                  onClick={() => onEdit(tpl)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-lg transition-colors"
                >
                  <FaEdit size={10} />
                  Editar
                </button>
                <button
                  onClick={() => onSendTest(tpl._id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                >
                  <FaPaperPlane size={10} />
                  Test
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${tpl.name}"?`)) onDelete(tpl._id);
                  }}
                  className="ml-auto p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateList;
