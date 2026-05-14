import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FaComments, FaSave, FaCheck, FaExclamationCircle } from 'react-icons/fa';
import { getRolesMeta } from '../../../utils/rolesAccess';
import { updateChatAccess } from '../../../utils/deliveryData';
import { toast } from 'react-toastify';

export default function ChatConfigTab({ appState, currentConfig, fetchConfig }) {
  const [cargos, setCargos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [loadingCargos, setLoadingCargos] = useState(false);
  const [allowedCargos, setAllowedCargos] = useState([]);
  const [allowedSecciones, setAllowedSecciones] = useState([]);
  const [kdsAllowedCargos, setKdsAllowedCargos] = useState([]);
  const [kdsAllowedSecciones, setKdsAllowedSecciones] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [customCargo, setCustomCargo] = useState('');
  const [customSeccion, setCustomSeccion] = useState('');

  // Initialize state from config
  useEffect(() => {
    if (currentConfig?.chat_allowed_cargos) {
      setAllowedCargos(currentConfig.chat_allowed_cargos.map(c => c.toLowerCase()));
    }
    if (currentConfig?.chat_allowed_secciones) {
      setAllowedSecciones(currentConfig.chat_allowed_secciones.map(s => s.toLowerCase()));
    }
    if (currentConfig?.kds_allowed_cargos) {
      setKdsAllowedCargos(currentConfig.kds_allowed_cargos.map(c => c.toLowerCase()));
    }
    if (currentConfig?.kds_allowed_secciones) {
      setKdsAllowedSecciones(currentConfig.kds_allowed_secciones.map(s => s.toLowerCase()));
    }
  }, [currentConfig]);

  // Fetch available cargos
  const loadMeta = useCallback(async () => {
    setLoadingCargos(true);
    try {
      const res = await getRolesMeta({
        token: appState?.token,
        walletAddress: appState?.account,
      });
      if (res?.success && res.meta) {
        // Merge fetched cargos with currently configured ones
        let mergedCargos = res.meta.cargos || [];
        let mergedSecciones = res.meta.secciones || [];
        
        const currentChatCargos = (currentConfig?.chat_allowed_cargos || []);
        const currentKdsCargos = (currentConfig?.kds_allowed_cargos || []);
        const currentChatSec = (currentConfig?.chat_allowed_secciones || []);
        const currentKdsSec = (currentConfig?.kds_allowed_secciones || []);

        const allCargos = new Set([...mergedCargos, ...currentChatCargos, ...currentKdsCargos]);
        const allSec = new Set([...mergedSecciones, ...currentChatSec, ...currentKdsSec]);

        setCargos(Array.from(allCargos));
        setSecciones(Array.from(allSec));
      }
    } catch (err) {
      console.error('Failed to load cargos:', err);
    } finally {
      setLoadingCargos(false);
    }
  }, [appState, currentConfig]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const toggleCargo = (cargoName, isKds = false) => {
    const key = cargoName.toLowerCase().trim();
    if (isKds) {
      setKdsAllowedCargos(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    } else {
      setAllowedCargos(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    }
  };

  const handleAddCustomCargo = (e) => {
    e.preventDefault();
    if (!customCargo.trim()) return;
    const val = customCargo.trim().toLowerCase();
    if (!cargos.map(c => c.toLowerCase()).includes(val)) {
      setCargos(prev => [...prev, customCargo.trim()]);
    }
    setCustomCargo('');
  };

  const handleAddCustomSeccion = (e) => {
    e.preventDefault();
    if (!customSeccion.trim()) return;
    const val = customSeccion.trim().toLowerCase();
    if (!secciones.map(s => s.toLowerCase()).includes(val)) {
      setSecciones(prev => [...prev, customSeccion.trim()]);
    }
    setCustomSeccion('');
  };

  const toggleSeccion = (seccionName, isKds = false) => {
    const key = seccionName.toLowerCase().trim();
    if (isKds) {
      setKdsAllowedSecciones(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
    } else {
      setAllowedSecciones(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateChatAccess({
        token: appState?.token,
        walletAddress: appState?.account,
        allowedCargos: allowedCargos,
        allowedSecciones: allowedSecciones,
        kdsAllowedCargos: kdsAllowedCargos,
        kdsAllowedSecciones: kdsAllowedSecciones,
      });
      toast.success('✅ Permisos de staff actualizados');
      if (fetchConfig) fetchConfig();
    } catch (err) {
      toast.error(`❌ Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = useMemo(() => {
    const originalCargos = (currentConfig?.chat_allowed_cargos || []).map(c => c.toLowerCase()).sort();
    const currentCargos = [...allowedCargos].sort();
    const originalSecciones = (currentConfig?.chat_allowed_secciones || []).map(s => s.toLowerCase()).sort();
    const currentSecciones = [...allowedSecciones].sort();
    const originalKdsCargos = (currentConfig?.kds_allowed_cargos || []).map(c => c.toLowerCase()).sort();
    const currentKdsCargos = [...kdsAllowedCargos].sort();
    const originalKdsSecciones = (currentConfig?.kds_allowed_secciones || []).map(s => s.toLowerCase()).sort();
    const currentKdsSecciones = [...kdsAllowedSecciones].sort();

    return JSON.stringify(originalCargos) !== JSON.stringify(currentCargos) || 
           JSON.stringify(originalSecciones) !== JSON.stringify(currentSecciones) ||
           JSON.stringify(originalKdsCargos) !== JSON.stringify(currentKdsCargos) ||
           JSON.stringify(originalKdsSecciones) !== JSON.stringify(currentKdsSecciones);
  }, [currentConfig, allowedCargos, allowedSecciones, kdsAllowedCargos, kdsAllowedSecciones]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaComments className="text-matrix-green" />
            Permisos de Staff (Chat y KDS)
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Configura qué cargos o secciones (empleados de Nivel 7) tienen acceso al Chat de Delivery o visibilidad completa de la Pantalla de Cocina (KDS).
            <br />
            <span className="text-xs opacity-75">
              (Nota: Los Administradores siempre tienen acceso a sus locales).
            </span>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            isDirty && !isSaving
              ? 'bg-matrix-green text-black hover:bg-matrix-green/90 shadow-lg shadow-matrix-green/20'
              : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed'
          }`}
        >
          <FaSave />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary">
            Cargos Permitidos (Chat)
          </h3>
          <form onSubmit={handleAddCustomCargo} className="flex gap-2">
            <input
              type="text"
              value={customCargo}
              onChange={(e) => setCustomCargo(e.target.value)}
              placeholder="Añadir cargo manual..."
              className="px-3 py-1 text-sm rounded bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30"
            />
            <button type="submit" className="px-3 py-1 text-sm bg-matrix-green text-black rounded font-medium">
              Agregar
            </button>
          </form>
        </div>

        {loadingCargos ? (
          <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            Cargando cargos disponibles...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cargos.length === 0 ? (
              <div className="col-span-full flex items-center gap-2 text-sm text-yellow-500">
                <FaExclamationCircle /> No se encontraron cargos configurados.
              </div>
            ) : (
              cargos.map((c, i) => {
                const key = c.toLowerCase().trim();
                const isSelected = allowedCargos.includes(key);
                return (
                  <div
                    key={i}
                    onClick={() => toggleCargo(c)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-matrix-green bg-matrix-green/5 text-matrix-green'
                        : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="text-sm font-medium">{c}</span>
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isSelected ? 'bg-matrix-green text-black' : 'bg-black/10 dark:bg-white/5'
                    }`}>
                      {isSelected && <FaCheck size={10} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary">
            Cargos Permitidos (Visibilidad total de KDS)
          </h3>
          <form onSubmit={handleAddCustomCargo} className="flex gap-2">
            <input
              type="text"
              value={customCargo}
              onChange={(e) => setCustomCargo(e.target.value)}
              placeholder="Añadir cargo manual..."
              className="px-3 py-1 text-sm rounded bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30"
            />
            <button type="submit" className="px-3 py-1 text-sm bg-matrix-green text-black rounded font-medium">
              Agregar
            </button>
          </form>
        </div>

        {loadingCargos ? (
          <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            Cargando cargos disponibles...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cargos.length === 0 ? (
              <div className="col-span-full flex items-center gap-2 text-sm text-yellow-500">
                <FaExclamationCircle /> No se encontraron cargos configurados.
              </div>
            ) : (
              cargos.map((c, i) => {
                const key = c.toLowerCase().trim();
                const isSelected = kdsAllowedCargos.includes(key);
                return (
                  <div
                    key={i}
                    onClick={() => toggleCargo(c, true)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-matrix-green bg-matrix-green/5 text-matrix-green'
                        : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="text-sm font-medium">{c}</span>
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isSelected ? 'bg-matrix-green text-black' : 'bg-black/10 dark:bg-white/5'
                    }`}>
                      {isSelected && <FaCheck size={10} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary">
            Secciones Permitidas (Chat)
          </h3>
          <form onSubmit={handleAddCustomSeccion} className="flex gap-2">
            <input
              type="text"
              value={customSeccion}
              onChange={(e) => setCustomSeccion(e.target.value)}
              placeholder="Añadir sección manual..."
              className="px-3 py-1 text-sm rounded bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30"
            />
            <button type="submit" className="px-3 py-1 text-sm bg-matrix-green text-black rounded font-medium">
              Agregar
            </button>
          </form>
        </div>

        {loadingCargos ? (
          <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            Cargando secciones disponibles...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {secciones.length === 0 ? (
              <div className="col-span-full flex items-center gap-2 text-sm text-yellow-500">
                <FaExclamationCircle /> No se encontraron secciones configuradas.
              </div>
            ) : (
              secciones.map((s, i) => {
                const key = s.toLowerCase().trim();
                const isSelected = allowedSecciones.includes(key);
                return (
                  <div
                    key={i}
                    onClick={() => toggleSeccion(s)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-matrix-green bg-matrix-green/5 text-matrix-green'
                        : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="text-sm font-medium">{s}</span>
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isSelected ? 'bg-matrix-green text-black' : 'bg-black/10 dark:bg-white/5'
                    }`}>
                      {isSelected && <FaCheck size={10} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary">
            Secciones Permitidas (Visibilidad total de KDS)
          </h3>
          <form onSubmit={handleAddCustomSeccion} className="flex gap-2">
            <input
              type="text"
              value={customSeccion}
              onChange={(e) => setCustomSeccion(e.target.value)}
              placeholder="Añadir sección manual..."
              className="px-3 py-1 text-sm rounded bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30"
            />
            <button type="submit" className="px-3 py-1 text-sm bg-matrix-green text-black rounded font-medium">
              Agregar
            </button>
          </form>
        </div>

        {loadingCargos ? (
          <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            Cargando secciones disponibles...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {secciones.length === 0 ? (
              <div className="col-span-full flex items-center gap-2 text-sm text-yellow-500">
                <FaExclamationCircle /> No se encontraron secciones configuradas.
              </div>
            ) : (
              secciones.map((s, i) => {
                const key = s.toLowerCase().trim();
                const isSelected = kdsAllowedSecciones.includes(key);
                return (
                  <div
                    key={i}
                    onClick={() => toggleSeccion(s, true)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-matrix-green bg-matrix-green/5 text-matrix-green'
                        : 'border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    <span className="text-sm font-medium">{s}</span>
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      isSelected ? 'bg-matrix-green text-black' : 'bg-black/10 dark:bg-white/5'
                    }`}>
                      {isSelected && <FaCheck size={10} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
