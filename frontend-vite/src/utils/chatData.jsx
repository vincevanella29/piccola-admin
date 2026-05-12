import api from './api';

// Helper to build WS base from same env logic as api.jsx
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
  // Convert http(s) -> ws(s)
  const url = new URL(base);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}${url.pathname}${path}`;
}

// Client: start a new conversation session
export async function startChatSession({ token, walletAddress, metadata = {} }) {
  return api({
    method: 'POST',
    endpoint: '/chat/session/start',
    data: { metadata },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Client: send a message to a conversation
export async function sendChatMessage({ token, walletAddress, convId, text, metadata = {} }) {
  return api({
    method: 'POST',
    endpoint: '/chat/message',
    data: { conv_id: convId, text, metadata },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Client: fetch conversation history
export async function fetchChatHistory({ token, walletAddress, convId }) {
  return api({
    method: 'GET',
    endpoint: '/chat/history',
    params: { conv_id: convId },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Client: list user's conversations
export async function fetchChatConversations({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/chat/conversations',
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Client: fetch user's latest conversation (prefers open)
export async function fetchLastConversation({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/chat/last',
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: list conversations
export async function adminListChats({ token, walletAddress, status = 'open', limit = 50, offset = 0 }) {
  const params = {};
  if (status && status !== 'all') params.status = status;
  if (limit) params.limit = limit;
  if (typeof offset === 'number' && offset > 0) params.offset = offset;
  return api({
    method: 'GET',
    endpoint: '/admin/chats',
    params,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: take conversation (switch to human)
export async function adminTakeChat({ token, walletAddress, convId, reason = null }) {
  return api({
    method: 'POST',
    endpoint: `/admin/chats/${convId}/take`,
    data: { reason },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: release conversation (back to bot)
export async function adminReleaseChat({ token, walletAddress, convId, reason = null }) {
  return api({
    method: 'POST',
    endpoint: `/admin/chats/${convId}/release`,
    data: { reason },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: close conversation
export async function adminCloseChat({ token, walletAddress, convId }) {
  return api({
    method: 'POST',
    endpoint: `/admin/chats/${convId}/close`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: reply in conversation
export async function adminReplyChat({ token, walletAddress, convId, text }) {
  return api({
    method: 'POST',
    endpoint: `/admin/chats/${convId}/reply`,
    data: { text },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: fetch conversation history (enriched with sender_name, sender_avatar_url)
export async function adminFetchChatHistory({ token, walletAddress, convId }) {
  return api({
    method: 'GET',
    endpoint: `/admin/chats/${convId}/history`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// Admin: fetch participants for a conversation (full user profile for modal)
export async function adminFetchParticipants({ token, walletAddress, convId }) {
  return api({
    method: 'GET',
    endpoint: `/admin/chats/${convId}/participants`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

// WS URL helpers (client/admin)
export function buildClientWsUrl(convId) {
  return toWsUrl(`/ws/chat/${convId}`);
}

export function buildAdminWsUrl(convId) {
  return toWsUrl(`/ws/admin/${convId}`);
}

export function buildAdminListWsUrl() {
  return toWsUrl(`/ws/admin/list`);
}


// ─── Delivery Chat (admin) ─────────────────────────────────────────

export async function deliveryListChats({ token, walletAddress, status = 'open', limit = 50, offset = 0 }) {
  const params = {};
  if (status && status !== 'all') params.status = status;
  if (limit) params.limit = limit;
  if (typeof offset === 'number' && offset > 0) params.offset = offset;
  return api({
    method: 'GET',
    endpoint: '/delivery/chats',
    params,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function deliveryFetchHistory({ token, walletAddress, orderNumber }) {
  return api({
    method: 'GET',
    endpoint: `/delivery/chats/${orderNumber}/history`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function deliveryReplyChat({ token, walletAddress, orderNumber, text }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/chats/${orderNumber}/reply`,
    data: { text },
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function deliveryTakeChat({ token, walletAddress, orderNumber }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/chats/${orderNumber}/take`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function deliveryReleaseChat({ token, walletAddress, orderNumber }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/chats/${orderNumber}/release`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function deliveryCloseChat({ token, walletAddress, orderNumber }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/chats/${orderNumber}/close`,
    headers: {
      ...(walletAddress && { 'X-Wallet-Address': walletAddress }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export function buildDeliveryChatAdminWsUrl(orderNumber) {
  return toWsUrl(`/ws/delivery-chat-admin/${orderNumber}`);
}