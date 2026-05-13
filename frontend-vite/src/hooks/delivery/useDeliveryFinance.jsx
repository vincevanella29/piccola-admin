// hooks/delivery/useDeliveryFinance.jsx
// Hook for finance — closings, entries, summary
// Used by: pages/delivery/DeliveryFinance.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../../utils/deliveryData.jsx';

const useDeliveryFinance = (appState, t) => {
  const [providers, setProviders] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [summary, setSummary] = useState(null);
  const [closings, setClosings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // ─── Load providers ─────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchProviders(getAuth());
      const provs = res.providers || [];
      setProviders(provs);
      if (provs.length > 0 && !selectedSlug) {
        setSelectedSlug(provs[0].slug);
      }
      return provs;
    } catch (err) {
      console.warn('[useDeliveryFinance] providers error:', err);
      return [];
    }
  }, [getAuth, selectedSlug]);

  // ─── Load finance data ──────────────────────────────────────
  const fetchFinanceData = useCallback(async (slug) => {
    const s = slug || selectedSlug;
    if (!s) return;
    setLoading(true);
    try {
      const [sumRes, closRes, entRes] = await Promise.all([
        deliveryApi.fetchFinanceSummary({ ...getAuth(), providerSlug: s }),
        deliveryApi.fetchFinanceClosings({ ...getAuth(), providerSlug: s }),
        deliveryApi.fetchFinanceEntries({ ...getAuth(), providerSlug: s }),
      ]);
      setSummary(sumRes);
      setClosings(closRes.closings || []);
      setEntries(entRes.entries || []);
    } catch (err) {
      console.warn('[useDeliveryFinance] finance data error:', err);
    }
    setLoading(false);
  }, [getAuth, selectedSlug]);

  // ─── Closing preview ───────────────────────────────────────
  const fetchPreview = useCallback(async (periodFrom, periodTo) => {
    if (!periodFrom || !periodTo) return;
    setPreviewLoading(true);
    try {
      const res = await deliveryApi.fetchClosingPreview({
        ...getAuth(), providerSlug: selectedSlug, periodFrom, periodTo,
      });
      setPreview(res.preview);
    } catch (err) {
      toast.error(err?.message || 'Error al previsualizar');
    }
    setPreviewLoading(false);
  }, [getAuth, selectedSlug]);

  // ─── Generate closing ──────────────────────────────────────
  const handleGenerateClosing = useCallback(async (periodFrom, periodTo) => {
    try {
      await deliveryApi.generateClosing({
        ...getAuth(), providerSlug: selectedSlug, periodFrom, periodTo,
      });
      toast.success('✅ Cierre generado');
      setPreview(null);
      await fetchFinanceData();
    } catch (err) {
      toast.error(err?.message || 'Error al generar cierre');
    }
  }, [getAuth, selectedSlug, fetchFinanceData]);

  // ─── Update closing status ─────────────────────────────────
  const handleClosingStatus = useCallback(async (closingId, status) => {
    try {
      await deliveryApi.updateClosingStatus({ ...getAuth(), closingId, status });
      toast.success(`Estado → ${status}`);
      await fetchFinanceData();
    } catch (err) {
      toast.error(err?.message || 'Error');
    }
  }, [getAuth, fetchFinanceData]);

  // ─── Delete closing ────────────────────────────────────────
  const handleDeleteClosing = useCallback(async (closingId) => {
    try {
      await deliveryApi.deleteClosing({ ...getAuth(), closingId });
      toast.success('Cierre eliminado');
      await fetchFinanceData();
    } catch (err) {
      toast.error(err?.message || 'Error');
    }
  }, [getAuth, fetchFinanceData]);

  // ─── Create entry ──────────────────────────────────────────
  const handleCreateEntry = useCallback(async (entryData) => {
    try {
      await deliveryApi.createFinanceEntry({
        ...getAuth(),
        data: { provider_slug: selectedSlug, ...entryData },
      });
      toast.success('✅ Pago registrado');
      await fetchFinanceData();
      return true;
    } catch (err) {
      toast.error(err?.message || 'Error');
      return false;
    }
  }, [getAuth, selectedSlug, fetchFinanceData]);

  // ─── Delete entry ──────────────────────────────────────────
  const handleDeleteEntry = useCallback(async (entryId) => {
    try {
      await deliveryApi.deleteFinanceEntry({ ...getAuth(), entryId });
      await fetchFinanceData();
      return true;
    } catch (err) {
      toast.error('Error');
      return false;
    }
  }, [getAuth, fetchFinanceData]);

  // ─── Export URL ────────────────────────────────────────────
  const getExportUrl = useCallback((periodFrom, periodTo) => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}/delivery/finance/export?provider_slug=${selectedSlug}&period_from=${periodFrom}&period_to=${periodTo}`;
  }, [selectedSlug]);

  return {
    providers, selectedSlug, setSelectedSlug,
    summary, closings, entries, preview, loading, previewLoading,
    fetchProviders, fetchFinanceData, fetchPreview,
    handleGenerateClosing, handleClosingStatus, handleDeleteClosing,
    handleCreateEntry, handleDeleteEntry, getExportUrl,
    setPreview,
  };
};

export default useDeliveryFinance;
