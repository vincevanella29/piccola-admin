// src/hooks/useChatClient.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startChatSession,
  sendChatMessage,
  fetchChatHistory,
  buildClientWsUrl,
  fetchChatConversations,
  fetchLastConversation,
} from '../utils/chatData';

// Local cache keys
const DEFAULT_CACHE_KEY = 'chat_conv_id';

const useChatClient = ({ appState, accessToken, account, setError, setSuccess, persistKey = DEFAULT_CACHE_KEY, enabled = true, restoreOnMount = true } = {}) => {
  const { t } = useTranslation();

  // Identity from appState with optional overrides
  const token = accessToken || appState?.token;
  const walletAddress = (account || appState?.account || '').toLowerCase() || undefined;

  // State
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null); // open, closed, etc.
  const [adminTyping, setAdminTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const wsConvIdRef = useRef(null); // track which conversation WS is bound to

  // Helpers: cache convId
  const saveConvId = useCallback((id) => {
    try { localStorage.setItem(persistKey, id); } catch {}
  }, [persistKey]);
  const readConvId = useCallback(() => {
    try { return localStorage.getItem(persistKey); } catch { return null; }
  }, [persistKey]);
  const clearConvId = useCallback(() => {
    try { localStorage.removeItem(persistKey); } catch {}
  }, [persistKey]);

  const canCallApi = enabled && Boolean(token || walletAddress);

  // Normalize message shape/timestamp
  const normalizeMessage = useCallback((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    let ts = copy.created_at || copy.createdAt || copy.timestamp || copy.created || copy.time;
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
    if (copy.text == null && copy.body != null) copy.text = String(copy.body);
    return copy;
  }, []);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, normalizeMessage(msg)]);
  }, [normalizeMessage]);

  const replaceHistory = useCallback((hist = []) => {
    const list = Array.isArray(hist) ? hist.map(normalizeMessage) : [];
    setMessages(list);
  }, [normalizeMessage]);

  // Load conversations list for the user
  const loadConversations = useCallback(async () => {
    if (!canCallApi) return [];
    try {
      const list = await fetchChatConversations({ token, walletAddress });
      setConversations(Array.isArray(list) ? list : []);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }, [canCallApi, token, walletAddress]);

  // Load history
  const loadHistory = useCallback(async (id = convId) => {
    if (!enabled || !id || !canCallApi) return;
    setIsLoading(true);
    try {
      const res = await fetchChatHistory({ token, walletAddress, convId: id });
      // Expecting array of { role, text, created_at, ... }
      replaceHistory(res?.messages || res || []);
      setStatus(res?.status || null);
      setSuccess?.(t('chat.history_loaded'));
    } catch (err) {
      setError?.(t('chat.error_loading_history'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, convId, canCallApi, token, walletAddress, replaceHistory, setError, setSuccess, t]);

  // Start chat session
  const initSession = useCallback(async ({ metadata } = {}) => {
    if (!enabled || !canCallApi) {
      setError?.(t('chat.missing_identity'));
      return null;
    }
    setIsLoading(true);
    try {
      const res = await startChatSession({ token, walletAddress, metadata });
      const id = res?.conv_id || res?.id || res;
      if (id) {
        setConvId(id);
        saveConvId(id);
        setStatus(res?.status || 'open');
        setSuccess?.(t('chat.session_started'));
        // Immediately load history and connect WS
        await loadHistory(id);
        connectWs(id);
      }
      return id;
    } catch (err) {
      setError?.(t('chat.error_start_session'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, canCallApi, token, walletAddress, saveConvId, setError, setSuccess, t, loadHistory]);

  // Send message
  const sendMessage = useCallback(async ({ text, metadata } = {}) => {
    if (!enabled) return null;
    let id = convId;
    if (!id) {
      // Auto-start a session on first send for better UX
      try {
        id = await initSession();
      } catch (_) {}
      if (!id) {
        setError?.(t('chat.start_conversation'));
        return null;
      }
    }
    const activeId = id || readConvId();
    if (!activeId) return null;

    const wsOpen = !!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN);
    // Optimistic: only when WS is not open. If WS is open, rely on server broadcast.
    const optimistic = !wsOpen ? { role: 'user', text, created_at: new Date().toISOString(), optimistic: true } : null;
    if (optimistic) appendMessage(optimistic);

    try {
      const res = await sendChatMessage({ token, walletAddress, convId: activeId, text, metadata });
      if (!optimistic) {
        // WS is open: do nothing here; rely on WS echo to append
      } else if (res?.message) {
        // Replace optimistic with server echo
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m === optimistic);
          if (idx !== -1) copy[idx] = normalizeMessage(res.message);
          return copy;
        });
      } else {
        // Clear optimistic flag if no echo provided
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m === optimistic);
          if (idx !== -1) copy[idx] = { ...copy[idx], optimistic: false };
          return copy;
        });
      }
      return res;
    } catch (err) {
      setError?.(t('chat.error_sending_message'));
      throw err;
    }
  }, [enabled, convId, initSession, readConvId, appendMessage, token, walletAddress, setError, t, normalizeMessage]);

  // Typing indicator
  const setTyping = useCallback((state) => {
    try {
      if (enabled && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'typing', state }));
      }
    } catch {}
  }, [enabled]);

  // WebSocket connect/teardown
  const disconnectWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'client-disconnect'); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    wsConvIdRef.current = null;
  }, []);

  const connectWs = useCallback((id = convId) => {
    if (!enabled || !id) return;
    try {
      // Idempotent: if already connected to this conversation, do nothing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsConvIdRef.current === id) {
        return;
      }
      // Ensure previous socket is closed before opening a new one
      if (wsRef.current) {
        try { wsRef.current.close(1000, 'client-reconnect'); } catch {}
        wsRef.current = null;
      }
      const url = buildClientWsUrl(id);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      wsConvIdRef.current = id;

      ws.onopen = () => {
        setConnected(true);
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        // Optionally mark client online
        try { ws.send(JSON.stringify({ type: 'presence', state: 'online' })); } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        // Attempt reconnect (avoid stacking timers)
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectWs(id);
          }, 1500);
        }
      };
      ws.onerror = () => {
        setConnected(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'message' || data?.role) {
            const incoming = normalizeMessage(data?.message || data);
            // If this is the client's own message and an optimistic exists, replace it instead of appending
            setMessages((prev) => {
              if (incoming?.role === 'user') {
                const idx = [...prev].reverse().findIndex((m) => m.optimistic && m.role === 'user' && m.text === incoming.text);
                if (idx !== -1) {
                  const realIdx = prev.length - 1 - idx;
                  const copy = [...prev];
                  copy[realIdx] = incoming;
                  return copy;
                }
              }
              return [...prev, incoming];
            });
            setUnreadCount((c) => c + 1);
          } else if (data?.type === 'typing') {
            setAdminTyping(Boolean(data?.state));
          } else if (data?.type === 'status') {
            setStatus(data?.status || null);
          }
        } catch {
          // non-JSON payloads ignored
        }
      };
    } catch (e) {
      setError?.(t('chat.error_ws_connect'));
    }
  }, [enabled, convId, appendMessage, setError, t, normalizeMessage]);

  // Mount: try restore convId and connect
  useEffect(() => {
    if (!enabled) {
      // Ensure connection is closed when disabled
      disconnectWs();
      return;
    }
    // If restoreOnMount is disabled, only load conversation list and do not restore/connect.
    if (!restoreOnMount) {
      loadConversations();
      return () => { disconnectWs(); };
    }
    const cached = readConvId();
    if (cached && !convId) {
      setConvId(cached);
      // Load history and connect
      loadHistory(cached);
      connectWs(cached);
      // Also refresh conversations in background
      loadConversations();
      return () => {
        disconnectWs();
      };
    }
    // Do not auto-start a session here; let the caller (ClientChat) control via initSession().
    // Still preload conversations list for UI context when possible.
    loadConversations();
    return () => {
      disconnectWs();
    };
  }, [enabled, restoreOnMount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived helpers
  const isClosed = useMemo(() => status === 'closed', [status]);

  const resetSession = useCallback(() => {
    disconnectWs();
    clearConvId();
    setConvId(null);
    setMessages([]);
    setStatus(null);
    setUnreadCount(0);
  }, [disconnectWs, clearConvId]);

  // Open an existing conversation by id
  const openConversation = useCallback((id) => {
    if (!id) return;
    try { disconnectWs(); } catch {}
    setConvId(id);
    saveConvId(id);
    loadHistory(id);
    connectWs(id);
  }, [disconnectWs, saveConvId, loadHistory, connectWs]);

  return {
    // State
    convId,
    messages,
    isLoading,
    connected,
    status,
    isClosed,
    adminTyping,
    unreadCount,
    conversations,

    // Identity
    walletAddress,
    token,

    // Actions
    initSession,
    loadHistory,
    loadConversations,
    sendMessage,
    setTyping,
    connectWs,
    disconnectWs,
    resetSession,
    openConversation,
  };
};

export default useChatClient;
