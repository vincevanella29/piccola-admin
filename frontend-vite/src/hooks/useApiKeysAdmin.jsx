// src/hooks/useApiKeysAdmin.jsx
// React hook para administrar API Keys, mismo estilo que useEmpresaAdmin

import { useState } from 'react';
import {
  createApiKey as apiCreateApiKey,
  listApiKeys as apiListApiKeys,
  revokeApiKey as apiRevokeApiKey,
} from '../utils/apikeys.jsx';

export function useApiKeysAdmin(appState, t) {
  const setError = appState?.setError;
  const [isLoading, setIsLoading] = useState(false);
  const [keys, setKeys] = useState([]);
  const [keysById, setKeysById] = useState({});

  const wallet = appState?.account;
  const token = appState?.token;

  // Crear API key
  const createKey = async ({ name, expiryMonths = null }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiCreateApiKey({ name, expiryMonths, walletAddress: wallet, token });
      // La respuesta contiene api_key solo una vez; agregamos entrada mínima a la lista
      const created = {
        id: resp?.id || resp?._id || resp?.key_id,
        name: resp?.name || name,
        created_at: resp?.created_at,
        expires_at: resp?.expires_at || null,
        revoked: false,
        // api_key completo disponible en resp?.api_key
      };
      // Actualizamos caches locales
      const nextById = { ...keysById };
      if (created?.id) nextById[String(created.id)] = { ...(nextById[String(created.id)] || {}), ...created };
      setKeysById(nextById);
      setKeys((prev) => {
        const seen = new Set();
        const merged = [created, ...prev].filter((it) => {
          const id = it?._id || it?.id || it?.key_id;
          if (!id) return false;
          const k = String(id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).map((it) => nextById[String(it?._id || it?.id || it?.key_id)] || it);
        return merged;
      });
      appState?.setSuccess?.(t?.('apikeys.created_success', { name }) || 'API key creada');
      return resp; // incluye api_key visible una sola vez
    } catch (err) {
      setError(t?.('apikeys.error_create', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Listar mis API keys y refrescar cache
  const listMyKeys = async () => {
    try {
      if (!wallet || !token) {
        throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      }
      const data = await apiListApiKeys({ walletAddress: wallet, token });
      const items = Array.isArray(data) ? data : (data?.items || []);
      const byId = {};
      for (const it of items) {
        const id = it?._id || it?.id || it?.key_id;
        if (id) byId[String(id)] = it;
      }
      setKeysById(byId);
      setKeys(items);
      return { items, total: items.length };
    } catch (err) {
      setError(t?.('apikeys.error_list', { message: err.message }) || err.message);
      throw err;
    }
  };

  // Revocar API key por id y refrescar
  const revokeKey = async ({ keyId }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      await apiRevokeApiKey({ keyId, walletAddress: wallet, token });
      appState?.setSuccess?.(t?.('apikeys.revoked_success') || 'API key revocada');
      // refrescar listado tras revocar
      await listMyKeys();
      return { ok: true };
    } catch (err) {
      setError(t?.('apikeys.error_revoke', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getKeyFromCache = (keyId) => {
    if (!keyId) return null;
    const k = String(keyId);
    return keysById[k] || null;
  };

  return {
    // state
    isLoading,
    keys,
    // actions
    createKey,
    listMyKeys,
    revokeKey,
    getKeyFromCache,
  };
}

export default useApiKeysAdmin;
