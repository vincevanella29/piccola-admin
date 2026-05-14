import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FaSave, FaComments } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getRolesMeta } from '../../../utils/rolesAccess';
import { updateChatAccess } from '../../../utils/deliveryData';
import { toast } from 'react-toastify';

export default function ChatConfigTab({ appState, currentConfig, fetchConfig }) {
  const { t } = useTranslation('');
  const [cargos, setCargos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [loadingCargos, setLoadingCargos] = useState(false);
  const [allowedCargos, setAllowedCargos] = useState([]);
  const [allowedSecciones, setAllowedSecciones] = useState([]);
  const [kdsAllowedCargos, setKdsAllowedCargos] = useState([]);
  const [kdsAllowedSecciones, setKdsAllowedSecciones] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // For the selectors
  const [selectedCargoChat, setSelectedCargoChat] = useState('');
  const [selectedSeccionChat, setSelectedSeccionChat] = useState('');
  const [selectedCargoKds, setSelectedCargoKds] = useState('');
  const [selectedSeccionKds, setSelectedSeccionKds] = useState('');

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
      if (res && (res.cargos || res.secciones)) {
        // Merge fetched cargos with currently configured ones
        let mergedCargos = res.cargos || [];
        let mergedSecciones = res.secciones || [];

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

  const handleAddCargo = (val, isKds) => {
    if (!val) return;
    const key = val.toLowerCase().trim();
    if (isKds) {
      if (!kdsAllowedCargos.includes(key)) setKdsAllowedCargos([...kdsAllowedCargos, key]);
      setSelectedCargoKds('');
    } else {
      if (!allowedCargos.includes(key)) setAllowedCargos([...allowedCargos, key]);
      setSelectedCargoChat('');
    }
  };

  const handleAddSeccion = (val, isKds) => {
    if (!val) return;
    const key = val.toLowerCase().trim();
    if (isKds) {
      if (!kdsAllowedSecciones.includes(key)) setKdsAllowedSecciones([...kdsAllowedSecciones, key]);
      setSelectedSeccionKds('');
    } else {
      if (!allowedSecciones.includes(key)) setAllowedSecciones([...allowedSecciones, key]);
      setSelectedSeccionChat('');
    }
  };

  const removeCargo = (key, isKds) => {
    if (isKds) setKdsAllowedCargos(prev => prev.filter(c => c !== key));
    else setAllowedCargos(prev => prev.filter(c => c !== key));
  };

  const removeSeccion = (key, isKds) => {
    if (isKds) setKdsAllowedSecciones(prev => prev.filter(s => s !== key));
    else setAllowedSecciones(prev => prev.filter(s => s !== key));
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
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaComments className="text-matrix-green" />
            {t('delivery.config_chat.title')}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            {t('delivery.config_chat.desc')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isDirty && !isSaving
              ? 'bg-matrix-green text-black hover:bg-matrix-green/90 shadow-lg shadow-matrix-green/20'
              : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed'
            }`}
        >
          <FaSave />
          {isSaving ? t('delivery.config_chat.saving') : t('delivery.config_chat.save_permissions')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
            {t('delivery.config_chat.cargos_chat')}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4">
            {t('delivery.config_chat.cargos_chat_desc')}
          </p>

          <div className="flex gap-2 mb-4">
            <select
              value={selectedCargoChat}
              onChange={(e) => setSelectedCargoChat(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-light-text-primary dark:text-dark-text-primary focus:outline-none"
              disabled={loadingCargos}
            >
              <option value="">{loadingCargos ? t('delivery.config_chat.loading_cargos') : t('delivery.config_chat.select_cargo')}</option>
              {cargos.filter(c => !allowedCargos.includes(c.toLowerCase())).map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => handleAddCargo(selectedCargoChat, false)}
              disabled={!selectedCargoChat}
              className="px-4 py-2 text-sm bg-matrix-green text-black rounded-lg font-medium disabled:opacity-50"
            >
              {t('delivery.config_chat.add')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedCargos.length === 0 ? (
              <span className="text-xs italic opacity-50">{t('delivery.config_chat.no_cargos')}</span>
            ) : (
              allowedCargos.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-matrix-green/10 text-matrix-green border border-matrix-green/20 rounded-full text-xs font-semibold">
                  <span>{c}</span>
                  <button onClick={() => removeCargo(c, false)} className="hover:text-red-400">×</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
            {t('delivery.config_chat.secciones_chat')}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4">
            {t('delivery.config_chat.secciones_chat_desc')}
          </p>

          <div className="flex gap-2 mb-4">
            <select
              value={selectedSeccionChat}
              onChange={(e) => setSelectedSeccionChat(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-light-text-primary dark:text-dark-text-primary focus:outline-none"
              disabled={loadingCargos}
            >
              <option value="">{loadingCargos ? t('delivery.config_chat.loading_secciones') : t('delivery.config_chat.select_seccion')}</option>
              {secciones.filter(s => !allowedSecciones.includes(s.toLowerCase())).map((s, i) => (
                <option key={i} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => handleAddSeccion(selectedSeccionChat, false)}
              disabled={!selectedSeccionChat}
              className="px-4 py-2 text-sm bg-matrix-green text-black rounded-lg font-medium disabled:opacity-50"
            >
              {t('delivery.config_chat.add')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedSecciones.length === 0 ? (
              <span className="text-xs italic opacity-50">{t('delivery.config_chat.no_secciones')}</span>
            ) : (
              allowedSecciones.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-matrix-green/10 text-matrix-green border border-matrix-green/20 rounded-full text-xs font-semibold">
                  <span>{s}</span>
                  <button onClick={() => removeSeccion(s, false)} className="hover:text-red-400">×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
            {t('delivery.config_chat.cargos_kds')}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4">
            {t('delivery.config_chat.cargos_kds_desc')}
          </p>

          <div className="flex gap-2 mb-4">
            <select
              value={selectedCargoKds}
              onChange={(e) => setSelectedCargoKds(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-light-text-primary dark:text-dark-text-primary focus:outline-none"
              disabled={loadingCargos}
            >
              <option value="">{loadingCargos ? t('delivery.config_chat.loading_cargos') : t('delivery.config_chat.select_cargo')}</option>
              {cargos.filter(c => !kdsAllowedCargos.includes(c.toLowerCase())).map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => handleAddCargo(selectedCargoKds, true)}
              disabled={!selectedCargoKds}
              className="px-4 py-2 text-sm bg-matrix-green text-black rounded-lg font-medium disabled:opacity-50"
            >
              {t('delivery.config_chat.add')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {kdsAllowedCargos.length === 0 ? (
              <span className="text-xs italic opacity-50">{t('delivery.config_chat.no_cargos')}</span>
            ) : (
              kdsAllowedCargos.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-matrix-green/10 text-matrix-green border border-matrix-green/20 rounded-full text-xs font-semibold">
                  <span>{c}</span>
                  <button onClick={() => removeCargo(c, true)} className="hover:text-red-400">×</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-light-surface dark:bg-dark-surface p-5 rounded-xl border border-light-border/20 dark:border-dark-border/20">
          <h3 className="text-md font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
            {t('delivery.config_chat.secciones_kds')}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4">
            {t('delivery.config_chat.secciones_kds_desc')}
          </p>

          <div className="flex gap-2 mb-4">
            <select
              value={selectedSeccionKds}
              onChange={(e) => setSelectedSeccionKds(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/30 dark:border-dark-border/30 text-light-text-primary dark:text-dark-text-primary focus:outline-none"
              disabled={loadingCargos}
            >
              <option value="">{loadingCargos ? t('delivery.config_chat.loading_secciones') : t('delivery.config_chat.select_seccion')}</option>
              {secciones.filter(s => !kdsAllowedSecciones.includes(s.toLowerCase())).map((s, i) => (
                <option key={i} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => handleAddSeccion(selectedSeccionKds, true)}
              disabled={!selectedSeccionKds}
              className="px-4 py-2 text-sm bg-matrix-green text-black rounded-lg font-medium disabled:opacity-50"
            >
              {t('delivery.config_chat.add')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {kdsAllowedSecciones.length === 0 ? (
              <span className="text-xs italic opacity-50">{t('delivery.config_chat.no_secciones')}</span>
            ) : (
              kdsAllowedSecciones.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-matrix-green/10 text-matrix-green border border-matrix-green/20 rounded-full text-xs font-semibold">
                  <span>{s}</span>
                  <button onClick={() => removeSeccion(s, true)} className="hover:text-red-400">×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
