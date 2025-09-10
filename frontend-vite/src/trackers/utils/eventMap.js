// Central event mapping for all providers
// Each mapping returns { name, params }

export const EVENT_NAMES = {
  PAGE_VIEW: 'page_view',
  VIEW_ITEM: 'view_item',
  STAKE: 'stake',
  UNSTAKE: 'unstake',
  CLAIM_STAKE: 'claim_stake',
  WALLET_CREATED: 'wallet_created',
  TRANSFER: 'transfer',
  FUNDING_START: 'funding_start',
  FUNDING_COMPLETED: 'funding_completed',
  FUNDING_FAILED: 'funding_failed',
  SWAP: 'swap',
};

// Common normalization helpers
function baseParams(payload = {}, ctx = {}) {
  return {
    wallet: ctx?.user?.walletAddress || ctx?.user?.wallet || undefined,
    ...payload,
  };
}

export const firebaseEventMap = {
  [EVENT_NAMES.PAGE_VIEW]: (payload, ctx) => ({ name: 'page_view', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.VIEW_ITEM]: (payload, ctx) => ({ name: 'view_item', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.STAKE]: (payload, ctx) => ({ name: 'stake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.UNSTAKE]: (payload, ctx) => ({ name: 'unstake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.CLAIM_STAKE]: (payload, ctx) => ({ name: 'claim_stake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.WALLET_CREATED]: (payload, ctx) => ({ name: 'wallet_created', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.TRANSFER]: (payload, ctx) => ({ name: 'transfer', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_START]: (payload, ctx) => ({ name: 'funding_start', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_COMPLETED]: (payload, ctx) => ({ name: 'funding_completed', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_FAILED]: (payload, ctx) => ({ name: 'funding_failed', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.SWAP]: (payload, ctx) => ({ name: 'swap', params: baseParams(payload, ctx) }),
};

export const gaEventMap = {
  [EVENT_NAMES.PAGE_VIEW]: (payload, ctx) => ({ name: 'page_view', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.VIEW_ITEM]: (payload, ctx) => ({ name: 'view_item', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.STAKE]: (payload, ctx) => ({ name: 'stake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.UNSTAKE]: (payload, ctx) => ({ name: 'unstake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.CLAIM_STAKE]: (payload, ctx) => ({ name: 'claim_stake', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.WALLET_CREATED]: (payload, ctx) => ({ name: 'wallet_created', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.TRANSFER]: (payload, ctx) => ({ name: 'transfer', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_START]: (payload, ctx) => ({ name: 'funding_start', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_COMPLETED]: (payload, ctx) => ({ name: 'funding_completed', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.FUNDING_FAILED]: (payload, ctx) => ({ name: 'funding_failed', params: baseParams(payload, ctx) }),
  [EVENT_NAMES.SWAP]: (payload, ctx) => ({ name: 'swap', params: baseParams(payload, ctx) }),
};

export function getProviderEventMap(service) {
  if (service === 'firebase') return firebaseEventMap;
  if (service === 'analytics') return gaEventMap;
  return {};
}
