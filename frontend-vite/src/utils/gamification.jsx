// frontend-vite/src/utils/gamification.jsx
// API helpers organized by domain: Gamification (rules), DAO (proposals), Meritocracy (segments, batches)

import api from './api.jsx';

// ------------------------------------------------------------
// Gamification (Rules, Catalogs, Merit Preview)
// ------------------------------------------------------------

// Create or update a merit rule
export async function defineMeritRule({ rule, walletAddress, token } = {}) {
  if (!rule || typeof rule !== 'object') throw new Error('El objeto de la regla es obligatorio');
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/rules/define',
    data: rule,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// List predefined rule templates (fixed params per rule)
export async function listRuleTemplates({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/admin/gamification/rules/templates',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Define/save a rule using a predefined template
export async function defineRuleFromTemplate({ payload, walletAddress, token } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('payload es obligatorio');
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/rules/define-from-template',
    data: payload,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// List stored rules
export async function listMeritRules({ onlyActive, segmentTokenId, walletAddress, token } = {}) {
  const params = new URLSearchParams();
  if (onlyActive === true) params.append('only_active', 'true');
  if (segmentTokenId != null) params.append('segment_token_id', String(segmentTokenId));
  return api({
    method: 'GET',
    endpoint: `/admin/gamification/rules/list${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Compute a merit preview for an employee
export async function computeMeritPreview({ rut, ym, walletAddress, token } = {}) {
  if (!rut) throw new Error('rut es obligatorio');
  const params = new URLSearchParams();
  params.append('rut', rut);
  if (ym) params.append('ym', ym);
  return api({
    method: 'GET',
    endpoint: `/admin/gamification/merit/compute?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Catalogs for UI (roles/sections)
export async function listCatalogs({ q, walletAddress, token } = {}) {
  const params = new URLSearchParams();
  if (q) params.append('q', q);
  const endpoint = `/admin/gamification/catalogs${params.toString() ? `?${params.toString()}` : ''}`;
  return api({
    method: 'GET',
    endpoint,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// ------------------------------------------------------------
// DAO (Company DAO address, proposals via controller)
// ------------------------------------------------------------

// Fetch company DAO address
export async function fetchCompanyDaoAddress({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/admin/gamification/company-dao',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Bootstrap SPECIAL segments via DAO proposals (createCategoryToken for missing ones)
export async function bootstrapSpecialViaDao({ segments, walletAddress, token } = {}) {
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/segments/bootstrap-special-dao',
    data: segments ? { segments } : {},
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Propose creation of a single segment
export async function proposeCreateSegment({ name, symbol, walletAddress, token } = {}) {
  if (!name || !symbol) throw new Error('name y symbol son obligatorios');
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/segments/propose-create',
    data: { name, symbol },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// List DAO proposals from events
export async function listDaoProposals({ fromBlock, toBlock, walletAddress, token } = {}) {
  const params = new URLSearchParams();
  if (fromBlock != null) params.append('from_block', String(fromBlock));
  if (toBlock != null) params.append('to_block', String(toBlock));
  return api({
    method: 'GET',
    endpoint: `/admin/dao/proposals${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build vote transaction
export async function buildVoteTx({ proposalId, support, walletAddress, token } = {}) {
  if (proposalId == null) throw new Error('proposalId es obligatorio');
  return api({
    method: 'POST',
    endpoint: '/admin/dao/vote',
    data: { proposal_id: Number(proposalId), support: !!support },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build execute transaction
export async function buildExecuteTx({ proposalId, walletAddress, token } = {}) {
  if (proposalId == null) throw new Error('proposalId es obligatorio');
  return api({
    method: 'POST',
    endpoint: '/admin/dao/execute',
    data: { proposal_id: Number(proposalId) },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// ------------------------------------------------------------
// Meritocracy (Segments and Batch mint via DAO)
// ------------------------------------------------------------

// List segments allowed for the company DAO (rebuilt from events)
export async function listMeritSegments({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/admin/gamification/segments/list',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build TX to create a new segment by proposal
export async function buildCreateSegmentTx({ name, symbol, walletAddress, token } = {}) {
  if (!name || !symbol) throw new Error('name y symbol son obligatorios');
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/segments/create',
    data: { name, symbol },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build TX to allow company DAO in a segment
export async function buildAllowDaoTx({ tokenId, walletAddress, token } = {}) {
  if (tokenId == null) throw new Error('tokenId es obligatorio');
  return api({
    method: 'POST',
    endpoint: `/admin/gamification/segments/allow-dao?token_id=${Number(tokenId)}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// List DAOs allowed for a given segment
export async function listAllowedDaos({ tokenId, onlyCompanyEnv, walletAddress, token } = {}) {
  if (tokenId == null) throw new Error('tokenId es obligatorio');
  const params = new URLSearchParams();
  params.append('token_id', String(tokenId));
  if (onlyCompanyEnv === true) params.append('only_company_env', 'true');
  return api({
    method: 'GET',
    endpoint: `/admin/gamification/segments/allowed-daos?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Fetch dynamic SPECIAL-like user profile
export async function fetchUserSpecialProfile({ wallet, walletAddress, token } = {}) {
  if (!wallet) throw new Error('wallet es obligatorio');
  const params = new URLSearchParams();
  params.append('wallet', wallet);
  return api({
    method: 'GET',
    endpoint: `/admin/gamification/user/profile?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build TXs to authorize company DAO for all existing segments
export async function authorizeCompanyAllSegments({ walletAddress, token } = {}) {
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/segments/authorize-company-all',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Plan batch merit awards from active rules
export async function planBatchMerit({ ym, employees, walletAddress, token } = {}) {
  // employees: [{ rut, wallet }]
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/merit/plan-batch',
    data: { ym: ym || null, employees: Array.isArray(employees) ? employees : [] },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Build batch mint TXs via DAO, based on the plan
export async function buildBatchTxs({ plan, ym, employees, fast_minter_wallet, walletAddress, token } = {}) {
  const payloadPlan = plan && typeof plan === 'object'
    ? plan
    : { ym: ym || null, employees: Array.isArray(employees) ? employees : [] };
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/merit/build-batch-txs',
    data: { plan: payloadPlan, fast_minter_wallet },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Confirm a batch mint after successful on-chain TX
export async function confirmBatchMint({ tx_hash, result_ids, walletAddress, token } = {}) {
  return api({
    method: 'POST',
    endpoint: '/admin/gamification/merit/confirm-batch',
    data: { tx_hash, result_ids },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// List merit results with advanced filters (from meritocracy_kpi_results)
export async function listMeritResults({
  periodo_start,
  periodo_end,
  mint_status,
  status,
  walletAddress,
  token,
} = {}) {
  const params = new URLSearchParams();
  if (periodo_start) params.append('periodo_start', periodo_start);
  if (periodo_end) params.append('periodo_end', periodo_end);
  if (mint_status) params.append('mint_status', mint_status);
  if (status) params.append('status', status);

  const endpoint = `/admin/gamification/merit/results${params.toString() ? `?${params.toString()}` : ''}`;

  return api({
    method: 'GET',
    endpoint,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function setFastMinter({
  minterWallet,
  enabled,
  walletAddress,
  token,
} = {}) {
  if (!minterWallet) throw new Error('La dirección del minter es obligatoria');
  const params = new URLSearchParams();
  params.append('minter_wallet', minterWallet);
  params.append('enabled', String(!!enabled));
  return api({
    method: 'POST',
    endpoint: `/admin/gamification/minters/set?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function listFastMinters({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/admin/gamification/minters/list',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// ------------------------------------------------------------
// Default export (organized)
// ------------------------------------------------------------

export default {
  // Gamification
  defineMeritRule,
  listRuleTemplates,
  defineRuleFromTemplate,
  listMeritRules,
  computeMeritPreview,
  listCatalogs,
  // DAO
  fetchCompanyDaoAddress,
  bootstrapSpecialViaDao,
  proposeCreateSegment,
  listDaoProposals,
  buildVoteTx,
  buildExecuteTx,
  // Meritocracy
  listMeritSegments,
  buildCreateSegmentTx,
  buildAllowDaoTx,
  listAllowedDaos,
  fetchUserSpecialProfile,
  authorizeCompanyAllSegments,
  planBatchMerit,
  buildBatchTxs,
  confirmBatchMint,
  listMeritResults,
  setFastMinter,
  listFastMinters,
};