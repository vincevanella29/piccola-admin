// src/pages/adminPanel/AdminEmpresas.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, Plus, RotateCw } from 'lucide-react';
import EmpresasList from './components/empresas/EmpresasList.jsx';
import EmpresaCreateDrawer from './components/empresas/EmpresaCreateDrawer.jsx';
import { useEmpresaAdmin } from '../../hooks/useEmpresaAdmin.jsx';

const fetchAllPages = async (fn, { limit = 200, q = '', ...rest } = {}) => {
  let page = 1;
  const out = [];
  // seguridad por si la API no devuelve total consistente
  for (let i = 0; i < 1000; i++) {
    const { items = [], total = 0 } = await fn({ page, limit, q, ...rest });
    out.push(...items);
    if (items.length < limit || out.length >= (total || out.length)) break;
    page += 1;
  }
  return out;
};

const AdminEmpresas = ({ appState }) => {
  const { t } = useTranslation();
  const {
    listEmpresas,
    listSucursalesRefs,
    listCuentasRefs,
    create: createEmpresa,
    update: updateEmpresa,
    includeCuentasByResumen2,
    excludeCuentasByResumen2,
    includeCuentas,
    excludeCuentas,
    // opcional si quieres abrir detalle al seleccionar
    refetchEmpresa,
    refetchEmpresaCuentas,
  } = useEmpresaAdmin(appState, t);

  // caches globales (prefetch all)
  const [allEmpresas, setAllEmpresas] = useState([]);
  const [allSucursales, setAllSucursales] = useState([]);
  const [allCuentas, setAllCuentas] = useState([]);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState(null);

  const loadAllOnce = useCallback(async () => {
    setInitLoading(true);
    setInitError(null);
    try {
      const [emp, suc, cue] = await Promise.all([
        fetchAllPages(listEmpresas, { limit: 200, q: '' }),
        fetchAllPages(listSucursalesRefs, { limit: 400, q: '' }),
        fetchAllPages(listCuentasRefs, { limit: 500, q: '' }),
      ]);
      setAllEmpresas(emp);
      setAllSucursales(suc);
      setAllCuentas(cue);
    } catch (e) {
      setInitError(t('empresa.load_all_error'));
    } finally {
      setInitLoading(false);
    }
  }, [listEmpresas, listSucursalesRefs, listCuentasRefs]);

  // carga inicial una sola vez
  useEffect(() => {
    loadAllOnce();
  }, []);

  // búsqueda/paginación 100% cliente
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const filtered = useMemo(() => {
    const qq = (q || '').toLowerCase().trim();
    if (!qq) return allEmpresas;
    return allEmpresas.filter((e) => {
      const nombre = (e?.nombre || '').toLowerCase();
      const slug = (e?.slug || '').toLowerCase();
      const id = String(e?._id || '').toLowerCase();
      return nombre.includes(qq) || slug.includes(qq) || id.includes(qq);
    });
  }, [q, allEmpresas]);

  const total = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  // Drawers
  const [showCreate, setShowCreate] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  // opciones de resumen2 únicas desde cuentas
  const resumen2Options = useMemo(() => {
    const set = new Set();
    for (const c of allCuentas) {
      if (c?.resumen2) set.add(String(c.resumen2));
    }
    return Array.from(set).sort().map((r2) => ({ value: r2, label: r2 }));
  }, [allCuentas]);

  // refrescar SOLO empresas desde server (tras crear)
  const refreshEmpresasFromServer = useCallback(async () => {
    try {
      const emp = await fetchAllPages(listEmpresas, { limit: 200, q: '' });
      setAllEmpresas(emp);
      // mantenemos sucursales/cuentas cacheadas tal cual
    } catch (e) {
      appState?.setError?.(t('empresa.refresh_error'));
    }
  }, [listEmpresas, appState]);

  // props para la tabla (no hace más llamadas)
  const empresasListProps = useMemo(
    () => ({
      items: paginated,
      total,
      page,
      limit,
      loading: initLoading,
      error: initError,
      q,
      onSearchChange: (val) => {
        setQ(val);
        setPage(1);
      },
      onPageChange: (p) => setPage(p),
      onChangeLimit: (n) => { setLimit(n); setPage(1); }, // NEW
      onSelectEmpresa: async (e) => {
        try {
          await refetchEmpresa({ empresaId: e._id });
          await refetchEmpresaCuentas({ empresaId: e._id });
        } catch {}
        setEditingEmpresa(e);
        setShowEdit(true);
      },
      onRefresh: () => { setQ(''); setPage(1); },
      reloadKey: `${page}-${q}-${paginated.length}-${total}`,

      // ---- Quick Actions en la tabla ----
      resumen2Options, // NEW
      onIncludeByResumen2: async (empresaId, resumen2) => {
        await includeCuentasByResumen2({ empresaId, resumen2 });
        await refreshEmpresasFromServer();
      },
      onExcludeByResumen2: async (empresaId, resumen2) => {
        await excludeCuentasByResumen2({ empresaId, resumen2 });
        await refreshEmpresasFromServer();
      },
      onIncludeCuentas: async (empresaId, cuentas) => {
        await includeCuentas({ empresaId, cuentas });
        await refreshEmpresasFromServer();
      },
      onExcludeCuentas: async (empresaId, cuentas) => {
        await excludeCuentas({ empresaId, cuentas });
        await refreshEmpresasFromServer();
      },
    }),
    [
      paginated, total, page, limit, initLoading, initError, q,
      refetchEmpresa, refetchEmpresaCuentas, resumen2Options,
      includeCuentasByResumen2, excludeCuentasByResumen2, refreshEmpresasFromServer
    ]
  );


  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3"
        >
          <Building2 className="h-7 w-7 sm:h-8 sm:w-8" />
          {t('empresa.admin_title')}
        </motion.h1>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
            onClick={loadAllOnce}
            disabled={initLoading}
            title={t('empresa.reload_all_tooltip')}
          >
            <RotateCw className={`h-4 w-4 ${initLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('empresa.reload')}</span>
          </button>

          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" /> {t('empresa.create_new')}
          </button>
        </div>
      </div>

      <div className="rounded-lg p-4 border border-gray-200 dark:border-gray-800">
        <EmpresasList {...empresasListProps} />
      </div>

      {/* Drawer de creación (usa caches prefetched) */}
      <EmpresaCreateDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await refreshEmpresasFromServer(); // sólo empresas
        }}
        // caches prefetched (sin buscar)
        prefetchedSucursales={allSucursales}
        prefetchedCuentas={allCuentas}
        resumen2Options={resumen2Options}
        // APIs
        createEmpresa={createEmpresa}
        includeByResumen2={includeCuentasByResumen2}
        excludeByResumen2={excludeCuentasByResumen2}
        t={t}
        appState={appState}
      />

      {/* Drawer de edición */}
      <EmpresaCreateDrawer
        open={showEdit}
        onClose={() => { setShowEdit(false); setEditingEmpresa(null); }}
        onUpdated={async () => {
          setShowEdit(false);
          setEditingEmpresa(null);
          await refreshEmpresasFromServer();
        }}
        empresa={editingEmpresa}
        // caches prefetched
        prefetchedSucursales={allSucursales}
        prefetchedCuentas={allCuentas}
        resumen2Options={resumen2Options}
        // APIs
        updateEmpresa={updateEmpresa}
        t={t}
        appState={appState}
      />
    </div>
  );
};

export default AdminEmpresas;

export const pageMetadata = {
  path: '/app/admin/empresas',
  label: 'empresa.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 3,
  locations: ['sidebar'],
  description: 'empresa.description',
  icon: 'FaBuilding',
};
