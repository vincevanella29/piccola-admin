// src/pages/chat/components/admin/useAdminChat.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adminListChats,
  adminReplyChat,
  adminTakeChat,
  adminReleaseChat,
  adminCloseChat,
  buildAdminWsUrl,
  adminFetchChatHistory,
  adminFetchParticipants,
} from '../utils/chatData';

export default function useAdminChat({ appState, enabled = true }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase() || undefined;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null); // optional future use when backend supports it
  const [pageSize, setPageSize] = useState(10); // 10..100
  const [page, setPage] = useState(0); // zero-based
  const [statusFilter, setStatusFilter] = useState('open'); // open | closed | all
  const [loading, setLoading] = useState(false);

  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [typingClient, setTypingClient] = useState(false);
  const [participants, setParticipants] = useState([]);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Normalize message fields coming from API/WS
  const normalizeMessage = useCallback((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    // created_at normalization
    let ts = copy.created_at || copy.createdAt || copy.timestamp || copy.created || copy.time;
    if (ts) {
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) {
          ts = new Date().toISOString();
        } else {
          ts = d.toISOString();
        }
      } catch {
        ts = new Date().toISOString();
      }
    } else {
      ts = new Date().toISOString();
    }
    copy.created_at = ts;
    // role fallback
    if (!copy.role && copy.sender) copy.role = String(copy.sender);
    if (!copy.role) copy.role = 'assistant';
    // text/body fallback
    if (copy.text == null && copy.body != null) copy.text = String(copy.body);
    return copy;
  }, []);

  const canCallApi = enabled && Boolean(token && walletAddress);

  const offset = useMemo(() => page * pageSize, [page, pageSize]);

  const loadList = useCallback(async () => {
    if (!canCallApi) return [];
    setLoading(true);
    try {
      const res = await adminListChats({ token, walletAddress, status: statusFilter, limit: pageSize, offset });
      // adminListChats currently doesn't accept offset in utils; we can pass via params by extending util when needed
      // Workaround: call with limit only, offset added via backend param support, update utils later if necessary
      setItems(Array.isArray(res) ? res : []);
      return Array.isArray(res) ? res : [];
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [canCallApi, token, walletAddress, statusFilter, pageSize, offset]);

  const loadHistory = useCallback(async (convId) => {
    if (!enabled || !canCallApi || !convId) return [];
    try {
      const data = await adminFetchChatHistory({ token, walletAddress, convId });
      const list = Array.isArray(data) ? data.map(normalizeMessage) : [];
      setMessages(list);
      return list;
    } catch {
      setMessages([]);
      return [];
    }
  }, [enabled, canCallApi, token, walletAddress, normalizeMessage]);

  const loadParticipants = useCallback(async (convId) => {
    if (!enabled || !canCallApi || !convId) return [];
    try {
      const data = await adminFetchParticipants({ token, walletAddress, convId });
      const list = Array.isArray(data) ? data : [];
      setParticipants(list);
      return list;
    } catch {
      setParticipants([]);
      return [];
    }
  }, [enabled, canCallApi, token, walletAddress]);

  const connectWs = useCallback((convId) => {
    if (!enabled || !convId) return;
    try {
      const url = buildAdminWsUrl(convId);
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
          } else if (data?.type === 'status' && data?.status === 'closed') {
            // Optionally reflect closed state in list later
          } else if (data?.type === 'typing' && data?.side === 'client') {
            setTypingClient(Boolean(data?.state));
          }
        } catch {
          // ignore non-JSON
        }
      };
    } catch {}
  }, [enabled, normalizeMessage]);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'admin-disconnect'); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    setTypingClient(false);
  }, []);

  const openConversation = useCallback(async (convId) => {
    if (!enabled || !convId) return;
    setActiveConvId(convId);
    await Promise.all([
      loadHistory(convId),
      loadParticipants(convId),
    ]);
    disconnectWs();
    connectWs(convId);
  }, [enabled, loadHistory, loadParticipants, connectWs, disconnectWs]);

  const reply = useCallback(async (text) => {
    if (!enabled || !activeConvId || !text?.trim()) return;
    await adminReplyChat({ token, walletAddress, convId: activeConvId, text });
    // Avoid duplicates: if WS is open, the backend will broadcast the message.
    // Only append locally when WS isn't connected/open to keep UI responsive offline.
    const wsOpen = !!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN);
    if (!wsOpen) {
      setMessages((prev) => [...prev, normalizeMessage({ role: 'admin', text, created_at: new Date().toISOString() })]);
    }
  }, [enabled, activeConvId, token, walletAddress, normalizeMessage]);

  // Send admin typing state with small debounce off-switch
  const notifyTyping = useCallback((state) => {
    const ws = wsRef.current;
    if (!enabled || !ws) return;
    try {
      ws.send(JSON.stringify({ type: 'typing', state: Boolean(state) }));
    } catch {}
    if (state) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'typing', state: false })); } catch {}
      }, 2500);
    }
  }, [enabled]);

  const take = useCallback(async () => {
    if (!enabled || !activeConvId) return;
    await adminTakeChat({ token, walletAddress, convId: activeConvId });
    await loadList();
  }, [enabled, activeConvId, token, walletAddress, loadList]);

  const release = useCallback(async () => {
    if (!enabled || !activeConvId) return;
    await adminReleaseChat({ token, walletAddress, convId: activeConvId });
    await loadList();
  }, [enabled, activeConvId, token, walletAddress, loadList]);

  const closeConv = useCallback(async () => {
    if (!enabled || !activeConvId) return;
    await adminCloseChat({ token, walletAddress, convId: activeConvId });
    await loadList();
  }, [enabled, activeConvId, token, walletAddress, loadList]);

  // Load on mount and whenever pagination/filter changes
  useEffect(() => {
    if (!enabled) {
      disconnectWs();
      return;
    }
    loadList();
    // cleanup ws on unmount
    return () => disconnectWs();
  }, [enabled, loadList, disconnectWs]);

  // Ensure pageSize is within 10..100
  const setPageSizeSafe = useCallback((val) => {
    const v = Math.min(100, Math.max(10, Number(val) || 10));
    setPageSize(v);
    setPage(0); // reset to first page
  }, []);

  return {
    // List state
    items,
    loading,
    page,
    pageSize,
    offset,
    statusFilter,

    // Selection
    activeConvId,
    messages,
    connected,
    typingClient,
    participants,

    // Actions
    setPage,
    setPageSize: setPageSizeSafe,
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
