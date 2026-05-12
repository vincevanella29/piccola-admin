// src/hooks/useMarketing.jsx — State management for marketing module
// Follows the same auth pattern as useDeliveryOrders.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as api from '../utils/marketingData';
import { getDeliveryConfig } from '../utils/deliveryData';

export default function useMarketing(appState) {
  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // ── Order Statuses (from delivery_config in MongoDB) ──
  const [orderStatuses, setOrderStatuses] = useState([]);

  const loadStatuses = useCallback(async () => {
    try {
      const data = await getDeliveryConfig(getAuth());
      const statuses = data?.config?.internal_statuses || [];
      setOrderStatuses(statuses);
    } catch (e) {
      // Silently fail — statuses will just be empty
      console.warn('Could not load delivery statuses for automations:', e.message);
    }
  }, [getAuth]);

  // ── Templates ────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadTemplates = useCallback(async (type) => {
    setTemplatesLoading(true);
    try {
      const data = await api.fetchTemplates({ ...getAuth(), type });
      setTemplates(data.templates || []);
    } catch (e) {
      toast.error('Error cargando templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [getAuth]);

  const saveTemplate = useCallback(async (id, data) => {
    try {
      if (id) {
        await api.updateTemplate({ ...getAuth(), id, data });
        toast.success('Template actualizado');
      } else {
        const result = await api.createTemplate({ ...getAuth(), data });
        toast.success('Template creado');
        return result.template_id;
      }
      loadTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error guardando template');
    }
  }, [getAuth, loadTemplates]);

  const removeTemplate = useCallback(async (id) => {
    try {
      await api.deleteTemplate({ ...getAuth(), id });
      toast.success('Template eliminado');
      loadTemplates();
    } catch (e) {
      toast.error('Error eliminando template');
    }
  }, [getAuth, loadTemplates]);

  const previewTpl = useCallback(async (id, data) => {
    try {
      return await api.previewTemplate({ ...getAuth(), id, data });
    } catch (e) {
      toast.error('Error en preview');
    }
  }, [getAuth]);

  const testEmail = useCallback(async (id) => {
    try {
      const result = await api.sendTestEmail({ ...getAuth(), id });
      if (result.success) {
        toast.success(`Email de prueba enviado a ${result.sent_to}`);
      } else {
        toast.error(result.error || 'Error enviando test');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error enviando test');
    }
  }, [getAuth]);

  // ── Campaigns ────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  const loadCampaigns = useCallback(async (status) => {
    setCampaignsLoading(true);
    try {
      const data = await api.fetchCampaigns({ ...getAuth(), status });
      setCampaigns(data.campaigns || []);
    } catch (e) {
      toast.error('Error cargando campañas');
    } finally {
      setCampaignsLoading(false);
    }
  }, [getAuth]);

  const saveCampaign = useCallback(async (id, data) => {
    try {
      if (id) {
        await api.updateCampaign({ ...getAuth(), id, data });
        toast.success('Campaña actualizada');
      } else {
        const result = await api.createCampaign({ ...getAuth(), data });
        toast.success('Campaña creada');
        return result.campaign_id;
      }
      loadCampaigns();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error guardando campaña');
    }
  }, [getAuth, loadCampaigns]);

  const launchCampaign = useCallback(async (id) => {
    try {
      const result = await api.sendCampaign({ ...getAuth(), id });
      toast.success(`Campaña enviada: ${result.enqueued} emails encolados`);
      loadCampaigns();
      return result;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error enviando campaña');
    }
  }, [getAuth, loadCampaigns]);

  const cancelCamp = useCallback(async (id) => {
    try {
      const result = await api.cancelCampaign({ ...getAuth(), id });
      toast.success(`Campaña cancelada: ${result.removed_from_queue} emails removidos`);
      loadCampaigns();
    } catch (e) {
      toast.error('Error cancelando campaña');
    }
  }, [getAuth, loadCampaigns]);

  const removeCampaign = useCallback(async (id) => {
    try {
      await api.deleteCampaign({ ...getAuth(), id });
      toast.success('Campaña eliminada');
      loadCampaigns();
    } catch (e) {
      toast.error('Error eliminando campaña');
    }
  }, [getAuth, loadCampaigns]);

  const getCampaignStats = useCallback(async (id) => {
    try {
      return await api.campaignStats({ ...getAuth(), id });
    } catch (e) {
      toast.error('Error cargando stats');
    }
  }, [getAuth]);

  // ── Automations ──────────────────────────────────────
  const [automations, setAutomations] = useState([]);
  const [automationsLoading, setAutomationsLoading] = useState(false);

  const loadAutomations = useCallback(async () => {
    setAutomationsLoading(true);
    try {
      const data = await api.fetchAutomations(getAuth());
      setAutomations(data.automations || []);
    } catch (e) {
      toast.error('Error cargando automations');
    } finally {
      setAutomationsLoading(false);
    }
  }, [getAuth]);

  const saveAutomation = useCallback(async (id, data) => {
    try {
      if (id) {
        await api.updateAutomation({ ...getAuth(), id, data });
        toast.success('Automation actualizada');
      } else {
        await api.createAutomation({ ...getAuth(), data });
        toast.success('Automation creada');
      }
      loadAutomations();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error guardando automation');
    }
  }, [getAuth, loadAutomations]);

  const toggleAuto = useCallback(async (id) => {
    try {
      const result = await api.toggleAutomation({ ...getAuth(), id });
      toast.success(result.active ? 'Automation activada' : 'Automation desactivada');
      loadAutomations();
    } catch (e) {
      toast.error('Error toggling automation');
    }
  }, [getAuth, loadAutomations]);

  const removeAutomation = useCallback(async (id) => {
    try {
      await api.deleteAutomation({ ...getAuth(), id });
      toast.success('Automation eliminada');
      loadAutomations();
    } catch (e) {
      toast.error('Error eliminando automation');
    }
  }, [getAuth, loadAutomations]);

  // ── Products (for template editor) ──────────────────────
  const searchProducts = useCallback(async (search, limit = 20) => {
    try { return await api.searchProducts({ ...getAuth(), search, limit }); }
    catch (e) { toast.error('Error buscando productos'); return { products: [] }; }
  }, [getAuth]);

  const getBestsellers = useCallback(async (limit = 6, days = 30) => {
    try { return await api.getBestsellers({ ...getAuth(), limit, days }); }
    catch (e) { toast.error('Error cargando bestsellers'); return { products: [] }; }
  }, [getAuth]);

  // ── AI Marketing Image ──────────────────────────────────
  const generateMarketingImage = useCallback(async ({ style, prompt, productIds, referenceUrl }) => {
    try { return await api.generateMarketingImage({ ...getAuth(), style, prompt, productIds, referenceUrl }); }
    catch (e) { toast.error(e?.message || 'Error generando imagen'); throw e; }
  }, [getAuth]);

  const fetchMarketingAssets = useCallback(async (limit = 50) => {
    try { return await api.fetchMarketingAssets({ ...getAuth(), limit }); }
    catch (e) { console.warn('Error loading assets:', e.message); return { assets: [] }; }
  }, [getAuth]);

  // ── Mail Settings ───────────────────────────────────────
  const loadMailSettings = useCallback(async () => {
    try { return await api.fetchMailSettings(getAuth()); }
    catch (e) { console.warn('Error loading mail settings:', e.message); return { configured: false }; }
  }, [getAuth]);

  const saveMailSettings = useCallback(async (data) => {
    try { const r = await api.saveMailSettings({ ...getAuth(), data }); toast.success('Configuración guardada'); return r; }
    catch (e) { toast.error(e?.message || 'Error guardando configuración'); throw e; }
  }, [getAuth]);

  const testMailSettings = useCallback(async (to) => {
    try { const r = await api.testMailSettings({ ...getAuth(), to }); toast.success(`Email de prueba enviado a ${to}`); return r; }
    catch (e) { toast.error(e?.message || 'Error enviando test'); throw e; }
  }, [getAuth]);

  const deleteMailSettings = useCallback(async () => {
    try { const r = await api.deleteMailSettings(getAuth()); toast.success('Configuración eliminada'); return r; }
    catch (e) { toast.error(e?.message || 'Error eliminando configuración'); throw e; }
  }, [getAuth]);

  return {
    // Order statuses (from MongoDB)
    orderStatuses, loadStatuses,
    // Templates
    templates, templatesLoading, loadTemplates,
    saveTemplate, removeTemplate, previewTpl, testEmail,
    // Campaigns
    campaigns, campaignsLoading, loadCampaigns,
    saveCampaign, launchCampaign, cancelCamp, removeCampaign, getCampaignStats,
    // Automations
    automations, automationsLoading, loadAutomations,
    saveAutomation, toggleAuto, removeAutomation,
    // Products & AI (for template editor)
    searchProducts, getBestsellers,
    generateMarketingImage, fetchMarketingAssets,
    // Mail settings
    loadMailSettings, saveMailSettings, testMailSettings, deleteMailSettings,
  };
}
