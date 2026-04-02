// src/pages/adminPanel/AdminEmpresas.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, Plus, RotateCw, ShieldCheck, Factory } from 'lucide-react';

import EmpresasList from './components/empresas/EmpresasList.jsx';
import EmpresaCreateDrawer from './components/empresas/EmpresaCreateDrawer.jsx';
import { useEmpresaAdmin } from '../../hooks/useEmpresaAdmin.jsx';
import EmpresaRolesTab from './components/empresas/EmpresaRolesTab.jsx';
import ApiAccessRulesTab from './components/empresas/components/roles/ApiAccessRulesTab.jsx';

// ⬅️ NUEVO: Tab de Centros de Producción
import ProductionCentersTab from './components/empresas/components/cproduccion/ProductionCentersTab.jsx';

import EmpresaWorkersAuditTab from './components/empresas/EmpresaWorkersAuditTab.jsx';

// ⬅️ Usa los mismos Tabs que en MyFichaPanel:
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';

const fetchAllPages = async (fn, { limit = 200, q = '', ...rest } = {}) => {
  let page = 1;
  const out = [];
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
    refetchEmpresa,
    refetchEmpresaCuentas,
  } = useEmpresaAdmin(appState, t);

  // ---- estado tabs (como MyFichaPanel)
  const [activeTab, setActiveTab] = useState('empresas');

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
    } catch {
      setInitError(t('empresa.load_all_error') || 'Error al cargar todo');
    } finally {
      setInitLoading(false);
    }
  }, [listEmpresas, listSucursalesRefs, listCuentasRefs, t]);

  useEffect(() => {
    loadAllOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    for (const c of allCuentas) if (c?.resumen2) set.add(String(c.resumen2));
    return Array.from(set).sort().map((r2) => ({ value: r2, label: r2 }));
  }, [allCuentas]);

  const refreshEmpresasFromServer = useCallback(async () => {
    try {
      const emp = await fetchAllPages(listEmpresas, { limit: 200, q: '' });
      setAllEmpresas(emp);
    } catch {
      appState?.setError?.(t('empresa.refresh_error') || 'Error refresh');
    }
  }, [listEmpresas, appState, t]);

  const empresasListProps = useMemo(
    () => ({
      items: paginated,
      total,
      page,
      limit,
      loading: initLoading,
      error: initError,
      q,
      onSearchChange: (val) => { setQ(val); setPage(1); },
      onPageChange: (p) => setPage(p),
      onChangeLimit: (n) => { setLimit(n); setPage(1); },
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
      resumen2Options,
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
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      {/* Título - Apple Glass Style */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between bg-white/40 dark:bg-black/20 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm"
      >
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          {t('empresa.admin_title')}
        </h1>
        
        {/* Acciones contextuales Header */}
        <div className="hidden sm:flex items-center gap-3">
          {activeTab === 'empresas' && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm shadow-sm transition-all"
                onClick={loadAllOnce}
                disabled={initLoading}
                title={t('empresa.reload_all_tooltip')}
              >
                <RotateCw className={`h-4 w-4 ${initLoading ? 'animate-spin' : ''}`} />
                <span>{t('empresa.reload') || 'Recargar'}</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 text-white font-bold text-sm shadow-lg shadow-primary-500/20 transition-all"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-5 w-5" /> {t('empresa.create_new')}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* Acciones contextuales Móvil */}
      <div className="flex sm:hidden items-center justify-between gap-3 bg-white/40 dark:bg-black/20 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl">
          {activeTab === 'empresas' ? (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm shadow-sm"
                onClick={loadAllOnce}
                disabled={initLoading}
              >
                <RotateCw className={`h-4 w-4 ${initLoading ? 'animate-spin' : ''}`} />
                <span>{t('empresa.reload') || 'Recargar'}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-bold text-sm shadow-lg"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-5 w-5" /> {t('common.add') || 'Añadir'}
              </motion.button>
            </>
          ) : (
            <div className="w-full text-center text-sm font-semibold text-gray-400">
               {t('empresa.admin_title')} Configuración
            </div>
          )}
      </div>

      {/* Card + Tabs  */}
      <div className="rounded-[32px] border border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-black/30 backdrop-blur-xl shadow-xl overflow-hidden flex flex-col">
        <Tabs>
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 border-b border-gray-100 dark:border-gray-800/50 bg-white/40 dark:bg-gray-900/40">
            {/* Header Tabs con scroll horizontal */}
            <div className="relative w-full">
              <div className="overflow-x-auto scrollbar-none pb-4">
                <TabsList className="bg-transparent border-0 gap-2 p-0 flex">
                  <TabsTrigger
                    isActive={activeTab === 'empresas'}
                    onClick={() => setActiveTab('empresas')}
                    icon={Building2}
                    className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'empresas' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    {t('empresa.tab_empresas') || 'Empresas'}
                  </TabsTrigger>

                  <TabsTrigger
                    isActive={activeTab === 'roles'}
                    onClick={() => setActiveTab('roles')}
                    icon={ShieldCheck}
                    className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'roles' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    {t('empresa.tab_roles') || 'Roles & Scopes'}
                  </TabsTrigger>

                  <TabsTrigger
                    isActive={activeTab === 'secciones'}
                    onClick={() => setActiveTab('secciones')}
                    icon={ShieldCheck}
                    className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'secciones' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    {t('empresa.tab_secciones') || 'Secciones x API'}
                  </TabsTrigger>

                  <TabsTrigger
                    isActive={activeTab === 'cproduccion'}
                    onClick={() => setActiveTab('cproduccion')}
                    icon={Factory}
                    className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'cproduccion' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    {t('empresa.tab_cproduccion') || 'Centros Prod.'}
                  </TabsTrigger>

                  <TabsTrigger
                    isActive={activeTab === 'audit'}
                    onClick={() => setActiveTab('audit')}
                    icon={ShieldCheck}
                    className={`whitespace-nowrap px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'audit' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    Auditoría
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          {/* Contenidos */}
          <div className="p-4 sm:p-6 bg-transparent">
            <TabsContent isActive={activeTab === 'empresas'}>
              <div className="w-full">
                <EmpresasList {...empresasListProps} />
              </div>

              {/* Drawer de creación */}
              <EmpresaCreateDrawer
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={async () => {
                  setShowCreate(false);
                  await refreshEmpresasFromServer(); // sólo empresas
                }}
                prefetchedSucursales={allSucursales}
                prefetchedCuentas={allCuentas}
                resumen2Options={resumen2Options}
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
                prefetchedSucursales={allSucursales}
                prefetchedCuentas={allCuentas}
                resumen2Options={resumen2Options}
                updateEmpresa={updateEmpresa}
                t={t}
                appState={appState}
              />
            </TabsContent>

            <TabsContent isActive={activeTab === 'roles'}>
              <div className="w-full">
                <EmpresaRolesTab
                  appState={appState}
                  t={t}
                  prefetchedEmpresas={allEmpresas}
                  prefetchedSucursales={allSucursales}
                />
              </div>
            </TabsContent>

            <TabsContent isActive={activeTab === 'secciones'}>
              <div className="w-full">
                <ApiAccessRulesTab appState={appState} t={t} />
              </div>
            </TabsContent>

            <TabsContent isActive={activeTab === 'cproduccion'}>
              <div className="w-full">
                <ProductionCentersTab appState={appState} t={t} />
              </div>
            </TabsContent>

            <TabsContent isActive={activeTab === 'audit'}>
              <div className="w-full">
                <EmpresaWorkersAuditTab appState={appState} t={t} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
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
