import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, UserX, Search, Wallet, Filter, Mail, Briefcase, Layers, MapPin } from 'lucide-react';
import useEmpresaAdmin from '../../../../hooks/useEmpresaAdmin.jsx';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getColorClass = (name) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const EmpresaWorkersAuditTab = ({ appState, t }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { fetchAuditWorkers } = useEmpresaAdmin(appState, t);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'user_no_wallet', 'no_user', 'complete'
  const [search, setSearch] = useState('');
  const [cargoFilter, setCargoFilter] = useState('');
  const [seccionFilter, setSeccionFilter] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');

  const uniqueCargos = useMemo(() => {
    const set = new Set(data.map(d => d.cargo).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const uniqueSecciones = useMemo(() => {
    const set = new Set(data.map(d => d.seccion).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const uniqueSucursales = useMemo(() => {
    const set = new Set(data.map(d => d.sucursal).filter(s => s && s !== '—'));
    return Array.from(set).sort();
  }, [data]);

  useEffect(() => {
    let active = true;
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchAuditWorkers();
        if (active) {
          setData(json.audit || []);
        }
      } catch (err) {
        if (active) setError(err.message || 'Error loading audit');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAudit();
    return () => { active = false; };
  }, [appState]);

  const filteredData = useMemo(() => {
    return data.filter(w => {
      if (activeFilter !== 'all' && w.status !== activeFilter) return false;
      if (cargoFilter && w.cargo !== cargoFilter) return false;
      if (seccionFilter && w.seccion !== seccionFilter) return false;
      if (sucursalFilter && w.sucursal !== sucursalFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          w.name?.toLowerCase().includes(query) ||
          w.rut?.toLowerCase().includes(query) ||
          w.email?.toLowerCase().includes(query) ||
          w.cargo?.toLowerCase().includes(query) ||
          w.seccion?.toLowerCase().includes(query) ||
          w.sucursal?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data, activeFilter, search]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<ShieldAlert className="w-5 h-5 text-amber-500" />}
          label="Usuario sin Wallet"
          value={data.filter(x => x.status === 'user_no_wallet').length}
          onClick={() => setActiveFilter(activeFilter === 'user_no_wallet' ? 'all' : 'user_no_wallet')}
          active={activeFilter === 'user_no_wallet'}
          bgClass="bg-amber-500/10 border-amber-500/20"
        />
        <StatCard
          icon={<UserX className="w-5 h-5 text-red-500" />}
          label="Falta Usuario"
          value={data.filter(x => x.status === 'no_user').length}
          onClick={() => setActiveFilter(activeFilter === 'no_user' ? 'all' : 'no_user')}
          active={activeFilter === 'no_user'}
          bgClass="bg-red-500/10 border-red-500/20"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          label="Completos"
          value={data.filter(x => x.status === 'complete').length}
          onClick={() => setActiveFilter(activeFilter === 'complete' ? 'all' : 'complete')}
          active={activeFilter === 'complete'}
          bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
        <StatCard
          icon={<Wallet className="w-5 h-5 text-blue-500" />}
          label="Total Empleados"
          value={data.length}
          onClick={() => setActiveFilter('all')}
          active={activeFilter === 'all'}
          bgClass="bg-blue-500/10 border-blue-500/20"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-light-surface/40 dark:bg-dark-surface/40 p-3 flex-wrap rounded-2xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm hover:shadow transition-shadow">
        <div className="relative max-w-xs w-full shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none backdrop-blur-md transition-all text-sm"
            placeholder="Buscar por RUT, Correo, Nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="relative flex items-center min-w-[160px]">
             <Briefcase className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
             <select
               value={cargoFilter}
               onChange={(e) => setCargoFilter(e.target.value)}
               className="w-full pl-9 pr-8 py-2 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500 focus:outline-none"
             >
               <option value="">Todos los Cargos</option>
               {uniqueCargos.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          
          <div className="relative flex items-center min-w-[160px]">
             <Layers className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
             <select
               value={seccionFilter}
               onChange={(e) => setSeccionFilter(e.target.value)}
               className="w-full pl-9 pr-8 py-2 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500 focus:outline-none"
             >
               <option value="">Todas las Secciones</option>
               {uniqueSecciones.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
          
          <div className="relative flex items-center min-w-[150px]">
             <MapPin className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
             <select
               value={sucursalFilter}
               onChange={(e) => setSucursalFilter(e.target.value)}
               className="w-full pl-9 pr-8 py-2 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500 focus:outline-none"
             >
               <option value="">Todas las Sucursales</option>
               {uniqueSucursales.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-light-surface/40 dark:bg-dark-surface/40 overflow-hidden shadow-sm backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Empleado</th>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Cargo / Sucursal</th>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Status Wallet</th>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Wallet Asignada</th>
              </tr>
            </thead>
            <motion.tbody
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-gray-200 dark:divide-gray-800"
            >
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        Auditando personal...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                      No se encontraron empleados coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, i) => (
                    <motion.tr
                      key={row.rut}
                      variants={rowVariants}
                      layout
                      className="hover:bg-white/50 dark:hover:bg-dark-surface/80 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {row.profile_image_url ? (
                            <img src={row.profile_image_url} alt={row.name} className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-sm border border-gray-200 dark:border-gray-800" />
                          ) : (
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm font-bold tracking-wider text-sm ${getColorClass(row.name)}`}>
                              {getInitials(row.name)}
                            </div>
                          )}
                          <div className="flex flex-col max-w-[200px]">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 truncate">
                              {row.name}
                            </span>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-xs text-gray-500 font-mono tracking-tight">{row.rut}</span>
                              {row.email && (
                                <span className="text-[11px] text-primary-600 dark:text-primary-400 flex items-center gap-1 truncate w-full" title={row.email}>
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{row.email}</span>
                                </span>
                              )}
                            </div>
                            {!row.is_active_employee && (
                              <span className="mt-1 w-max text-[9px] uppercase font-bold tracking-widest text-red-100 bg-red-600 px-1.5 py-0.5 rounded shadow-sm border border-red-700">
                                BAJA LABORAL
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 truncate w-max max-w-full">
                            {row.cargo || 'Sin Cargo'}
                          </span>
                          {row.seccion && (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest truncate w-max max-w-full">
                              {row.seccion}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 truncate w-max">{row.sucursal || 'Sin Sucursal'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'complete' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </span>
                        )}
                        {row.status === 'user_no_wallet' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" /> Faltan Wallet
                          </span>
                        )}
                        {row.status === 'no_user' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            <UserX className="w-3.5 h-3.5" /> Sin Registro
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.wallet ? (
                          <div className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 inline-block overflow-hidden text-ellipsis max-w-xs">
                            {row.wallet}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No asignada</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </motion.tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Subcomponente estilado
const StatCard = ({ icon, label, value, active, onClick, bgClass }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-between p-4 rounded-2xl border text-left transition-all backdrop-blur-md overflow-hidden ${
      active
        ? `border-primary-500 ring-1 ring-primary-500/50 scale-[1.02] ${bgClass}`
        : 'border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-dark-surface/40 hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
    }`}
  >
    <div className="flex flex-col gap-1 z-10">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
    <div className="p-3 rounded-xl bg-white/50 dark:bg-black/20 z-10">
      {icon}
    </div>
    {active && (
       <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10 dark:to-white/5 pointer-events-none" />
    )}
  </button>
);

export default EmpresaWorkersAuditTab;
