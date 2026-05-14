// src/hooks/useChannels.jsx — Hook for community channel management
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchChannels,
  fetchChannelMessages,
  sendChannelMessage,
  reactToChannelMessage,
  buildChannelWsUrl,
  uploadChannelMedia,
} from '../utils/communityData';

export default function useChannels({ appState, enabled = true }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase() || undefined;

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSlug, setActiveSlug] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]); // [{wallet, name}]
  const wsRef = useRef(null);
  const wsSlugRef = useRef(null);
  const reconnectRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingRef = useRef(0);

  const canCallApi = enabled && Boolean(token || walletAddress);

  // Normalize message fields
  const normalizeMessage = useCallback((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    let ts = copy.created_at || copy.createdAt || copy.timestamp;
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

  // Load channel list
  const loadChannels = useCallback(async () => {
    if (!canCallApi) return [];
    setLoading(true);
    try {
      const res = await fetchChannels({ token, walletAddress });
      const list = Array.isArray(res) ? res : [];
      setChannels(list);
      return list;
    } catch {
      setChannels([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [canCallApi, token, walletAddress]);

  // Load messages for a channel
  const loadMessages = useCallback(async (slug, before = null) => {
    if (!canCallApi || !slug) return [];
    if (!before) {
      setMessagesLoading(true);
      setHasMore(true);
    } else {
      setLoadingOlder(true);
    }
    try {
      const res = await fetchChannelMessages({ token, walletAddress, slug, limit: 50, before });
      const list = (Array.isArray(res) ? res : []).map(normalizeMessage);
      
      if (list.length < 50) setHasMore(false);

      if (before) {
        // Prepend older messages without duplicates
        setMessages(prev => {
          const newIds = new Set(list.map(m => m.id));
          const filteredPrev = prev.filter(m => !newIds.has(m.id));
          return [...list, ...filteredPrev];
        });
      } else {
        setMessages(list);
      }
      return list;
    } catch {
      if (!before) setMessages([]);
      return [];
    } finally {
      if (!before) setMessagesLoading(false);
      else setLoadingOlder(false);
    }
  }, [canCallApi, token, walletAddress, normalizeMessage]);

  // WebSocket
  const disconnectWs = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'channel-disconnect'); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    wsSlugRef.current = null;
    setTypingUsers([]);
  }, []);

  const connectWs = useCallback((slug) => {
    if (!enabled || !slug) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsSlugRef.current === slug) {
      return;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'channel-reconnect'); } catch {}
      wsRef.current = null;
    }

    const url = buildChannelWsUrl(slug);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    wsSlugRef.current = slug;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
    ws.onclose = () => {
      setConnected(false);
      if (!reconnectRef.current) {
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connectWs(slug);
        }, 2000);
      }
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'message') {
          const incoming = normalizeMessage(data);
          setMessages(prev => [...prev, incoming]);
        } else if (data?.type === 'reaction') {
          // Update reaction on existing message
          setMessages(prev => prev.map(m =>
            m.id === data.message_id ? { ...m, reactions: data.reactions } : m
          ));
        } else if (data?.type === 'typing') {
          if (data.state) {
            setTypingUsers(prev => {
              if (prev.find(u => u.wallet === data.wallet)) return prev;
              return [...prev, { wallet: data.wallet, name: data.name }];
            });
            // Auto-clear typing after 3s
            setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.wallet !== data.wallet));
            }, 3000);
          } else {
            setTypingUsers(prev => prev.filter(u => u.wallet !== data.wallet));
          }
        } else if (data?.type === 'pin') {
          setMessages(prev => prev.map(m =>
            m.id === data.message_id ? { ...m, is_pinned: data.action === 'pinned' } : m
          ));
        }
      } catch {}
    };
  }, [enabled, normalizeMessage]);

  // Open a channel
  const openChannel = useCallback(async (slug) => {
    if (!slug) return;
    setActiveSlug(slug);
    disconnectWs();
    await loadMessages(slug);
    connectWs(slug);
  }, [disconnectWs, loadMessages, connectWs]);

  // Send message
  const sendMessage = useCallback(async (text, replyTo = null) => {
    if (!canCallApi || !activeSlug || !text?.trim()) return;
    const wsOpen = wsRef.current?.readyState === WebSocket.OPEN;
    
    // Optimistic when WS is NOT open
    if (!wsOpen) {
      setMessages(prev => [...prev, normalizeMessage({
        id: `opt-${Date.now()}`,
        channel_slug: activeSlug,
        text,
        sender_wallet: walletAddress,
        sender_name: 'Tú',
        created_at: new Date().toISOString(),
        optimistic: true,
        reactions: {},
        mentions: [],
        media_urls: [],
      })]);
    }

    await sendChannelMessage({
      token, walletAddress, slug: activeSlug, text,
      reply_to: replyTo,
      mentions: text.toLowerCase().includes('@nonna') ? ['@nonna'] : [],
    });
  }, [canCallApi, activeSlug, token, walletAddress, normalizeMessage]);

  // React to message
  const reactToMessage = useCallback(async (messageId, emoji) => {
    if (!canCallApi || !activeSlug) return;
    await reactToChannelMessage({ token, walletAddress, slug: activeSlug, messageId, emoji });
  }, [canCallApi, activeSlug, token, walletAddress]);

  // Upload media
  const uploadMedia = useCallback(async (file) => {
    if (!canCallApi || !activeSlug) return null;
    const res = await uploadChannelMedia({ token, walletAddress, slug: activeSlug, file });
    return res?.url || null;
  }, [canCallApi, activeSlug, token, walletAddress]);

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

  // Load older messages (infinite scroll)
  const loadOlder = useCallback(async () => {
    if (!activeSlug || !messages.length || !hasMore || loadingOlder) return;
    const oldest = messages[0];
    const beforeId = oldest?.id;
    if (!beforeId || beforeId.startsWith('opt-')) return;
    return loadMessages(activeSlug, beforeId);
  }, [activeSlug, messages, hasMore, loadingOlder, loadMessages]);

  // Active channel info
  const activeChannel = useMemo(() => {
    return channels.find(c => c.slug === activeSlug) || null;
  }, [channels, activeSlug]);

  // Mount/unmount
  useEffect(() => {
    if (!enabled) {
      disconnectWs();
      return;
    }
    loadChannels();
    return () => disconnectWs();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    channels,
    loading,
    activeSlug,
    activeChannel,
    messages,
    messagesLoading,
    connected,
    typingUsers,

    // Actions
    loadChannels,
    openChannel,
    sendMessage,
    reactToMessage,
    uploadMedia,
    notifyTyping,
    loadOlder,
    disconnectWs,
  };
}
