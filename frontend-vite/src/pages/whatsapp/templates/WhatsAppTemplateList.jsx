// src/pages/whatsapp/templates/WhatsAppTemplateList.jsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';

const statusColors = {
  APPROVED: 'bg-green-500/10 text-green-500',
  PENDING: 'bg-yellow-500/10 text-yellow-500',
  REJECTED: 'bg-red-500/10 text-red-500',
};
const statusIcons = {
  APPROVED: CheckCircle2,
  PENDING: Clock,
  REJECTED: XCircle,
};

const WhatsAppTemplateList = ({ wa, appState, onCreateNew }) => {
  const [expanded, setExpanded] = useState(null);

  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;

  useEffect(() => { 
    if (token) wa.fetchTemplates(); 
  }, [token, wa.fetchTemplates]);

  const handleDelete = async (name) => {
    if (!window.confirm(`¿Eliminar template "${name}"?`)) return;
    try {
      await wa.deleteTemplate(name);
      toast.success(`Template "${name}" eliminado`);
    } catch (e) {
      toast.error('Error eliminando template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Templates</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Templates de mensajes aprobados por Meta para iniciar conversaciones.</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onCreateNew} className="px-5 py-2.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-green-500/20">
          <Plus size={16} /> Crear Template
        </motion.button>
      </div>

      {wa.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : wa.templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold">No hay templates</p>
          <p className="text-sm">Crea tu primer template para comenzar a enviar mensajes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wa.templates.map((t, i) => {
            const StatusIcon = statusIcons[t.status] || Clock;
            const isExpanded = expanded === t.name;
            return (
              <motion.div key={t.name || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl bg-white/70 dark:bg-[#1c1c1e]/70 border border-gray-200/50 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all" onClick={() => setExpanded(isExpanded ? null : t.name)}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-green-500/10">
                      <FileText size={18} className="text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.category} · {t.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColors[t.status] || 'bg-gray-100 text-gray-500'}`}>
                      <StatusIcon size={12} /> {t.status}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.name); }} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-white/5 pt-3">
                        {(t.components || []).map((c, j) => (
                          <div key={j} className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="text-[10px] font-bold uppercase text-gray-400 mr-2">{c.type}:</span>
                            {c.text || c.format || JSON.stringify(c, null, 2)}
                          </div>
                        ))}
                        {(!t.components || t.components.length === 0) && <p className="text-xs text-gray-400 italic">Sin componentes detallados</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppTemplateList;
