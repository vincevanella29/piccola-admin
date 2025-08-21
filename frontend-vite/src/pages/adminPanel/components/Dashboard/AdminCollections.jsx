import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { List, Database, Loader2, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { FaCopy, FaTimes } from 'react-icons/fa';
import useAdminData from '../../../../hooks/useAdminData';
import JsonView from '@uiw/react-json-view';

// Tema personalizado para JsonView usando solo colores de tailwind.config.js
const jsonViewTheme = {
  dark: {
    '--w-rjv-font-family': 'monospace',
    '--w-rjv-background-color': '#1A1A1A', // dark-surface
    '--w-rjv-text-color': '#FFFFFF', // dark-text-primary
    '--w-rjv-key-string': '#009246', // dark-accent (verde italiano)
    '--w-rjv-key-number': '#1DE9B6', // dark-success
    '--w-rjv-key-boolean': '#CE2B37', // dark-error
    '--w-rjv-key-null': '#B0B0B0', // dark-text-secondary
    '--w-rjv-brace-color': '#FFFFFF', // dark-text-primary
    '--w-rjv-bracket-color': '#FFFFFF', // dark-text-primary
    '--w-rjv-line-color': 'rgba(0, 146, 70, 0.3)', // dark-glow
    '--w-rjv-arrow-color': '#B0B0B0', // dark-text-secondary
    '--w-rjv-copied-color': '#1DE9B6', // dark-success
  },
  light: {
    '--w-rjv-font-family': 'monospace',
    '--w-rjv-background-color': '#E5E7EB', // light-surface-secondary
    '--w-rjv-text-color': '#111827', // light-text-primary
    '--w-rjv-key-string': '#009246', // light-accent (verde italiano)
    '--w-rjv-key-number': '#1DE9B6', // light-success
    '--w-rjv-key-boolean': '#CE2B37', // light-error
    '--w-rjv-key-null': '#6B7280', // light-text-secondary
    '--w-rjv-brace-color': '#111827', // light-text-primary
    '--w-rjv-bracket-color': '#111827', // light-text-primary
    '--w-rjv-line-color': 'rgba(0, 146, 70, 0.3)', // light-glow
    '--w-rjv-arrow-color': '#6B7280', // light-text-secondary
    '--w-rjv-copied-color': '#1DE9B6', // light-success
  }
};

// Página de administración de colecciones MongoDB, estilo pro y responsivo
const AdminCollections = ({ appState }) => {
  const { t } = useTranslation();
  const {
    dbCollections = [],
    dbCollectionData = [],
    selectedDbCollection,
    setSelectedDbCollection,
    fetchDbCollections,
    fetchDbCollectionData,
    isLoading,
    error,
    success,
  } = useAdminData(appState);

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);

  // Obtener el nivel de rol del usuario actual
  const userRoleLevel = appState?.roleLevel ?? null;

  // Mapear el nivel de rol al nombre para mostrarlo
  const roleOptions = [
    { name: 'DOMINUS_SAPORIS', level: 3, label: t('admin.roles.dominus_saporis') },
    { name: 'CENTURIO_MENSARUM', level: 4, label: t('admin.roles.centurio_mensarum') },
    { name: 'MILITES_CULINAE', level: 5, label: t('admin.roles.milites_culinae') }
  ];

  // Obtener el nombre del rol actual del usuario
  const currentUserRole = userRoleLevel !== null
    ? roleOptions.find(role => role.level === userRoleLevel)?.label || 'Unknown Role'
    : 'No Role Assigned';

  // Verificar si el usuario tiene permisos para ver datos
  const hasPermission = userRoleLevel !== null && userRoleLevel <= 4;

  // Copiar JSON al portapapeles
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedRowData, null, 2)).then(() => {
      appState.setSuccess(t('admin.copy_json'));
    }).catch((err) => {
      console.error('Error al copiar:', err);
    });
  };

  useEffect(() => {
    if (hasPermission) {
      fetchDbCollections();
    }
    // eslint-disable-next-line
  }, []);

  // UX: Selección de colección y carga de datos
  const handleSelectCollection = (col) => {
    if (!hasPermission) return;
    setSelectedDbCollection(col);
    fetchDbCollectionData(col);
  };

  // Abrir modal con datos de la fila
  const handleViewData = (row) => {
    if (!hasPermission) return;
    setSelectedRowData(row);
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRowData(null);
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      {/* Header animado */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-3xl sm:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-8 text-center tracking-tight flex items-center justify-center gap-4"
      >
        <Database size={36} className="text-light-accent dark:text-dark-accent" />
        {t('admin.collections_management')}
      </motion.h1>

      {/* Mostrar el rol del usuario actual */}
      <div className="mb-6">
        <p className="text-sm sm:text-base text-light-text-primary dark:text-dark-text-primary text-center">
          {t('admin.your_role')}: <span className="font-semibold">{currentUserRole}</span>
        </p>
      </div>

      {/* Estado y feedback visual */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-success/20 dark:bg-dark-success/20 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <CheckCircle size={20} className="text-light-success dark:text-dark-success" />
            <span className="text-light-success dark:text-dark-success">{success}</span>
          </motion.div>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/30 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <Loader2 size={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
            <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse">{t('admin.loading')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensaje de falta de permisos */}
      {!hasPermission && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 max-w-2xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
        >
          <AlertTriangle size={20} className="text-light-error dark:text-dark-error" />
          <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{t('admin.form.no_permission')}</p>
        </motion.div>
      )}

      {/* Card principal: listado de colecciones */}
      {hasPermission && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto max-w-3xl rounded-lg border border-light-border/20 dark:border-dark-accent/30 bg-white/70 dark:bg-dark-surface/90 p-6 shadow-neon"
        >
          <div className="flex items-center gap-2 mb-3">
            <List size={24} className="text-light-accent dark:text-dark-accent" />
            <h2 className="text-xl sm:text-2xl font-semibold text-light-text-primary dark:text-dark-text-primary">
              {t('admin.collections_list')}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={fetchDbCollections}
              className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-accent/20 text-light-text-primary dark:text-dark-text-primary rounded-full hover:bg-light-accent/10 dark:hover:bg-dark-accent/30 border border-light-border/30 dark:border-dark-accent/50 transition disabled:opacity-50 text-sm shadow-neon"
              disabled={isLoading}
            >
              {t('admin.update_collections')}
            </button>
          </div>
          {dbCollections.length === 0 ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm text-center">
              {t('admin.no_collections')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {dbCollections.map((col) => (
                <motion.button
                  key={col}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectCollection(col)}
                  className={`flex items-center gap-2 w-full px-4 py-3 rounded-lg border transition text-left ${selectedDbCollection === col
                    ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/20 font-bold shadow-neon'
                    : 'border-light-border/20 dark:border-dark-accent/30 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/50 hover:border-light-accent/40 dark:hover:border-dark-accent/50 hover:shadow-neon'} text-light-text-primary dark:text-dark-text-primary`}
                >
                  <Database size={18} />
                  <span className="truncate">{col}</span>
                  {selectedDbCollection === col && <Eye size={16} className="text-light-accent dark:text-dark-accent ml-auto" />}
                </motion.button>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* Card de datos de la colección seleccionada */}
      {hasPermission && selectedDbCollection && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-5xl rounded-lg border border-light-border/20 dark:border-dark-accent/30 bg-white/90 dark:bg-dark-surface/90 p-6 shadow-neon"
        >
          <div className="flex items-center gap-2 mb-4">
            <Database size={22} className="text-light-accent dark:text-dark-accent" />
            <h3 className="text-lg sm:text-xl font-medium text-light-text-primary dark:text-dark-text-primary">
              {t('admin.collections.label')}: <span className="font-mono">{selectedDbCollection}</span>
            </h3>
            <button
              onClick={() => fetchDbCollectionData(selectedDbCollection)}
              className="ml-auto px-3 py-1 rounded-full bg-light-surface-secondary dark:bg-dark-accent/20 border border-light-border/30 dark:border-dark-accent/50 text-light-text-primary dark:text-dark-text-primary hover:bg-light-accent/10 dark:hover:bg-dark-accent/30 text-xs transition disabled:opacity-50 shadow-neon"
              disabled={isLoading}
            >
              {t('admin.update_collections')}
            </button>
          </div>
          {dbCollectionData.length === 0 ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm text-center">
              {t('admin.no_collections')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-light-border/10 dark:border-dark-accent/30 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/50">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {Object.keys(dbCollectionData[0] || {}).map((key) => (
                      <th
                        key={key}
                        className="py-2 px-3 text-left bg-light-surface-tertiary dark:bg-dark-surface-tertiary/80 text-light-text-secondary dark:text-dark-text-secondary font-semibold whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-left bg-light-surface-tertiary dark:bg-dark-surface-tertiary/80 text-light-text-secondary dark:text-dark-text-secondary font-semibold whitespace-nowrap">
                      {t('admin.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dbCollectionData.map((row, idx) => (
                    <tr key={idx} className="border-b border-light-border/10 dark:border-dark-accent/20 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/70">
                      {Object.values(row).map((val, i) => (
                        <td
                          key={i}
                          className="py-2 px-3 text-light-text-primary dark:text-dark-text-primary whitespace-nowrap max-w-xs truncate"
                        >
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-light-text-primary dark:text-dark-text-primary">
                        <motion.button
                          onClick={() => handleViewData(row)}
                          className="px-3 py-1 bg-light-accent/20 dark:bg-dark-accent/30 text-light-accent dark:text-dark-accent rounded-full hover:bg-light-accent/30 dark:hover:bg-dark-accent/50 transition text-xs sm:text-sm shadow-neon"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {t('admin.view_data')}
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      )}

      {/* Modal para mostrar JSON */}
      <AnimatePresence>
        {isModalOpen && selectedRowData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-dark-surface rounded-lg p-3 sm:p-4 w-full max-w-[90vw] sm:max-w-[80vw] md:max-w-[70vw] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto shadow-neon"
            >
              <div className="bg-light-surface-tertiary dark:bg-dark-surface-secondary p-2 sm:p-3 flex justify-between items-center border-b border-light-border/20 dark:border-dark-accent/20">
                <h3 className="text-sm sm:text-base text-light-text-primary dark:text-dark-text-primary font-medium truncate">
                  {t('admin.collections.label')}: <span className="font-mono">{selectedDbCollection}</span> - Row {dbCollectionData.indexOf(selectedRowData) + 1}
                </h3>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={handleCopy}
                    className="p-2 sm:p-2.5 bg-dark-surface-secondary rounded-full text-dark-accent hover:bg-dark-accent/30 transition-all duration-200"
                    title={t('admin.copy_json')}
                  >
                    <FaCopy size={14} />
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 sm:p-2.5 bg-dark-surface-secondary rounded-full text-dark-text-secondary hover:bg-dark-accent/30 transition-all duration-200"
                    title="Cerrar"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-4 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-track-dark-surface-secondary scrollbar-thumb-dark-accent">
                <JsonView
                  value={selectedRowData}
                  style={{ background: 'transparent', fontSize: '0.75rem sm:0.875rem md:1rem', lineHeight: '1.4' }}
                  theme={appState.theme === 'dark' ? jsonViewTheme.dark : jsonViewTheme.light}
                  shortenTextAfterLength={50}
                  displayDataTypes={false}
                  enableClipboard={false} // Usamos nuestro propio botón de copiar
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCollections;