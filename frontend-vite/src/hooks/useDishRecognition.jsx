// src/hooks/useDishRecognition.jsx
import { useCallback, useRef, useState } from 'react';
import { matchDish, syncCatalog } from '../utils/dishes.jsx';

/**
 * Hook para:
 *  - Reindexar platos (/dishes/reindex)
 *  - Clasificar un frame (file/blob) o una URL (/dishes/match)
 *
 * Devuelve estado de loading/error/resultados y helpers para capturar un frame de <video>.
 */
export default function useDishRecognition(appState) {
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState(null); // { ok, label, topk, threshold_min }
  const [classifyError, setClassifyError] = useState(null);

  const inflightRef = useRef(null);

  // --------- Sync catálogo ----------
  const doSyncCatalog = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncInfo(null);
    try {
      const res = await syncCatalog(appState);
      setSyncInfo(res);
      return res;
    } catch (e) {
      setSyncError(e?.message || 'Error sincronizando catálogo');
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [appState]);

  // --------- Clasificar ----------
  const classifyFile = useCallback(async (file) => {
    if (!file) throw new Error('Falta archivo');
    if (inflightRef.current) return inflightRef.current;
    // Sin dependencia del estado local; el matching lo hace Vanellix AI

    setClassifying(true);
    setClassifyError(null);
    setResult(null);
    try {
      inflightRef.current = matchDish(appState, { file });
      const raw = await inflightRef.current;
      const norm = normalizeResult(raw);
      setResult(norm);
      return norm;
    } catch (e) {
      setClassifyError(e?.message || 'Error clasificando imagen');
      setResult(null);
      throw e;
    } finally {
      inflightRef.current = null;
      setClassifying(false);
    }
  }, [appState]);

  const classifyUrl = useCallback(async (imageUrl) => {
    if (!imageUrl) throw new Error('Falta image_url');
    if (inflightRef.current) return inflightRef.current;
    if (!health?.ready) throw new Error('Índice no listo. Ejecuta Reindex.');

    setClassifying(true);
    setClassifyError(null);
    setResult(null);
    try {
      inflightRef.current = matchDish(appState, { image_url: imageUrl });
      const raw = await inflightRef.current;
      const norm = normalizeResult(raw);
      setResult(norm);
      return norm;
    } catch (e) {
      setClassifyError(e?.message || 'Error clasificando por URL');
      setResult(null);
      throw e;
    } finally {
      inflightRef.current = null;
      setClassifying(false);
    }
  }, [appState]);

  // --------- Helpers para cámara ----------
  /**
   * Captura un frame de un <video> (getUserMedia) y lo devuelve como Blob JPEG.
   * @param {HTMLVideoElement} videoEl
   * @param {number} quality 0..1
   * @returns {Promise<Blob>}
   */
  const grabFrameAsBlob = useCallback(async (videoEl, quality = 0.85) => {
    if (!videoEl) throw new Error('videoEl inválido');
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob;
  }, []);

  /**
   * Captura de <video> + clasificar automáticamente.
   * @param {HTMLVideoElement} videoEl
   * @param {number} quality 0..1
   */
  const classifyFromVideo = useCallback(async (videoEl, quality = 0.85) => {
    const blob = await grabFrameAsBlob(videoEl, quality);
    // File-like para backend
    const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
    return classifyFile(file);
  }, [grabFrameAsBlob, classifyFile]);

  return {
    // Sync catálogo
    syncing,
    syncInfo,
    syncError,
    doSyncCatalog,

    // Clasificar
    classifying,
    result,         // { ok, label, topk: [{plato_id, score}], threshold_min }
    classifyError,
    classifyFile,
    classifyUrl,
    classifyFromVideo,

    // Helpers
    grabFrameAsBlob,
  };
}

function normalizeResult(raw) {
  try {
    // Expected raw from backend proxy (AI): { ok, match, score, topk }
    const topk = Array.isArray(raw?.topk) ? raw.topk : [];
    const best = raw?.match || (topk[0]?.doc ? topk[0].doc : null);
    const label = best?.nombre || best?._id || null;
    const label_info = best || null;
    const topk_info = topk.map((r) => ({ ...r }));
    const threshold_min = typeof raw?.threshold_min === 'number' ? raw.threshold_min : 0.25;
    return {
      ...raw,
      label,
      label_info,
      topk,
      topk_info,
      threshold_min,
    };
  } catch (e) {
    return raw || null;
  }
}
