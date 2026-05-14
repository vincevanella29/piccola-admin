// src/hooks/chat/useDmChat.jsx — Real-time DM hook with WebSocket
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchDmMessages,
  fetchDmConversations,
  sendDmMessage,
  buildDmWsUrl,
} from '../../utils/communityData';

export default function useDmChat({ appState, peer, enabled = true }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase() || undefined;
  const peerWallet = (peer?.wallet || '').toLowerCase() || null;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const wsRef = useRef(null);
  const wsPeerRef = useRef(null);
  const reconnectRef = useRef(null);
  const lastTypingRef = useRef(0);
  const typingTimeoutRef = useRef(null);

  const canCall = enabled && Boolean(token || walletAddress) && Boolean(peerWallet);

  // Normalize message
  const normalizeMsg = useCallback((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    let ts = copy.created_at || copy.timestamp;
    if (ts) {
      try {
        const d = new Date(ts);
        ts = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch { ts = new Date().toISOString(); }
    } else {
      ts = new Date().toISOString();
    }
    copy.created_at = ts;
    if (!copy.id && copy._id) copy.id = String(copy._id);
    return copy;
  }, []);

  // Load messages via REST
  const loadMessages = useCallback(async () => {
    if (!canCall) return;
    setLoading(true);
    try {
      const res = await fetchDmMessages({ token, walletAddress, peerWallet });
      const list = (Array.isArray(res) ? res : (res?.messages || [])).map(normalizeMsg);
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [canCall, token, walletAddress, peerWallet, normalizeMsg]);

  // WebSocket
  const disconnectWs = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'dm-disconnect'); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    wsPeerRef.current = null;
    setTypingUsers([]);
  }, []);

  const connectWs = useCallback(() => {
    if (!enabled || !walletAddress || !peerWallet) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsPeerRef.current === peerWallet) {
      return;
    }
    disconnectWs();

    const url = buildDmWsUrl(walletAddress);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    wsPeerRef.current = peerWallet;

    ws.onopen = () => {
      // Send init with peer wallet to join the conv room
      try {
        ws.send(JSON.stringify({ type: 'init', peer: peerWallet }));
      } catch {}
      setConnected(true);
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
    ws.onclose = () => {
      setConnected(false);
      if (!reconnectRef.current && wsPeerRef.current === peerWallet) {
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connectWs();
        }, 3000);
      }
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'dm_message') {
          const incoming = normalizeMsg(data);
          setMessages(prev => {
            // Avoid dupes by id
            if (prev.find(m => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        } else if (data?.type === 'typing') {
          if (data.state && data.wallet !== walletAddress) {
            setTypingUsers(prev => {
              if (prev.find(u => u.wallet === data.wallet)) return prev;
              return [...prev, { wallet: data.wallet, name: data.name }];
            });
            setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.wallet !== data.wallet));
            }, 3000);
          } else {
            setTypingUsers(prev => prev.filter(u => u.wallet !== data.wallet));
          }
        }
      } catch {}
    };
  }, [enabled, walletAddress, peerWallet, disconnectWs, normalizeMsg]);

  // Send message via REST (WS broadcast happens server-side)
  const sendMessage = useCallback(async (text) => {
    if (!canCall || !text?.trim()) return;
    await sendDmMessage({ token, walletAddress, peerWallet, text: text.trim() });
    // If WS is not connected, manually fetch
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await loadMessages();
    }
  }, [canCall, token, walletAddress, peerWallet, loadMessages]);

  // Typing indicator
  const notifyTyping = useCallback((state) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (state) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        try {
          ws.send(JSON.stringify({
            type: 'typing',
            wallet: walletAddress,
            name: appState?.profile?.profile?.name || walletAddress || '',
            state: true,
          }));
        } catch {}
        lastTypingRef.current = now;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'typing', wallet: walletAddress, state: false })); } catch {}
        lastTypingRef.current = 0;
      }, 2500);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      try { ws.send(JSON.stringify({ type: 'typing', wallet: walletAddress, state: false })); } catch {}
      lastTypingRef.current = 0;
    }
  }, [walletAddress, appState?.profile?.profile?.name]);

  // Connect/disconnect when peer changes
  useEffect(() => {
    if (!enabled || !peerWallet) {
      disconnectWs();
      setMessages([]);
      return;
    }
    loadMessages();
    connectWs();
    return () => disconnectWs();
  }, [enabled, peerWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    loading,
    connected,
    typingUsers,
    sendMessage,
    notifyTyping,
    disconnectWs,
    loadMessages,
  };
}
