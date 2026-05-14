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
  const [isSaving, setIsSaving] = useState(false);

  // Initialize state from config
  useEffect(() => {
    if (currentConfig?.chat_allowed_cargos) {
      setAllowedCargos(currentConfig.chat_allowed_cargos.map(c => c.toLowerCase()));
    }
    if (currentConfig?.chat_allowed_secciones) {
      setAllowedSecciones(currentConfig.chat_allowed_secciones.map(s => s.toLowerCase()));
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
        if (res.meta.cargos) setCargos(res.meta.cargos);
        if (res.meta.secciones) setSecciones(res.meta.secciones);
      }
    } catch (err) {
      console.error('Failed to load cargos:', err);
    } finally {
      setLoadingCargos(false);
    }
  }, [appState]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const toggleCargo = (cargoName) => {
    const key = cargoName.toLowerCase().trim();
    setAllowedCargos(prev => 
      prev.includes(key) 
        ? prev.filter(c => c !== key) 
        : [...prev, key]
    );
  };

  const toggleSeccion = (seccionName) => {
    const key = seccionName.toLowerCase().trim();
    setAllowedSecciones(prev => 
      prev.includes(key) 
        ? prev.filter(s => s !== key) 
        : [...prev, key]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateChatAccess({
        token: appState?.token,
        walletAddress: appState?.account,
        allowedCargos: allowedCargos,
        allowedSecciones: allowedSecciones,
      });
      toast.success('✅ Permisos de chat actualizados');
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
    return JSON.stringify(originalCargos) !== JSON.stringify(currentCargos) || 
           JSON.stringify(originalSecciones) !== JSON.stringify(currentSecciones);
  }, [currentConfig, allowedCargos, allowedSecciones]);

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
            Permisos de Chat Delivery
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Selecciona qué cargos (empleados de nivel 7) pueden utilizar el chat de delivery en sus respectivos locales.
            <br />
            <span className="text-xs opacity-75">
              (Los administradores de Nivel 6 siempre tienen acceso a los locales que administran).
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
        <h3 className="text-md font-bold mb-4 text-light-text-primary dark:text-dark-text-primary">
          Cargos Permitidos
        </h3>

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
        <h3 className="text-md font-bold mb-4 text-light-text-primary dark:text-dark-text-primary">
          Secciones Permitidas
        </h3>

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
    </motion.div>
  );
}
