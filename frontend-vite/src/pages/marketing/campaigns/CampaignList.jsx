// src/pages/marketing/campaigns/CampaignList.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaPaperPlane, FaBan, FaTrash, FaChartBar, FaBullhorn } from 'react-icons/fa';

const STATUS_STYLES = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sending: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
  sent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABELS = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando...',
  sent: 'Enviada',
  cancelled: 'Cancelada',
};

const CampaignList = ({ campaigns, loading, onCreate, onEdit, onSend, onCancel, onDelete, onStats }) => {
  const [statsModal, setStatsModal] = useState(null);

  const handleStats = async (id) => {
    const result = await onStats(id);
    if (result) setStatsModal(result);
  };

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
          <FaBullhorn className="text-matrix-green" />
          Campañas ({campaigns.length})
        </h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-matrix-green/20 hover:bg-matrix-green/30 text-matrix-green rounded-xl font-medium transition-colors text-sm border border-matrix-green/20"
        >
          <FaPlus size={12} />
          Nueva Campaña
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-light-text-secondary dark:text-dark-text-secondary">
          <FaBullhorn size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No hay campañas aún</p>
          <button onClick={onCreate} className="mt-3 text-matrix-green text-sm hover:underline">
            Crear tu primera campaña →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp, i) => (
            <motion.div
              key={camp._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 hover:border-matrix-green/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Status badge */}
                  <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border shrink-0 ${STATUS_STYLES[camp.status] || STATUS_STYLES.draft}`}>
                    {STATUS_LABELS[camp.status] || camp.status}
                  </span>

                  {/* Name */}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary truncate">
                      {camp.name}
                    </h3>
                    <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary">
                      {camp.created_at ? new Date(camp.created_at).toLocaleDateString('es-CL') : ''}
                      {camp.total > 0 && ` · ${camp.sent || 0}/${camp.total} enviados`}
                    </p>
                  </div>
                </div>

                {/* Stats bar */}
                {camp.total > 0 && (
                  <div className="hidden sm:flex items-center gap-3 px-4">
                    <div className="w-32 h-1.5 bg-dark-surface/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-matrix-green rounded-full transition-all"
                        style={{ width: `${Math.round(((camp.sent || 0) / camp.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary font-mono w-12 text-right">
                      {Math.round(((camp.sent || 0) / camp.total) * 100)}%
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {camp.status === 'draft' && (
                    <>
                      <button
                        onClick={() => onEdit(camp)}
                        className="px-2.5 py-1.5 text-[11px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Enviar campaña "${camp.name}"?`)) onSend(camp._id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-matrix-green/20 hover:bg-matrix-green/30 text-matrix-green rounded-lg transition-colors"
                      >
                        <FaPaperPlane size={9} />
                        Enviar
                      </button>
                    </>
                  )}

                  {camp.status === 'sending' && (
                    <>
                      <button
                        onClick={() => handleStats(camp._id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                      >
                        <FaChartBar size={9} />
                        Stats
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Cancelar campaña "${camp.name}"?`)) onCancel(camp._id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-red-500/10 text-red-400 rounded-lg transition-colors"
                      >
                        <FaBan size={9} />
                        Cancelar
                      </button>
                    </>
                  )}

                  {(camp.status === 'sent' || camp.status === 'cancelled') && (
                    <button
                      onClick={() => handleStats(camp._id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg transition-colors"
                    >
                      <FaChartBar size={9} />
                      Stats
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar campaña "${camp.name}"?`)) onDelete(camp._id);
                    }}
                    className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <FaTrash size={10} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats Modal */}
      {statsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setStatsModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-light-border/10 dark:border-dark-border/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
              📊 {statsModal.campaign?.name}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'En cola', value: statsModal.live_stats?.queued || 0, color: 'text-amber-400' },
                { label: 'Enviando', value: statsModal.live_stats?.sending || 0, color: 'text-blue-400' },
                { label: 'Enviados', value: statsModal.live_stats?.sent || 0, color: 'text-emerald-400' },
                { label: 'Fallidos', value: statsModal.live_stats?.failed || 0, color: 'text-red-400' },
              ].map((s) => (
                <div key={s.label} className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStatsModal(null)}
              className="w-full mt-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium text-sm transition-colors"
            >
              Cerrar
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CampaignList;
