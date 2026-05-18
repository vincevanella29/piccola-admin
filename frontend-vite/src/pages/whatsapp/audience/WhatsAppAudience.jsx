// src/pages/whatsapp/audience/WhatsAppAudience.jsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Phone, User, Mail, Tag, Database } from 'lucide-react';
import { toast } from 'react-toastify';
import useMarketingAudience from '../../../hooks/marketing/useMarketingAudience.jsx';

const WhatsAppAudience = ({ appState }) => {
  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;
  const account = appState?.account || appState?.wallet || appState?.useAuth?.account;
  const crm = useMarketingAudience({ token, account });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', email: '', segment: 'lead' });

  useEffect(() => { 
    if (token) crm.fetchAudience(); 
  }, [token, crm.fetchAudience]);

  const handleAdd = async () => {
    if (!form.phone.trim()) { toast.error('Teléfono requerido'); return; }
    try {
      await crm.addLead(form);
      toast.success('✅ Contacto agregado a la base maestra');
      setForm({ phone: '', name: '', email: '', segment: 'lead' });
      setShowAdd(false);
    } catch (e) {
      toast.error('Error agregando contacto');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audiencia Unificada (CRM)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {crm.whatsappEligible.length} contactos disponibles con número de teléfono (Delivery + Equipo + Leads).
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(!showAdd)} className="px-5 py-2.5 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-green-500/20">
          <Plus size={16} /> Importar Lead Manual
        </motion.button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-white/70 dark:bg-[#1c1c1e]/70 border border-gray-200/50 dark:border-white/5 shadow-sm space-y-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-medium flex items-center gap-2 mb-2">
            <Database size={14} /> Los leads agregados manualmente se guardarán en la base central de Customers.
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Phone size={12} /> Teléfono *</label>
              <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="56994694038" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><User size={12} /> Nombre</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Juan Pérez" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Mail size={12} /> Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@email.com" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Tag size={12} /> Segmento</label>
              <select value={form.segment} onChange={e => setForm(p => ({ ...p, segment: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 appearance-none">
                <option value="lead">Lead MKT</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">Cancelar</button>
            <button onClick={handleAdd} disabled={crm.isLoading} className="px-5 py-2 rounded-xl bg-green-500 text-white font-bold text-sm disabled:opacity-50">
              {crm.isLoading ? 'Guardando...' : 'Guardar Lead'}
            </button>
          </div>
        </motion.div>
      )}

      {/* List */}
      {crm.isLoading && crm.audience.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : crm.whatsappEligible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold">Sin contactos con teléfono</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {crm.whatsappEligible.map((m, i) => (
            <motion.div key={m.id || i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/70 dark:bg-[#1c1c1e]/70 border border-gray-200/30 dark:border-white/5 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${m.segment === 'employee' ? 'bg-purple-500/10' : 'bg-green-500/10'}`}>
                  {m.segment === 'employee' ? <User size={16} className="text-purple-500" /> : <Phone size={16} className="text-green-500" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {m.name} {m.segment === 'employee' && <span className="text-[10px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-md uppercase">Team</span>}
                  </p>
                  <p className="text-xs text-gray-500">{m.phone}{m.email ? ` · ${m.email}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                  {m.provider_slug}
                </span>
                {m.role && <span className="text-[10px] text-gray-400">{m.role}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WhatsAppAudience;
