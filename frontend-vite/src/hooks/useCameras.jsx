// src/hooks/useCameras.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listCameras,
  registerCamera,
  deleteCamera,
  uploadOvpn,
  updateVpnCreds,
  updateLocal,
  startCamera as apiStartCamera,
  stopCamera as apiStopCamera,
  ptzControl as apiPtzControl,
  toggleLive as apiToggleLive,
  listRecordings as apiListRecordings,
  cameraReady,
} from '../utils/cameras.jsx';

/**
 * Hook para gestionar cámaras (configs y acciones) vía API
 */
export default function useCameras(appState, { autoLoad = true } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCameras(appState);
      setItems(res?.data || []);
      return res;
    } catch (e) {
      setError(e?.message || 'Error listando cámaras');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [appState]);

  useEffect(() => {
    if (autoLoad) refresh().catch(() => {});
  }, [autoLoad, refresh]);

  const addCamera = useCallback(async (payload) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await registerCamera(appState, payload);
      await refresh();
      return res;
    } catch (e) {
      setSaveError(e?.message || 'Error registrando cámara');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);
  
  const ptz = useCallback(async (cid, command, duration_ms) => {
    try {
      return await apiPtzControl(appState, cid, command, duration_ms);
    } catch (e) { throw e; }
  }, [appState]);

  const startCamera = useCallback(async (cid) => {
    setSaving(true); setSaveError(null);
    try {
      return await apiStartCamera(appState, cid);
    } catch (e) {
      setSaveError(e?.message || 'Error iniciando cámara');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState]);

  const stopCamera = useCallback(async (cid) => {
    setSaving(true); setSaveError(null);
    try {
      return await apiStopCamera(appState, cid);
    } catch (e) {
      setSaveError(e?.message || 'Error deteniendo cámara');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState]);

  const removeCamera = useCallback(async (cid) => {
    setSaving(true); setSaveError(null);
    try {
      await deleteCamera(appState, cid);
      await refresh();
    } catch (e) {
      setSaveError(e?.message || 'Error eliminando cámara');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);

  const uploadCameraOvpn = useCallback(async (cid, file) => {
    if (!file) throw new Error('Falta archivo .ovpn');
    setSaving(true); setSaveError(null);
    try {
      await uploadOvpn(appState, cid, file);
      await refresh();
    } catch (e) {
      setSaveError(e?.message || 'Error subiendo OVPN');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);

  const saveVpnCreds = useCallback(async (cid, { username, password }) => {
    setSaving(true); setSaveError(null);
    try {
      await updateVpnCreds(appState, cid, { username, password });
      await refresh();
    } catch (e) {
      setSaveError(e?.message || 'Error guardando credenciales VPN');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);

  const saveLocal = useCallback(async (cid, payload) => {
    setSaving(true); setSaveError(null);
    try {
      await updateLocal(appState, cid, payload);
      await refresh();
    } catch (e) {
      setSaveError(e?.message || 'Error guardando configuración local');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);
  
  const toggleLive = useCallback(async (cid, enabled) => {
    setSaving(true); setSaveError(null);
    try {
      await apiToggleLive(appState, cid, enabled);
      await refresh();
    } catch (e) {
      setSaveError(e?.message || 'Error cambiando modo live');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [appState, refresh]);

  const listRecordings = useCallback(async (cid, { start, end }) => {
    // No usa saving global para no bloquear la UI
    try {
      return await apiListRecordings(appState, cid, { start, end });
    } catch (e) { throw e; }
  }, [appState]);

  // Helper para reproducir HLS en vivo en un elemento <video>
  const playLive = useCallback(async (videoEl, cid) => {
    if (!videoEl) throw new Error('video element requerido');
    const hlsUrl = `/streams/${cid}/index.m3u8?v=${Date.now()}`;
    try {
      const res = await cameraReady(appState, cid, 7000);
      if (!res?.ready) throw new Error('stream no listo');
    } catch (e) {
      throw e;
    }

    // Native HLS (Safari / some browsers)
    if (videoEl.canPlayType && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hlsUrl;
      await new Promise((resolve, reject) => {
        const onMeta = () => { cleanup(); resolve(); };
        const onCan = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error('HLS nativo error')); };
        const cleanup = () => {
          try { videoEl.removeEventListener('loadedmetadata', onMeta); } catch {}
          try { videoEl.removeEventListener('canplay', onCan); } catch {}
          try { videoEl.removeEventListener('error', onErr); } catch {}
          try { clearTimeout(to); } catch {}
        };
        videoEl.addEventListener('loadedmetadata', onMeta, { once: true });
        videoEl.addEventListener('canplay', onCan, { once: true });
        videoEl.addEventListener('error', onErr, { once: true });
        const to = setTimeout(() => { cleanup(); reject(new Error('timeout HLS nativo')); }, 5000);
      });
      try { await videoEl.play(); } catch {}
      return { destroy: () => { try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load?.(); } catch {} } };
    }

    // Load hls.js on demand
    const loadHlsJs = () => new Promise((resolve, reject) => {
      if (window.Hls) return resolve(window.Hls);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.async = true;
      script.onload = () => resolve(window.Hls);
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const Hls = await loadHlsJs();
    if (Hls && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 4, maxBufferLength: 12 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);
      await new Promise((resolve, reject) => {
        let done = false;
        const onParsed = () => { if (done) return; done = true; cleanup(); resolve(); };
        const onError = (e, data) => { if (done) return; if (data?.fatal) { done = true; cleanup(); reject(new Error(data?.details || 'HLS fatal')); } };
        const cleanup = () => {
          try { hls.off(Hls.Events.MANIFEST_PARSED, onParsed); } catch {}
          try { hls.off(Hls.Events.ERROR, onError); } catch {}
          try { clearTimeout(to); } catch {}
        };
        hls.on(Hls.Events.MANIFEST_PARSED, onParsed);
        hls.on(Hls.Events.ERROR, onError);
        const to = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('timeout MANIFEST')); }, 7000);
      });
      try { await videoEl.play(); } catch {}
      return { destroy: () => { try { hls.destroy(); } catch {}; try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load?.(); } catch {} } };
    }

    throw new Error('HLS no soportado por el navegador');
  }, []);

  return {
    items, loading, error, saving, saveError,
    refresh, addCamera, removeCamera, uploadCameraOvpn, saveVpnCreds,
    saveLocal, startCamera, stopCamera, ptz, toggleLive, listRecordings, playLive,
  };
}