import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, UserX, Search, Wallet, Filter, Mail, Briefcase, Layers, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
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

const SortBtn = ({ col, label, sortKey, sortDir, onSort, className = '' }) => (
  <button
    onClick={() => onSort(col)}
    className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${sortKey === col ? 'text-matrix-green' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
      } ${className}`}
  >
    {label}
    {sortKey === col
      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : null}
  </button>
);

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
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  };

  const getSafeString = (val) => (val != null ? String(val).trim() : '');

  const uniqueCargos = useMemo(() => {
    const set = new Set(data.map(d => getSafeString(d.cargo)).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const uniqueSecciones = useMemo(() => {
    const set = new Set(data.map(d => getSafeString(d.seccion)).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const uniqueSucursales = useMemo(() => {
    const set = new Set(data.map(d => getSafeString(d.sucursal)).filter(s => s && s !== '—'));
    return Array.from(set).sort();
  }, [data]);

  const fetchedTokenRef = React.useRef(null);

  useEffect(() => {
    let active = true;
    const fetchAudit = async () => {
      // Prevent refetching for the same token to guarantee reactivity locally
      if (fetchedTokenRef.current === appState?.token) return;

      setLoading(true);
      setError(null);
      try {
        const json = await fetchAuditWorkers();
        if (active) {
          setData(json.audit || []);
          fetchedTokenRef.current = appState?.token;
        }
      } catch (err) {
        if (active) setError(err.message || 'Error loading audit');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (appState?.token) {
      fetchAudit();
    }
    return () => { active = false; };
  }, [appState?.token]); // We do NOT include fetchAuditWorkers to prevent reference loops

  const filteredData = useMemo(() => {
    let filtered = data.filter(w => {
      if (activeFilter !== 'all' && w.status !== activeFilter) return false;
      if (cargoFilter && getSafeString(w.cargo) !== cargoFilter) return false;
      if (seccionFilter && getSafeString(w.seccion) !== seccionFilter) return false;
      if (sucursalFilter && getSafeString(w.sucursal) !== sucursalFilter) return false;

      if (search) {
        const query = search.toLowerCase();
        return (
          getSafeString(w.name).toLowerCase().includes(query) ||
          getSafeString(w.rut).toLowerCase().includes(query) ||
          getSafeString(w.email).toLowerCase().includes(query) ||
          getSafeString(w.cargo).toLowerCase().includes(query) ||
          getSafeString(w.seccion).toLowerCase().includes(query) ||
          getSafeString(w.sucursal).toLowerCase().includes(query)
        );
      }
      return true;
    });

    if (sortKey) {
      filtered = filtered.slice().sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        if (!aVal && aVal !== 0) aVal = '';
        if (!bVal && bVal !== 0) bVal = '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, activeFilter, cargoFilter, seccionFilter, sucursalFilter, search, sortKey, sortDir]);

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

      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="min-w-full divide-y divide-light-border dark:divide-dark-border text-sm">
          <thead className="bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/40">
            <tr>
              <th className="px-4 py-4 md:px-6 md:py-4 text-left">
                <SortBtn col="name" label="Empleado" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-4 md:px-6 md:py-4 text-left">
                <SortBtn col="cargo" label="Cargo / Sucursal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-4 md:px-6 md:py-4 text-left">
                <SortBtn col="status" label="Status Wallet" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-4 md:px-6 md:py-4 text-left">
                <SortBtn col="wallet" label="Wallet Asignada" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-dark-border">
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
              filteredData.map((row) => (
                <tr
                  key={row.rut}
                  className="hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40 transition-colors"
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Subcomponente estilado
const StatCard = ({ icon, label, value, active, onClick, bgClass }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-between p-4 rounded-2xl border text-left transition-all backdrop-blur-md overflow-hidden ${active
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
