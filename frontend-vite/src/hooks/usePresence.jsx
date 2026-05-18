// src/hooks/usePresence.jsx — Presence WebSocket hook for community
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { buildPresenceWsUrl, fetchPresence, fetchCommunityMembers } from '../utils/communityData';

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
        has_user: true, // Anyone sending heartbeats via WS is authenticated
      };

      if (data.status === 'offline') {
        // Keep in list but mark as offline (for "recently online" display)
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...entry };
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
        const hb = buildHeartbeat();
        console.log('[PRESENCE] 🟢 WS connected, sending heartbeat:', hb);
        // Send first heartbeat immediately
        ws.send(JSON.stringify(hb));
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
            console.log('[PRESENCE] 📡 presence_sync received, members:', data.members?.length, data.members?.map(m => ({ w: m.wallet?.slice(0,8), s: m.status, name: m.name })));
            setMembers(prev => {
              const incoming = new Map((data.members || []).map(m => [m.wallet, { ...m, has_user: true }]));
              // Update existing members if found in sync, keep their current status otherwise
              // (offline detection is handled by backend cleanup + individual presence_update events)
              const result = prev.map(m => {
                const updated = incoming.get(m.wallet);
                if (updated) {
                  incoming.delete(m.wallet);
                  return { ...m, ...updated, status: updated.status };
                }
                return m; // Keep existing state — don't force offline
              }).concat(Array.from(incoming.values()));
              console.log('[PRESENCE] 📡 presence_sync merged → total members:', result.length, 'online:', result.filter(m => m.status === 'online').length);
              return result;
            });
          } else if (data.type === 'presence_update') {
            console.log('[PRESENCE] 🔄 presence_update:', { w: data.wallet?.slice(0,8), s: data.status, name: data.name, has_user: data.has_user });
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

  // Diagnostic: log derived counts when members change
  useMemo(() => {
    if (members.length > 0) {
      const withUser = members.filter(m => m.has_user);
      const noUser = members.filter(m => !m.has_user);
      console.log('[PRESENCE] 📊 members:', members.length, '| online:', onlineMembers.length, '| idle:', idleMembers.length, '| offline:', offlineMembers.length, '| has_user:', withUser.length, '| no_user:', noUser.length);
      noUser.forEach(m => console.log('[PRESENCE] ⚠️ no has_user:', { w: m.wallet?.slice(0,8), s: m.status, name: m.name }));
    }
  }, [members]);

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
          console.log('[PRESENCE] 🌐 REST loaded:', allFromRest.length, 'members, real wallets:', allFromRest.filter(m => m.wallet && !m.wallet.startsWith('rut_')).length);
          setMembers(prev => {
            const walletSet = new Set(prev.map(m => m.wallet));
            // Skip rut_ fake wallets — those workers show via unregisteredEmployees instead
            // Mark real wallet entries as has_user (they have linked accounts)
            const newOnes = allFromRest
              .filter(m => m.wallet && !m.wallet.startsWith('rut_') && !walletSet.has(m.wallet))
              .map(m => ({ ...m, has_user: true }));
            return [...prev, ...newOnes];
          });
        }
      }
    } catch {
      // ignore
    }
  }, [token, walletAddress]);

  // ─── Unregistered Employees (no wallet/account) ──────────────
  const [allEmployees, setAllEmployees] = useState([]);

  const loadAllEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchCommunityMembers({ token, walletAddress });
      const list = res?.members || res?.data?.members || [];
      setAllEmployees(list);
    } catch {
      // ignore
    }
  }, [token, walletAddress]);

  const unregisteredEmployees = useMemo(() => {
    if (!allEmployees.length) return [];
    const registeredWallets = new Set(members.map(m => (m.wallet || '').toLowerCase()).filter(Boolean));
    return allEmployees.filter(e => !e.wallet || !registeredWallets.has(e.wallet.toLowerCase()));
  }, [allEmployees, members]);

  const unregisteredBySection = useMemo(() => {
    const map = {};
    unregisteredEmployees.forEach(e => {
      const sec = (e.seccion || 'General').trim();
      if (!map[sec]) map[sec] = [];
      map[sec].push({ ...e, status: 'unregistered' });
    });
    return map;
  }, [unregisteredEmployees]);

  // Load REST fallback + employee directory once on mount
  useEffect(() => {
    if (enabled && token) {
      loadPresenceRest();
      loadAllEmployees();
    }
  }, [enabled, token, loadPresenceRest, loadAllEmployees]);

  // Build a wallet → employee lookup for enriching avatars in chat messages
  const employeeMap = useMemo(() => {
    const map = {};
    allEmployees.forEach(e => {
      if (e.wallet) map[e.wallet.toLowerCase()] = e;
    });
    return map;
  }, [allEmployees]);

  // Enrich presence members with profile photos and contact data from employee directory
  // The heartbeat doesn't send profile_image_url, email, etc., so we patch it in from trabajadores_vpn
  useEffect(() => {
    if (!allEmployees.length) return;
    setMembers(prev => {
      let changed = false;
      const next = prev.map(m => {
        const w = (m.wallet || '').toLowerCase();
        const emp = w ? employeeMap[w] : null;
        
        if (!emp) return m;

        let enriched = { ...m };
        let modified = false;

        if (!m.profile_image_url && emp.profile_image_url) {
          enriched.profile_image_url = emp.profile_image_url;
          modified = true;
        }
        if (m.email !== emp.email) {
          enriched.email = emp.email;
          modified = true;
        }
        if (m.has_user !== emp.has_user) {
          enriched.has_user = emp.has_user;
          modified = true;
        }
        if (m.sucursal !== emp.sucursal) {
          enriched.sucursal = emp.sucursal;
          modified = true;
        }
        if (emp.name && (m.name === m.wallet || m.name === m.wallet?.toLowerCase() || !m.name)) {
          enriched.name = emp.name;
          modified = true;
        }
        if (emp.seccion && (!m.seccion || m.seccion === 'General')) {
          enriched.seccion = emp.seccion;
          modified = true;
        }
        if (emp.cargo && !m.cargo) {
          enriched.cargo = emp.cargo;
          modified = true;
        }

        if (modified) {
          changed = true;
          return enriched;
        }
        return m;
      });
      return changed ? next : prev;
    });
  }, [allEmployees, employeeMap]);

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
    unregisteredBySection,
    unregisteredCount: unregisteredEmployees.length,
    employeeMap,
    loadPresenceRest,
  };
};

export default usePresence;
