// hooks/delivery/useDeliveryHome.jsx
// Hook for delivery home config management
// Used by: pages/delivery/DeliveryHome.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../../utils/deliveryData.jsx';

const useDeliveryHome = (appState, t) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // ─── Load config ────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.fetchDeliveryHomeConfig(getAuth());
      setConfig(res);
    } catch (err) {
      console.warn('[useDeliveryHome] fetch error:', err);
      setConfig({
        hero_banners: [],
        featured_promos: [],
        featured_categories: [],
        announcement: { text: '', active: false },
      });
    }
    setLoading(false);
  }, [getAuth]);

  // ─── Save config ────────────────────────────────────────────
  const saveConfig = useCallback(async (data) => {
    setSaving(true);
    try {
      await deliveryApi.updateDeliveryHomeConfig({ ...getAuth(), data });
      toast.success('✅ Configuración guardada');
      await fetchConfig();
    } catch (err) {
      toast.error(err?.message || 'Error al guardar');
    }
    setSaving(false);
  }, [getAuth, fetchConfig]);

  // ─── Upload image ───────────────────────────────────────────
  const uploadImage = useCallback(async (file) => {
    setUploading(true);
    try {
      const res = await deliveryApi.uploadDeliveryHomeImage({ ...getAuth(), file });
      setUploading(false);
      return res.url;
    } catch (err) {
      toast.error('Error al subir imagen');
      setUploading(false);
      return null;
    }
  }, [getAuth]);

  // ─── Publish to providers ───────────────────────────────────
  const publish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await deliveryApi.publishDeliveryHome(getAuth());
      toast.success(`🚀 ${res.message || 'Publicado'}`);
      return res;
    } catch (err) {
      toast.error(err?.message || 'Error al publicar');
      return null;
    } finally {
      setPublishing(false);
    }
  }, [getAuth]);

  // ─── Local state mutators ───────────────────────────────────
  const updateBanners = useCallback((banners) => {
    setConfig(prev => ({ ...prev, hero_banners: banners }));
  }, []);

  const updatePromos = useCallback((promos) => {
    setConfig(prev => ({ ...prev, featured_promos: promos }));
  }, []);

  const updateAnnouncement = useCallback((announcement) => {
    setConfig(prev => ({ ...prev, announcement }));
  }, []);

  const updateFeaturedCategories = useCallback((categories) => {
    setConfig(prev => ({ ...prev, featured_categories: categories }));
  }, []);

  // ─── Templates ──────────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [uploadingTemplates, setUploadingTemplates] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchDeliveryHomeTemplates(getAuth());
      setTemplates(res.templates || []);
    } catch (err) {
      console.warn('[useDeliveryHome] templates error:', err);
    }
  }, [getAuth]);

  const uploadAllTemplates = useCallback(async () => {
    setUploadingTemplates(true);
    try {
      const res = await deliveryApi.uploadAllTemplatesToR2(getAuth());
      toast.success(`📦 ${res.message || 'Templates subidos'}`);

      // Update defaults with R2 URLs if available
      if (res.results?.length) {
        const urlMap = {};
        res.results.forEach(r => { if (r.ok) urlMap[r.filename] = r.url; });

        // Auto-update banner/promo images to use R2 URLs
        if (config) {
          const updated = { ...config };
          let changed = false;

          updated.hero_banners = (updated.hero_banners || []).map(b => {
            const fname = b.image?.split('/').pop();
            if (fname && urlMap[fname]) { changed = true; return { ...b, image: urlMap[fname] }; }
            return b;
          });
          updated.featured_promos = (updated.featured_promos || []).map(p => {
            const fname = p.image?.split('/').pop();
            if (fname && urlMap[fname]) { changed = true; return { ...p, image: urlMap[fname] }; }
            return p;
          });
          if (changed) setConfig(updated);
        }
      }
      return res;
    } catch (err) {
      toast.error('Error al subir templates');
      return null;
    } finally {
      setUploadingTemplates(false);
    }
  }, [getAuth, config]);

  return {
    config, loading, saving, publishing, uploading,
    fetchConfig, saveConfig, uploadImage, publish,
    updateBanners, updatePromos, updateAnnouncement, updateFeaturedCategories,
    templates, uploadingTemplates, fetchTemplates, uploadAllTemplates,
  };
};

export default useDeliveryHome;
