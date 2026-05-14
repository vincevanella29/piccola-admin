// src/utils/communityData.jsx — API layer for Community Channels & Groups
import api, { apiform } from './api';

// ─── URL helpers ───────────────────────────────────────────────────
function getApiBase() {
  let API_URL;
  if (import.meta.env.VITE_DEV === 'true' && !window.env?.VITE_API_URL) {
    API_URL = import.meta.env.VITE_API_URL_DEV;
  } else {
    API_URL = window.env?.VITE_API_URL || import.meta.env.VITE_API_URL;
  }
  return API_URL || '';
}

function toWsUrl(path) {
  const base = getApiBase();
  const url = new URL(base);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}${url.pathname}${path}`;
}

function authHeaders(token, walletAddress) {
  return {
    ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// ─── Channels ──────────────────────────────────────────────────────

export async function fetchChannels({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/channels',
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchSuggestedChannels({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/channels/suggested',
    headers: authHeaders(token, walletAddress),
  });
}

export async function createChannel({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/community/channels',
    data,
    headers: authHeaders(token, walletAddress),
  });
}

export async function updateChannel({ token, walletAddress, slug, data }) {
  return api({
    method: 'PUT',
    endpoint: `/community/channels/${slug}`,
    data,
    headers: authHeaders(token, walletAddress),
  });
}

export async function deleteChannel({ token, walletAddress, slug }) {
  return api({
    method: 'DELETE',
    endpoint: `/community/channels/${slug}`,
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchChannelMessages({ token, walletAddress, slug, limit = 50, before = null }) {
  const params = { limit };
  if (before) params.before = before;
  return api({
    method: 'GET',
    endpoint: `/community/channels/${slug}/messages`,
    params,
    headers: authHeaders(token, walletAddress),
  });
}

export async function sendChannelMessage({ token, walletAddress, slug, text, reply_to = null, mentions = [], media_urls = [] }) {
  return api({
    method: 'POST',
    endpoint: `/community/channels/${slug}/messages`,
    data: { text, reply_to, mentions, media_urls },
    headers: authHeaders(token, walletAddress),
  });
}

export async function reactToChannelMessage({ token, walletAddress, slug, messageId, emoji }) {
  return api({
    method: 'POST',
    endpoint: `/community/channels/${slug}/messages/${messageId}/react`,
    data: { emoji },
    headers: authHeaders(token, walletAddress),
  });
}

export async function pinChannelMessage({ token, walletAddress, slug, messageId }) {
  return api({
    method: 'POST',
    endpoint: `/community/channels/${slug}/pin/${messageId}`,
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchPinnedMessages({ token, walletAddress, slug }) {
  return api({
    method: 'GET',
    endpoint: `/community/channels/${slug}/pinned`,
    headers: authHeaders(token, walletAddress),
  });
}

export async function uploadChannelMedia({ token, walletAddress, slug, file }) {
  const formData = new FormData();
  formData.append('file', file);
  return apiform({
    method: 'POST',
    endpoint: `/community/channels/${slug}/upload`,
    data: formData,
    headers: {
      ...authHeaders(token, walletAddress),
    },
  });
}

export function buildChannelWsUrl(slug) {
  return toWsUrl(`/ws/channel/${slug}`);
}

// ─── Groups ────────────────────────────────────────────────────────

export async function fetchGroups({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/groups',
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchCatalogs({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/catalogs',
    headers: authHeaders(token, walletAddress),
  });
}

export async function createGroup({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/community/groups',
    data,
    headers: authHeaders(token, walletAddress),
  });
}

export async function updateGroup({ token, walletAddress, groupId, data }) {
  return api({
    method: 'PUT',
    endpoint: `/community/groups/${groupId}`,
    data,
    headers: authHeaders(token, walletAddress),
  });
}

export async function addGroupMember({ token, walletAddress, groupId, memberWallet, role = 'member' }) {
  return api({
    method: 'POST',
    endpoint: `/community/groups/${groupId}/members`,
    data: { wallet: memberWallet, role },
    headers: authHeaders(token, walletAddress),
  });
}

export async function removeGroupMember({ token, walletAddress, groupId, memberWallet }) {
  return api({
    method: 'DELETE',
    endpoint: `/community/groups/${groupId}/members/${memberWallet}`,
    headers: authHeaders(token, walletAddress),
  });
}

export async function updateGroupMemberRole({ token, walletAddress, groupId, memberWallet, role }) {
  return api({
    method: 'PUT',
    endpoint: `/community/groups/${groupId}/roles`,
    data: { wallet: memberWallet, role },
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchGroupMessages({ token, walletAddress, groupId, limit = 50, before = null }) {
  const params = { limit };
  if (before) params.before = before;
  return api({
    method: 'GET',
    endpoint: `/community/groups/${groupId}/messages`,
    params,
    headers: authHeaders(token, walletAddress),
  });
}

export async function sendGroupMessage({ token, walletAddress, groupId, text, reply_to = null, mentions = [], media_urls = [] }) {
  return api({
    method: 'POST',
    endpoint: `/community/groups/${groupId}/messages`,
    data: { text, reply_to, mentions, media_urls },
    headers: authHeaders(token, walletAddress),
  });
}

export async function reactToGroupMessage({ token, walletAddress, groupId, messageId, emoji }) {
  return api({
    method: 'POST',
    endpoint: `/community/groups/${groupId}/messages/${messageId}/react`,
    data: { emoji },
    headers: authHeaders(token, walletAddress),
  });
}

export async function uploadGroupMedia({ token, walletAddress, groupId, file }) {
  const formData = new FormData();
  formData.append('file', file);
  return apiform({
    method: 'POST',
    endpoint: `/community/groups/${groupId}/upload`,
    data: formData,
    headers: {
      ...authHeaders(token, walletAddress),
    },
  });
}

export function buildGroupWsUrl(groupId) {
  return toWsUrl(`/ws/group/${groupId}`);
}

// ─── Community Directory ───────────────────────────────────────────

export async function fetchCommunityCatalogs({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/catalogs',
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchCommunityMembers({ token, walletAddress, seccion, cargo, q }) {
  const params = {};
  if (seccion) params.seccion = seccion;
  if (cargo) params.cargo = cargo;
  if (q) params.q = q;
  return api({
    method: 'GET',
    endpoint: '/community/members',
    params,
    headers: authHeaders(token, walletAddress),
  });
}

// ─── DMs (Direct Messages) ────────────────────────────────────────

export async function fetchDmConversations({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/dm/conversations',
    headers: authHeaders(token, walletAddress),
  });
}

export async function fetchDmMessages({ token, walletAddress, peerWallet, limit = 50, before = null }) {
  const params = { peer: peerWallet, limit };
  if (before) params.before = before;
  return api({
    method: 'GET',
    endpoint: '/community/dm/messages',
    params,
    headers: authHeaders(token, walletAddress),
  });
}

export async function sendDmMessage({ token, walletAddress, peerWallet, text }) {
  return api({
    method: 'POST',
    endpoint: '/community/dm/send',
    data: { peer: peerWallet, text },
    headers: authHeaders(token, walletAddress),
  });
}

export function buildDmWsUrl(wallet) {
  return toWsUrl(`/ws/dm/${wallet}`);
}

// ─── Presence ──────────────────────────────────────────────────────

export function buildPresenceWsUrl() {
  return toWsUrl('/ws/community/presence');
}

export async function fetchPresence({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/presence',
    headers: authHeaders(token, walletAddress),
  });
}

// ─── Section Permissions ───────────────────────────────────────────

export async function fetchSectionPerms({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/community/section-perms',
    headers: authHeaders(token, walletAddress),
  });
}

export async function updateSectionPerms({ token, walletAddress, seccion, data }) {
  return api({
    method: 'PUT',
    endpoint: `/community/section-perms/${encodeURIComponent(seccion)}`,
    data,
    headers: authHeaders(token, walletAddress),
  });
}

// ─── Gamification & Merits ─────────────────────────────────────────

// Cache for merit profiles to avoid strict mode double-fetches and spam
const profileCache = new Map();

export async function fetchMemberMeritProfile({ token, walletAddress, memberWallet, rut }) {
  if (!memberWallet && !rut) return null;
  const cacheKey = (memberWallet || rut).toLowerCase();
  const cached = profileCache.get(cacheKey);
  const now = Date.now();
  
  // Cache TTL: 10 seconds
  if (cached && (now - cached.timestamp < 10000)) {
    return cached.data;
  }

  const query = new URLSearchParams({ include_profile: 'true' });
  if (memberWallet && !memberWallet.startsWith('rut_')) {
    query.set('wallet', memberWallet);
  } else if (rut) {
    query.set('rut', rut);
  } else if (memberWallet && memberWallet.startsWith('rut_')) {
    query.set('rut', memberWallet.replace('rut_', ''));
  }

  const res = await api({
    method: 'GET',
    endpoint: `/public/merits/history?${query.toString()}`,
    headers: authHeaders(token, walletAddress),
  });

  profileCache.set(cacheKey, { data: res, timestamp: now });
  return res;
}

export async function fetchMyMerits({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/mi/meritos',
    headers: authHeaders(token, walletAddress)
  });
}
