// src/hooks/useDeliveryChatAdmin.jsx
// Mirrors useAdminChat but hits /delivery/chats/* endpoints.
// Key differences:
//   - Uses orderNumber instead of convId
//   - Hits delivery-specific REST + WS endpoints
//   - No participants (order data is in the chat state)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deliveryListChats,
  deliveryFetchHistory,
  deliveryReplyChat,
  deliveryTakeChat,
  deliveryReleaseChat,
  deliveryCloseChat,
  buildDeliveryChatAdminWsUrl,
} from '../../utils/chatData';

export default function useDeliveryChatAdmin({ appState, enabled = true }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase() || undefined;

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(false);

  const [activeOrderNumber, setActiveOrderNumber] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatState, setChatState] = useState(null); // {status, mode, admin_id, customer_name}
  const [connected, setConnected] = useState(false);
  const [typingClient, setTypingClient] = useState(false);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Normalize message fields
  const normalizeMessage = useCallback((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    let ts = copy.created_at || copy.at || copy.timestamp || copy.time;
    if (ts) {
      try {
        const d = new Date(ts);
        ts = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch {
        ts = new Date().toISOString();
      }
    } else {
      ts = new Date().toISOString();
    }
    copy.created_at = ts;
    if (!copy.role && copy.sender) copy.role = String(copy.sender);
    if (!copy.role) copy.role = 'assistant';
    if (copy.text == null && copy.body != null) copy.text = String(copy.body);
    return copy;
  }, []);

  const canCallApi = enabled && Boolean(token && walletAddress);

  // ── List ────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    if (!canCallApi) return [];
    setLoading(true);
    try {
      const res = await deliveryListChats({ token, walletAddress, status: statusFilter });
      const list = Array.isArray(res?.items || res) ? (res?.items || res) : [];
      setItems(list);
      return list;
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [canCallApi, token, walletAddress, statusFilter]);

  // ── History + WS ───────────────────────────────────────────────

  const loadHistory = useCallback(async (orderNumber) => {
    if (!canCallApi || !orderNumber) return [];
    try {
      const data = await deliveryFetchHistory({ token, walletAddress, orderNumber });
      const list = Array.isArray(data?.messages || data) ? (data?.messages || data).map(normalizeMessage) : [];
      setMessages(list);
      if (data?.state) setChatState(data.state);
      return list;
    } catch {
      setMessages([]);
      return [];
    }
  }, [canCallApi, token, walletAddress, normalizeMessage]);

  const connectWs = useCallback((orderNumber) => {
    if (!enabled || !orderNumber) return;
    try {
      const url = buildDeliveryChatAdminWsUrl(orderNumber);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); setTypingClient(false); };
      ws.onerror = () => { setConnected(false); setTypingClient(false); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'message' || data?.role) {
            const incoming = normalizeMessage(data?.message || data);
            setMessages((prev) => [...prev, incoming]);
          } else if (data?.type === 'mode') {
            setChatState((prev) => ({ ...prev, mode: data.mode, admin_id: data.admin_id }));
          } else if (data?.type === 'status') {
            setChatState((prev) => ({ ...prev, status: data.status }));
          } else if (data?.type === 'typing' && data?.side === 'client') {
            setTypingClient(Boolean(data?.state));
          }
        } catch { /* ignore non-JSON */ }
      };
    } catch { }
  }, [enabled, normalizeMessage]);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'admin-disconnect'); } catch { }
      wsRef.current = null;
    }
    setConnected(false);
    setTypingClient(false);
  }, []);

  const openConversation = useCallback(async (orderNumber) => {
    if (!enabled || !orderNumber) return;
    setActiveOrderNumber(orderNumber);
    await loadHistory(orderNumber);
    disconnectWs();
    connectWs(orderNumber);
  }, [enabled, loadHistory, connectWs, disconnectWs]);

  // ── Actions ────────────────────────────────────────────────────

  const reply = useCallback(async (text) => {
    if (!enabled || !activeOrderNumber || !text?.trim()) return;
    await deliveryReplyChat({ token, walletAddress, orderNumber: activeOrderNumber, text });
    const wsOpen = !!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN);
    if (!wsOpen) {
      setMessages((prev) => [...prev, normalizeMessage({
        role: 'admin', text, created_at: new Date().toISOString(),
      })]);
    }
  }, [enabled, activeOrderNumber, token, walletAddress, normalizeMessage]);

  const notifyTyping = useCallback((state) => {
    const ws = wsRef.current;
    if (!enabled || !ws) return;
    try {
      ws.send(JSON.stringify({ type: 'typing', state: Boolean(state) }));
    } catch { }
    if (state) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'typing', state: false })); } catch { }
      }, 2500);
    }
  }, [enabled]);

  const take = useCallback(async () => {
    if (!enabled || !activeOrderNumber) return;
    await deliveryTakeChat({ token, walletAddress, orderNumber: activeOrderNumber });
    setChatState((prev) => ({ ...prev, mode: 'human', admin_id: walletAddress }));
    await loadList();
  }, [enabled, activeOrderNumber, token, walletAddress, loadList]);

  const release = useCallback(async () => {
    if (!enabled || !activeOrderNumber) return;
    await deliveryReleaseChat({ token, walletAddress, orderNumber: activeOrderNumber });
    setChatState((prev) => ({ ...prev, mode: 'bot', admin_id: null }));
    await loadList();
  }, [enabled, activeOrderNumber, token, walletAddress, loadList]);

  const closeConv = useCallback(async () => {
    if (!enabled || !activeOrderNumber) return;
    await deliveryCloseChat({ token, walletAddress, orderNumber: activeOrderNumber });
    setChatState((prev) => ({ ...prev, status: 'closed' }));
    await loadList();
  }, [enabled, activeOrderNumber, token, walletAddress, loadList]);

  // ── Lifecycle ──────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      disconnectWs();
      return;
    }
    loadList();
    return () => disconnectWs();
  }, [enabled, loadList, disconnectWs]);

  return {
    // List
    items,
    loading,
    statusFilter,

    // Selection
    activeOrderNumber,
    messages,
    chatState,
    connected,
    typingClient,

    // Actions
    setStatusFilter,
    loadList,
    openConversation,
    reply,
    take,
    release,
    closeConv,
    notifyTyping,
  };
}
