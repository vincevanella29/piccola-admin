// src/hooks/useDaoMeritocracy.jsx
// Hook para DAO + Meritocracy (segmentos, proposals, batch)

import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { getContractInstance } from '../context/contracts';
import {
  listMeritSegments as apiListMeritSegments,
  fetchCompanyDaoAddress as apiFetchCompanyDaoAddress,
  buildCreateSegmentTx as apiBuildCreateSegmentTx,
  buildAllowDaoTx as apiBuildAllowDaoTx,
  listAllowedDaos as apiListAllowedDaos,
  fetchUserSpecialProfile as apiFetchUserSpecialProfile,
  bootstrapSpecialViaDao as apiBootstrapSpecialViaDao,
  authorizeCompanyAllSegments as apiAuthorizeCompanyAllSegments,
  planBatchMerit as apiPlanBatchMerit,
  buildBatchTxs as apiBuildBatchTxs,
  confirmBatchMint as apiConfirmBatchMint,
  listDaoProposals as apiListDaoProposals,
  buildVoteTx as apiBuildVoteTx,
  buildExecuteTx as apiBuildExecuteTx,
  listFastMinters as apiListFastMinters,
  setFastMinter as apiSetFastMinter,
} from '../utils/gamification.jsx';

export function useDaoMeritocracy(appState, t) {
  const [isLoading, setIsLoading] = useState(false);
  const [segments, setSegments] = useState([]);
  const [fastMinters, setFastMinters] = useState([]);
  const CACHE_TTL_MS = 30000; // 30s
  const cacheRef = useRef({
    segments: { ts: 0, data: null },
    fastMinters: { ts: 0, data: null },
  });
  const now = () => Date.now();
  const isFresh = (ts) => ts && (now() - ts) < CACHE_TTL_MS;

  const {
    account: wallet,
    walletAddress,
    token,
    sendTx,
    setError,
    setSuccess,
    blockExplorer,
    provider,
  } = appState || {};

  const effectiveWallet = wallet || walletAddress;

  const handleApiCall = useCallback(async (apiFunc, options = {}) => {
    const { successMsg, errorMsg, setLoading = true } = options;
    if (!effectiveWallet || !token) {
      toast.error(t?.('wallet.connect_wallet') || 'Por favor, conecta tu wallet.');
      throw new Error('Wallet not connected');
    }
    if (setLoading) setIsLoading(true);
    try {
      const res = await apiFunc();
      if (successMsg) toast.success(successMsg);
      return res?.data || res;
    } catch (err) {
      const msg = err?.message || 'Error';
      toast.error(errorMsg ? (t?.(errorMsg, { message: msg }) || msg) : msg);
      throw err;
    } finally {
      if (setLoading) setIsLoading(false);
    }
  }, [effectiveWallet, token, t]);

  // Segments (contract-direct) built by backend
  const createSegmentViaBackend = useCallback(async ({ name, symbol }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    try {
      const res = await apiBuildCreateSegmentTx({ name, symbol, walletAddress: effectiveWallet, token });
      console.log('createSegmentViaBackend', res);
      const tx = res?.data?.transaction || res?.transaction;
      if (!tx) throw new Error('TX no recibida del backend');
      const hash = await sendTx(tx, appState);
      if (!hash) throw new Error('La transacción fue rechazada o no se envió');
      setSuccess?.(t?.('gamification.segment_tx_sent', { hash }) || `Tx enviada: ${hash}`, hash, blockExplorer ? `${blockExplorer}/tx/${hash}` : undefined);
      setTimeout(() => { listSegments({ forceRefresh: true }).catch(() => {}); }, 6000);
      return { ok: true, hash };
    } catch (err) {
      const msg = err?.message || 'Error al crear el segmento (backend)';
      setError?.(t?.('gamification.error_create_segment', { message: msg }) || msg);
      throw err;
    }
  }, [provider, sendTx, effectiveWallet, token, t, setSuccess, blockExplorer]);

  const allowDaoInSegmentViaBackend = useCallback(async ({ tokenId }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    try {
      const res = await apiBuildAllowDaoTx({ tokenId, walletAddress: effectiveWallet, token });
      const tx = res?.data?.transaction || res?.transaction;
      if (!tx) throw new Error('TX no recibida del backend');
      const hash = await sendTx(tx, appState);
      if (!hash) throw new Error('Transaction rejected');
      toast.success(t?.('segments.tx_sent') || 'Transacción enviada');
      return { hash };
    } catch (err) {
      toast.error(err?.message || 'Error al autorizar la DAO (backend)');
      throw err;
    }
  }, [provider, sendTx, effectiveWallet, token, t]);

  // Segment create/allow (backend-built only)
  const createSegment = useCallback(async ({ name, symbol }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    try {
      const res = await apiBuildCreateSegmentTx({ name, symbol, walletAddress: effectiveWallet, token });
      const tx = res?.data?.transaction || res?.transaction;
      if (!tx) throw new Error('TX no recibida del backend');
      const hash = await sendTx(tx, appState);
      if (!hash) throw new Error('La transacción fue rechazada o no se envió');
      setSuccess?.(t?.('gamification.segment_tx_sent', { hash }) || `Tx enviada: ${hash}`, hash, blockExplorer ? `${blockExplorer}/tx/${hash}` : undefined);
      setTimeout(() => { listSegments().catch(() => {}); }, 6000);
      return { ok: true, hash };
    } catch (err) {
      const msg = err?.message || 'Error al crear el segmento (backend)';
      setError?.(t?.('gamification.error_create_segment', { message: msg }) || msg);
      throw err;
    }
  }, [provider, sendTx, effectiveWallet, token, t, setSuccess, blockExplorer]);

  const allowDaoInSegment = useCallback(async ({ token_id }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    try {
      console.log('allowDaoInSegment', token_id);
      const res = await apiBuildAllowDaoTx({ tokenId: token_id, walletAddress: effectiveWallet, token });
      const tx = res?.data?.transaction || res?.transaction;
      if (!tx) throw new Error('TX no recibida del backend');
      const hash = await sendTx(tx, appState);
      if (!hash) throw new Error('Transaction rejected');
      toast.success(t?.('segments.tx_sent') || 'Transacción enviada');
      return { hash };
    } catch (err) {
      toast.error(err?.message || 'Error al autorizar la DAO (backend)');
      throw err;
    }
  }, [provider, sendTx, effectiveWallet, token, t]);

  // List/Allowed/Profile
  const listAllowedDaosForSegment = useCallback(async ({ tokenId, onlyCompanyEnv = true }) => {
    const res = await apiListAllowedDaos({ tokenId, onlyCompanyEnv, walletAddress: effectiveWallet, token });
    return res?.data || res;
  }, [effectiveWallet, token]);

  const fetchUserSpecialProfileAction = useCallback(async ({ wallet: targetWallet }) => {
    const res = await apiFetchUserSpecialProfile({ wallet: targetWallet, walletAddress: effectiveWallet, token });
    return res?.data || res;
  }, [effectiveWallet, token]);

  // Batch helpers
  const sendTxBundle = useCallback(async (txs = [], { title = 'Batch' } = {}) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    const hashes = [];
    for (const item of txs) {
      const tx = item?.tx || item;
      if (!tx) continue;
      const hash = await sendTx(tx, appState);
      if (hash) {
        hashes.push(hash);
        toast.success(`${title}: ${hash}`);
      }
    }
    return hashes;
  }, [provider, sendTx, t]);

  // DAO proposals
  const bootstrapSpecialBuild = useCallback(async ({ segments } = {}) => {
    const res = await apiBootstrapSpecialViaDao({ segments, walletAddress: effectiveWallet, token });
    return res?.data || res;
  }, [effectiveWallet, token]);

  const authorizeCompanyAllBuild = useCallback(async () => {
    const res = await apiAuthorizeCompanyAllSegments({ walletAddress: effectiveWallet, token });
    return res?.data || res;
  }, [effectiveWallet, token]);

  const bootstrapSpecialExecute = useCallback(async ({ segments } = {}) => {
    const payload = await bootstrapSpecialBuild({ segments });
    const proposals = payload?.proposals || [];
    if (proposals.length) {
      await sendTxBundle(proposals.map(p => p.tx || p), { title: 'Propose Create Segment' });
      await new Promise(r => setTimeout(r, 8000));
    }
    const authAll = await authorizeCompanyAllBuild();
    const allTxs = authAll?.authorizeTransactions || [];
    if (allTxs.length) {
      await sendTxBundle(allTxs, { title: 'Authorize DAO (All)' });
    }
    await listSegments({ forceRefresh: true }).catch(() => {});
    return { ok: true };
  }, [bootstrapSpecialBuild, sendTxBundle, authorizeCompanyAllBuild]);

  // DAO Proposals: list, vote, execute
  const listDaoProposals = useCallback(async ({ fromBlock, toBlock } = {}) => {
    const res = await apiListDaoProposals({ fromBlock, toBlock, walletAddress: effectiveWallet, token });
    return res?.data || res;
  }, [effectiveWallet, token]);

  const voteProposal = useCallback(async ({ proposalId, support }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    const res = await apiBuildVoteTx({ proposalId, support, walletAddress: effectiveWallet, token });
    const tx = res?.data?.tx || res?.tx;
    if (!tx) throw new Error('TX no recibida del backend');
    const hash = await sendTx(tx, appState);
    if (!hash) throw new Error('Transaction failed or was rejected.');
    return hash;
  }, [provider, sendTx, effectiveWallet, token, t]);

  const executeProposal = useCallback(async ({ proposalId }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    const res = await apiBuildExecuteTx({ proposalId, walletAddress: effectiveWallet, token });
    const tx = res?.data?.tx || res?.tx;
    if (!tx) throw new Error('TX no recibida del backend');
    const hash = await sendTx(tx, appState);
    if (!hash) throw new Error('Transaction failed or was rejected.');
    return hash;
  }, [provider, sendTx, effectiveWallet, token, t]);

  // Listing segments
  const listSegments = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!effectiveWallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
    const cache = cacheRef.current.segments;
    if (!forceRefresh && cache.data && isFresh(cache.ts)) {
      if (!segments?.length) setSegments(cache.data);
      return { segments: cache.data };
    }
    const res = await apiListMeritSegments({ walletAddress: effectiveWallet, token });
    console.log('listSegments', res);
    const items = res?.data?.segments || res?.segments || [];
    setSegments(items);
    cacheRef.current.segments = { ts: now(), data: items };
    return res?.data || res;
  }, [effectiveWallet, token, t, segments]);

  // Batch merit
  const planBatch = useCallback(async ({ ym, employees } = {}) => {
    return handleApiCall(() => apiPlanBatchMerit({ ym, employees, walletAddress: effectiveWallet, token }));
  }, [handleApiCall, effectiveWallet, token]);

  const buildBatch = useCallback(async ({ plan, ym, employees, fast_minter_wallet } = {}) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    // Paso 1: construir TX en backend
    toast.info(t?.('gamification.merit.building_tx') || 'Construyendo transacción...');
    const payloadPlan = plan && typeof plan === 'object' ? plan : { ym: ym || null, employees: Array.isArray(employees) ? employees : [] };
    const buildRes = await apiBuildBatchTxs({ plan: payloadPlan, fast_minter_wallet, walletAddress: effectiveWallet, token });
    const transaction = buildRes?.data?.transaction || buildRes?.transaction || null;
    const resultIds = buildRes?.data?.result_ids_in_plan || buildRes?.result_ids_in_plan || [];
    if (!transaction || !resultIds?.length) {
      throw new Error('No se pudo construir la transacción desde el backend');
    }

    // Paso 2: firmar/enviar TX
    toast.info(t?.('gamification.merit.signing_tx') || 'Por favor, firma la transacción en tu wallet...');
    const hash = await sendTx(transaction, appState);
    const txHash = typeof hash === 'string' ? hash : (hash?.hash || hash?.transactionHash || null);
    if (!txHash) {
      throw new Error('La transacción fue rechazada o cancelada.');
    }
    toast.success(t?.('gamification.merit.tx_success', { hash: txHash }) || `¡Transacción enviada! Hash: ${String(txHash).slice(0, 10)}...`);

    // Paso 3: confirmar en backend (marcar BD)
    try {
      await apiConfirmBatchMint({ tx_hash: txHash, result_ids: resultIds, walletAddress: effectiveWallet, token });
      toast.success(t?.('gamification.merit.db_updated') || '¡Base de datos actualizada!');
    } catch (e) {
      toast.error(t?.('gamification.merit.db_update_error') || 'Error CRÍTICO: La transacción se envió pero no se pudo actualizar la base de datos.');
      throw e;
    }

    return { ok: true, hash: txHash, confirmed_count: resultIds.length };
  }, [provider, sendTx, t, appState, effectiveWallet, token]);

  const listFastMinters = useCallback(async ({ forceRefresh = false } = {}) => {
    const cache = cacheRef.current.fastMinters;
    if (!forceRefresh && cache.data && isFresh(cache.ts)) {
      if (!fastMinters?.length) setFastMinters(cache.data);
      return cache.data;
    }
    const res = await handleApiCall(() => apiListFastMinters({ walletAddress: effectiveWallet, token }));
    const items = res?.fastMinters || res?.data?.fastMinters || [];
    const arr = Array.isArray(items) ? items : [];
    setFastMinters(arr);
    cacheRef.current.fastMinters = { ts: now(), data: arr };
    return arr;
  }, [handleApiCall, effectiveWallet, token, fastMinters]);

  // --- FUNCIÓN CORREGIDA ---
  const setFastMinter = useCallback(async ({ minterWallet, enabled }) => {
    if (!provider || typeof sendTx !== 'function') {
      toast.error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      throw new Error('Wallet/provider not ready');
    }
    const res = await apiSetFastMinter({ minterWallet, enabled, walletAddress: effectiveWallet, token });
    // Corregido: el campo es 'transaction'
    const tx = res?.transaction || res?.data?.transaction;
    if (!tx) throw new Error('TX no recibida del backend');
    
    const hash = await sendTx(tx, appState);
    if (!hash) throw new Error('Transaction failed or was rejected.');
    
    toast.success(t('gamification.minter.tx_sent') || 'Transacción enviada!');
    
    // ¡LA MAGIA! Refrescamos la lista después de un tiempo prudente
    setTimeout(() => {
      toast.info(t('gamification.minter.refreshing_list') || 'Actualizando lista de minters...');
      listFastMinters({ forceRefresh: true }).catch(console.error);
    }, 6000);
    
    return hash;
  }, [provider, sendTx, effectiveWallet, token, t, listFastMinters]);

  return {
    // Estado
    isLoading,
    segments,
    fastMinters,
    // Segmentos directos
    createSegment,
    allowDaoInSegment,
    listSegments,
    // Segmentos vía backend
    createSegmentViaBackend,
    allowDaoInSegmentViaBackend,
    // Listados y perfiles
    listAllowedDaosForSegment,
    fetchUserSpecialProfileAction,
    // DAO proposals + autorizar masivo
    bootstrapSpecialBuild,
    authorizeCompanyAllBuild,
    bootstrapSpecialExecute,
    // DAO governance
    listDaoProposals,
    voteProposal,
    executeProposal,
    // Batch merit
    planBatch,
    buildBatch,
    // Fast minter
    setFastMinter,
    listFastMinters,
  };
}

export default useDaoMeritocracy;
