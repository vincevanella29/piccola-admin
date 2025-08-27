import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import appData from '../utils/appData.jsx';

/**
 * useTelegramLinkAuth
 * - Lee tg_id y state desde la URL (?tg_id=...&state=...)
 * - Espera a que isWalletDataReady sea true y que exista accessToken + account
 * - Verifica role (nivel 3 o 4) usando roleLevel si está disponible; si no, consulta al backend
 * - Si cumple, llama a /api/telegram/link/confirm para persistir el vínculo
 * - Limpia los query params de la URL al terminar
 */
export default function useTelegramLinkAuth({
  isWalletDataReady,
  account,
  accessToken,
  roleLevel,
  setSuccess,
  setError,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ handled: false, success: false, message: '' });
  const inFlight = useRef(false);

  useEffect(() => {
    // 1) Intentar leer de query string normal
    let params = new URLSearchParams(location.search || '');
    let tg_id = params.get('tg_id');
    let state = params.get('state');

    // 2) Si no están, intentar desde el hash (p.ej. #/?tg_id=...&state=...)
    if ((!tg_id || !state) && typeof window !== 'undefined' && window.location?.hash) {
      try {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashUrl = new URL(hash, window.location.origin);
        const hashParams = new URLSearchParams(hashUrl.search || '');
        tg_id = tg_id || hashParams.get('tg_id');
        state = state || hashParams.get('state');
      } catch {}
    }

    // 3) Persistir en sessionStorage si los vemos (para usarlos cuando la wallet esté lista)
    if (tg_id && state && typeof window !== 'undefined') {
      sessionStorage.setItem('tg_link_tg_id', tg_id);
      sessionStorage.setItem('tg_link_state', state);
    } else if (typeof window !== 'undefined') {
      // Intentar recuperar si ya los capturamos antes
      const s_tg = sessionStorage.getItem('tg_link_tg_id');
      const s_state = sessionStorage.getItem('tg_link_state');
      if (s_tg && s_state) {
        tg_id = s_tg;
        state = s_state;
      }
    }

    console.debug('[useTelegramLinkAuth] params', { tg_id, state });
    if (!tg_id || !state) return; // No hay flujo de link
    if (!isWalletDataReady || !account || !accessToken) {
      console.debug('[useTelegramLinkAuth] waiting wallet/session', { isWalletDataReady, hasAccount: !!account, hasAccessToken: !!accessToken });
      return; // Esperar a la sesión
    }
    if (inFlight.current) return;

    const confirm = async () => {
      inFlight.current = true;
      try {
        console.debug('[useTelegramLinkAuth] starting confirm flow');
        if (setSuccess) setSuccess('Vinculando tu cuenta de Telegram...');
        // 1) Determinar rol efectivo
        let lvl = Number.isInteger(roleLevel) ? roleLevel : null;
        if (lvl === null) {
          try {
            const r = await appData.fetchUserRole({ accessToken, walletAddress: account });
            lvl = r?.role_level;
          } catch (e) {
            // Si no podemos leer el rol, bloquear
            throw new Error('No se pudo validar tu nivel de rol.');
          }
        }

        // 2) Validar rol 3 o 4
        if (lvl !== 3 && lvl !== 4) {
          throw new Error('Tu wallet no tiene permisos para vincular el bot (se requiere nivel 3 o 4).');
        }

        // 3) Confirmar link con backend
        console.debug('[useTelegramLinkAuth] calling telegramLinkConfirm', { tg_id, state });
        const resp = await appData.telegramLinkConfirm({
          accessToken,
          wallet: account,
          tg_id,
          state,
        });
        console.debug('[useTelegramLinkAuth] confirm response', resp);

        setStatus({ handled: true, success: true, message: '¡Listo! Tu Telegram quedó vinculado. Ya puedes hablar con la Nonna.' });
        if (setSuccess) setSuccess('¡Listo! Tu Telegram quedó vinculado. Ya puedes hablar con la Nonna.');
      } catch (err) {
        const msg = err?.message || 'Error vinculando tu Telegram.';
        setStatus({ handled: true, success: false, message: msg });
        if (setError) setError(msg);
      } finally {
        // 4) Limpiar los query params de la URL para evitar reintentos accidentales
        try {
          const newSearch = new URLSearchParams(location.search);
          newSearch.delete('tg_id');
          newSearch.delete('state');
          navigate({ pathname: location.pathname, search: newSearch.toString() ? `?${newSearch}` : '' }, { replace: true });
          // También limpiar el hash y sessionStorage
          if (typeof window !== 'undefined') {
            if (window.location.hash.includes('tg_id') || window.location.hash.includes('state')) {
              window.location.hash = '';
            }
            sessionStorage.removeItem('tg_link_tg_id');
            sessionStorage.removeItem('tg_link_state');
          }
        } catch {}
        inFlight.current = false;
      }
    };

    confirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, isWalletDataReady, account, accessToken]);

  return status; // { handled, success, message }
}
