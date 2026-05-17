import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, Shield, User, Smartphone, RefreshCw, ShoppingBag, Globe, Trash2 } from 'lucide-react';

const StatCard = ({ title, value, icon, colorClass, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="relative overflow-hidden bg-light-surface/50 dark:bg-dark-surface/50 rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-5 group"
  >
    <div className={`absolute -inset-1 bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-xl`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-xs font-semibold text-light-text-secondary dark:text-gray-400 mb-1 uppercase tracking-wider">
          {title}
        </p>
        <h3 className="text-2xl font-black text-light-text-primary dark:text-white tracking-tight">
          {value}
        </h3>
      </div>
      <div className={`p-3 rounded-xl bg-black/5 dark:bg-white/5`}>
        {icon}
      </div>
    </div>
  </motion.div>
);

const NotificationAudience = ({ appState, audience = [], fetchAudience, deleteAudienceMember, isLoading }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (audience.length === 0 && fetchAudience) fetchAudience();
  }, []);

  const totalUsers = audience.length;
  const employees = audience.filter(a => a.segment === 'employee').length;
  const web3Users = audience.filter(a => a.segment === 'web3_user').length;
  const customers = audience.filter(a => a.segment.startsWith('customer')).length;

  const getSegmentBadge = (segment) => {
    if (segment === 'employee') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-md bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center gap-1 w-max"><Shield size={10} /> Empleado</span>;
    if (segment === 'web3_user') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-md bg-vanellix-cyan/10 text-vanellix-cyan border border-vanellix-cyan/20 flex items-center gap-1 w-max"><Globe size={10} /> Web3 User</span>;
    if (segment.startsWith('customer')) return <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-md bg-matrix-green/10 text-matrix-green border border-matrix-green/20 flex items-center gap-1 w-max"><ShoppingBag size={10} /> {segment.split('_')[1] || 'Customer'}</span>;
    return <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-md bg-gray-500/10 text-gray-500 border border-gray-500/20 flex items-center gap-1 w-max"><User size={10} /> Anónimo</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-light-text-primary dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-vanellix-cyan" size={24} /> Audience CRM
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-gray-400 mt-1">
            Gestión unificada de clientes y empleados suscritos a Notificaciones Push.
          </p>
        </div>
        <button
          onClick={fetchAudience}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-bold rounded-full bg-light-surface/50 dark:bg-dark-surface/50 border border-light-border/20 dark:border-dark-border/20 hover:border-vanellix-cyan transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin text-vanellix-cyan" : "text-vanellix-cyan"} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalUsers} icon={<Smartphone size={20} className="text-vanellix-cyan" />} colorClass="from-vanellix-cyan/20 to-blue-500/20" delay={0.1} />
        <StatCard title="Clientes (Satélites)" value={customers} icon={<ShoppingBag size={20} className="text-matrix-green" />} colorClass="from-matrix-green/20 to-emerald-500/20" delay={0.2} />
        <StatCard title="Web3 Users" value={web3Users} icon={<Globe size={20} className="text-blue-400" />} colorClass="from-blue-400/20 to-indigo-500/20" delay={0.3} />
        <StatCard title="Empleados" value={employees} icon={<Shield size={20} className="text-purple-500" />} colorClass="from-purple-500/20 to-fuchsia-500/20" delay={0.4} />
      </div>

      <div className="bg-light-surface/50 dark:bg-dark-surface/50 rounded-2xl border border-light-border/20 dark:border-dark-border/20 overflow-hidden shadow-neon">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-gray-400 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Identidad</th>
                <th className="px-6 py-4">Segmento / Rol</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Fidelidad</th>
                <th className="px-6 py-4">Dispositivo</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border/10 dark:divide-dark-border/10">
              {audience.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No hay audiencia registrada todavía.
                  </td>
                </tr>
              ) : (
                audience.map((member, idx) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    key={member.token}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center text-white font-bold text-xs shadow-inner">
                          {member.name ? member.name.charAt(0).toUpperCase() : (member.wallet ? member.wallet.substring(2, 4) : '?')}
                        </div>
                        <div>
                          <p className="font-bold text-light-text-primary dark:text-white">
                            {member.name || member.wallet || 'Anonymous'}
                          </p>
                          {member.wallet && <p className="text-[10px] font-mono text-gray-500">{member.wallet.substring(0, 6)}...{member.wallet.substring(38)}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {getSegmentBadge(member.segment)}
                        {member.role && <span className="text-[10px] text-gray-500 capitalize">{member.role}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-light-text-secondary dark:text-gray-300">
                        {member.email && <div>✉️ {member.email}</div>}
                        {member.phone && <div>📞 {member.phone}</div>}
                        {!member.email && !member.phone && <span className="text-gray-500 opacity-50">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.segment.startsWith('customer') ? (
                        <div className="text-xs">
                          <p className="font-semibold text-light-text-primary dark:text-white">{member.order_count} Órdenes</p>
                          <p className="text-gray-500">${member.total_spent?.toLocaleString()}</p>
                        </div>
                      ) : <span className="text-gray-500 opacity-50">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Smartphone size={12} />
                        {member.device_type} • {member.source}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(appState?.user?.level >= 3) && (
                        <button 
                          onClick={() => {
                            if (window.confirm('¿Eliminar token de este usuario? Perderá acceso a notificaciones.')) {
                              deleteAudienceMember(member.token);
                            }
                          }}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Eliminar Token"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationAudience;
