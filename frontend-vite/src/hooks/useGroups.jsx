// src/hooks/useGroups.jsx — Hook for community group management
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchGroups,
  fetchGroupMessages,
  sendGroupMessage,
  reactToGroupMessage,
  createGroup,
  addGroupMember,
  removeGroupMember,
  buildGroupWsUrl,
  uploadGroupMedia,
} from '../utils/communityData';

export default function useGroups({ appState, enabled = true }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase() || undefined;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const wsRef = useRef(null);
  const wsGroupRef = useRef(null);
  const reconnectRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const canCallApi = enabled && Boolean(token || walletAddress);

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

  // Load groups list
  const loadGroups = useCallback(async () => {
    if (!canCallApi) return [];
    setLoading(true);
    try {
      const res = await fetchGroups({ token, walletAddress });
      const list = Array.isArray(res) ? res : [];
      setGroups(list);
      return list;
    } catch {
      setGroups([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [canCallApi, token, walletAddress]);

  // Load messages
  const loadMessages = useCallback(async (groupId, before = null) => {
    if (!canCallApi || !groupId) return [];
    if (!before) setMessagesLoading(true);
    try {
      const res = await fetchGroupMessages({ token, walletAddress, groupId, limit: 50, before });
      const list = (Array.isArray(res) ? res : []).map(normalizeMessage);
      if (before) {
        setMessages(prev => [...list, ...prev]);
      } else {
        setMessages(list);
      }
      return list;
    } catch {
      if (!before) setMessages([]);
      return [];
    } finally {
      setMessagesLoading(false);
    }
  }, [canCallApi, token, walletAddress, normalizeMessage]);

  // WebSocket
  const disconnectWs = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'group-disconnect'); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    wsGroupRef.current = null;
    setTypingUsers([]);
  }, []);

  const connectWs = useCallback((groupId) => {
    if (!enabled || !groupId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN && wsGroupRef.current === groupId) return;
    if (wsRef.current) {
      try { wsRef.current.close(1000, 'group-reconnect'); } catch {}
      wsRef.current = null;
    }

    const url = buildGroupWsUrl(groupId);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    wsGroupRef.current = groupId;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
    ws.onclose = () => {
      setConnected(false);
      if (!reconnectRef.current) {
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connectWs(groupId);
        }, 2000);
      }
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'message') {
          setMessages(prev => [...prev, normalizeMessage(data)]);
        } else if (data?.type === 'reaction') {
          setMessages(prev => prev.map(m =>
            m.id === data.message_id ? { ...m, reactions: data.reactions } : m
          ));
        } else if (data?.type === 'typing') {
          if (data.state) {
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
        } else if (data?.type === 'member_joined') {
          // Refresh group list to update member count
          loadGroups();
        } else if (data?.type === 'member_left') {
          loadGroups();
        }
      } catch {}
    };
  }, [enabled, normalizeMessage, loadGroups]);

  // Open group
  const openGroup = useCallback(async (groupId) => {
    if (!groupId) return;
    setActiveGroupId(groupId);
    disconnectWs();
    await loadMessages(groupId);
    connectWs(groupId);
  }, [disconnectWs, loadMessages, connectWs]);

  // Send message
  const sendMessage = useCallback(async (text, replyTo = null) => {
    if (!canCallApi || !activeGroupId || !text?.trim()) return;
    const wsOpen = wsRef.current?.readyState === WebSocket.OPEN;
    
    if (!wsOpen) {
      setMessages(prev => [...prev, normalizeMessage({
        id: `opt-${Date.now()}`,
        group_id: activeGroupId,
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

    await sendGroupMessage({
      token, walletAddress, groupId: activeGroupId, text,
      reply_to: replyTo,
      mentions: text.toLowerCase().includes('@nonna') ? ['@nonna'] : [],
    });
  }, [canCallApi, activeGroupId, token, walletAddress, normalizeMessage]);

  // React
  const reactToMessage = useCallback(async (messageId, emoji) => {
    if (!canCallApi || !activeGroupId) return;
    await reactToGroupMessage({ token, walletAddress, groupId: activeGroupId, messageId, emoji });
  }, [canCallApi, activeGroupId, token, walletAddress]);

  // Upload
  const uploadMedia = useCallback(async (file) => {
    if (!canCallApi || !activeGroupId) return null;
    const res = await uploadGroupMedia({ token, walletAddress, groupId: activeGroupId, file });
    return res?.url || null;
  }, [canCallApi, activeGroupId, token, walletAddress]);

  // Create new group
  const doCreateGroup = useCallback(async ({ name, icon, section_filter, is_section_based }) => {
    if (!canCallApi) return null;
    const res = await createGroup({
      token, walletAddress,
      data: { name, icon, section_filter, is_section_based },
    });
    if (res?.group_id) {
      await loadGroups();
    }
    return res;
  }, [canCallApi, token, walletAddress, loadGroups]);

  // Add member
  const doAddMember = useCallback(async (memberWallet) => {
    if (!canCallApi || !activeGroupId) return;
    await addGroupMember({ token, walletAddress, groupId: activeGroupId, memberWallet });
    await loadGroups();
  }, [canCallApi, activeGroupId, token, walletAddress, loadGroups]);

  // Remove member
  const doRemoveMember = useCallback(async (memberWallet) => {
    if (!canCallApi || !activeGroupId) return;
    await removeGroupMember({ token, walletAddress, groupId: activeGroupId, memberWallet });
    await loadGroups();
  }, [canCallApi, activeGroupId, token, walletAddress, loadGroups]);

  // Typing
  const notifyTyping = useCallback((state) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({
        type: 'typing',
        wallet: walletAddress,
        name: appState?.profile?.profile?.name || walletAddress || '',
        state: Boolean(state),
      }));
    } catch {}
    if (state) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'typing', wallet: walletAddress, state: false })); } catch {}
      }, 2500);
    }
  }, [walletAddress, appState?.profile?.profile?.name]);

  // Load older
  const loadOlder = useCallback(async () => {
    if (!activeGroupId || !messages.length) return;
    const oldest = messages[0];
    const beforeId = oldest?.id;
    if (!beforeId || beforeId.startsWith('opt-')) return;
    return loadMessages(activeGroupId, beforeId);
  }, [activeGroupId, messages, loadMessages]);

  // Active group info
  const activeGroup = useMemo(() => {
    return groups.find(g => g.group_id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  // Mount/unmount
  useEffect(() => {
    if (!enabled) {
      disconnectWs();
      return;
    }
    loadGroups();
    return () => disconnectWs();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    groups,
    loading,
    activeGroupId,
    activeGroup,
    messages,
    messagesLoading,
    connected,
    typingUsers,

    // Actions
    loadGroups,
    openGroup,
    sendMessage,
    reactToMessage,
    uploadMedia,
    notifyTyping,
    loadOlder,
    createGroup: doCreateGroup,
    addMember: doAddMember,
    removeMember: doRemoveMember,
    disconnectWs,
  };
}
