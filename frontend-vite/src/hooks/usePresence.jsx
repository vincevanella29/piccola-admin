// src/hooks/usePresence.jsx — Presence WebSocket hook for community
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { buildPresenceWsUrl, fetchPresence } from '../utils/communityData';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const RECONNECT_DELAY = 5_000;     // 5 seconds

const usePresence = ({ appState, enabled = true }) => {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase();
  const userName = appState?.userName || appState?.displayName || walletAddress;
  const userCargo = appState?.permissions?.cargo || appState?.cargo || '';
  const userSeccion = appState?.permissions?.seccion || appState?.seccion || '';
  const userAvatar = appState?.profileImageUrl || null;

  const [members, setMembers] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);

  // Build heartbeat payload
  const buildHeartbeat = useCallback(() => ({
    type: 'heartbeat',
    wallet: walletAddress,
    name: userName,
    cargo: userCargo,
    seccion: userSeccion,
    profile_image_url: userAvatar,
  }), [walletAddress, userName, userCargo, userSeccion, userAvatar]);

  // Process a presence_update event (single member change)
  const handlePresenceUpdate = useCallback((data) => {
    setMembers(prev => {
      const idx = prev.findIndex(m => m.wallet === data.wallet);
      const entry = {
        wallet: data.wallet,
        name: data.name || data.wallet,
        status: data.status,
        cargo: data.cargo,
        seccion: data.seccion,
        profile_image_url: data.profile_image_url,
      };

      if (data.status === 'offline') {
        // Keep in list but mark as offline (for "recently online" display)
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return prev;
      }

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...entry, status: data.status };
        return next;
      }
      return [...prev, entry];
    });
  }, []);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (!enabled || !walletAddress) return;

    try {
      const url = buildPresenceWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Send first heartbeat immediately
        ws.send(JSON.stringify(buildHeartbeat()));
        // Start interval
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(buildHeartbeat()));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence_sync') {
            setMembers(prev => {
              const incoming = new Map((data.members || []).map(m => [m.wallet, m]));
              return prev.map(m => {
                const updated = incoming.get(m.wallet);
                if (updated) {
                  incoming.delete(m.wallet);
                  return { ...m, ...updated, status: updated.status };
                } else {
                  return { ...m, status: 'offline' };
                }
              }).concat(Array.from(incoming.values()));
            });
          } else if (data.type === 'presence_update') {
            handlePresenceUpdate(data);
          }
        } catch (e) {
          console.warn('Presence WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        // Reconnect
        reconnectRef.current = setTimeout(connectWs, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('Presence WS connect error:', e);
      reconnectRef.current = setTimeout(connectWs, RECONNECT_DELAY);
    }
  }, [enabled, walletAddress, buildHeartbeat, handlePresenceUpdate]);

  // Lifecycle
  useEffect(() => {
    if (enabled && walletAddress) {
      connectWs();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [enabled, walletAddress]);

  // Derived: group by section + status
  const onlineMembers = useMemo(() => members.filter(m => m.status === 'online'), [members]);
  const idleMembers = useMemo(() => members.filter(m => m.status === 'idle'), [members]);
  const offlineMembers = useMemo(() => members.filter(m => m.status === 'offline'), [members]);

  const groupBySection = useCallback((list) => {
    const map = {};
    list.forEach(m => {
      const sec = (m.seccion || 'General').trim();
      if (!map[sec]) map[sec] = [];
      map[sec].push(m);
    });
    return map;
  }, []);

  const onlineBySection = useMemo(() => groupBySection(onlineMembers), [onlineMembers, groupBySection]);
  const idleBySection = useMemo(() => groupBySection(idleMembers), [idleMembers, groupBySection]);
  const offlineBySection = useMemo(() => groupBySection(offlineMembers), [offlineMembers, groupBySection]);

  // REST fallback: load once for offline members who haven't connected yet
  const loadPresenceRest = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchPresence({ token, walletAddress });
      // Merge REST data with WebSocket data
      if (res?.ok || res?.data?.ok) {
        const data = res?.data || res;
        const allFromRest = [];
        for (const status of ['online', 'idle', 'offline']) {
          const sections = data[status] || {};
          for (const members of Object.values(sections)) {
            allFromRest.push(...members);
          }
        }
        if (allFromRest.length > 0) {
          setMembers(prev => {
            const walletSet = new Set(prev.map(m => m.wallet));
            const newOnes = allFromRest.filter(m => !walletSet.has(m.wallet));
            return [...prev, ...newOnes];
          });
        }
      }
    } catch {
      // ignore
    }
  }, [token, walletAddress]);

  // Load REST fallback once on mount
  useEffect(() => {
    if (enabled && token) {
      loadPresenceRest();
    }
  }, [enabled, token, loadPresenceRest]);

  return {
    members,
    connected,
    onlineCount: onlineMembers.length,
    idleCount: idleMembers.length,
    offlineCount: offlineMembers.length,
    onlineMembers,
    idleMembers,
    offlineMembers,
    onlineBySection,
    idleBySection,
    offlineBySection,
    loadPresenceRest,
  };
};

export default usePresence;
