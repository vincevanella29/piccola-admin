// src/hooks/useCustomersChat.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import useDeliveryChatAdmin from './delivery/useDeliveryChatAdmin';
import useWhatsApp from './useWhatsApp';

export default function useCustomersChat({ appState }) {
  const adminLevel = useMemo(() => (appState?.companyRoleLevel ?? appState?.roleLevel ?? 0), [appState?.companyRoleLevel, appState?.roleLevel]);
  const isAdmin = (adminLevel === 3 || adminLevel === 4) || appState?.isAdmin === true;
  const canDelivery = adminLevel >= 3 && adminLevel <= 7;
  // WhatsApp is restricted to admins (roles 3 and 4)
  const canWhatsApp = isAdmin;

  const [activeConversation, setActiveConversation] = useState(null); // { provider: 'delivery'|'whatsapp', id: string }
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'delivery' | 'whatsapp'

  // Initialize hooks
  const delivery = useDeliveryChatAdmin({ appState, enabled: canDelivery });
  const wa = useWhatsApp({ token: appState?.accessToken || appState?.token, account: appState?.account });

  // Soft polling for WhatsApp (every 10s)
  const fetchWaConversations = wa.fetchConversations;
  useEffect(() => {
    if (!canWhatsApp) return;
    fetchWaConversations();
    const iv = setInterval(() => {
      fetchWaConversations();
    }, 10000);
    return () => clearInterval(iv);
  }, [canWhatsApp, fetchWaConversations]);

  // Combine and sort items
  const items = useMemo(() => {
    let combined = [];

    if (canDelivery) {
      const delItems = (delivery.items || []).map(i => ({
        ...i,
        provider: 'delivery',
        id: i.order_number,
        displayTitle: `Orden #${i.order_number}`,
        displaySubtitle: i.customer_name || 'Cliente',
        sortDate: new Date(i.last_at || i.opened_at || 0).getTime(),
      }));
      combined = [...combined, ...delItems];
    }

    if (canWhatsApp) {
      const waItems = (wa.conversations || []).map(i => ({
        ...i,
        provider: 'whatsapp',
        id: i.phone,
        displayTitle: `+${i.phone}`,
        displaySubtitle: 'WhatsApp',
        last_text: i.content,
        last_at: i.last_message_at,
        unread: i.unread || 0,
        sortDate: new Date(i.last_message_at || 0).getTime(),
      }));
      combined = [...combined, ...waItems];
    }

    // Filter by scope
    if (scopeFilter !== 'all') {
      combined = combined.filter(i => i.provider === scopeFilter);
    }

    // Sort by most recent
    combined.sort((a, b) => b.sortDate - a.sortDate);

    return combined;
  }, [delivery.items, wa.conversations, canDelivery, canWhatsApp, scopeFilter]);

  const [activeWaMessages, setActiveWaMessages] = useState([]);
  const activeWaPhone = activeConversation?.provider === 'whatsapp' ? activeConversation.id : null;

  const fetchWaMessages = wa.fetchMessages;

  const loadWaMessages = useCallback(async (phone) => {
    if (!phone) return;
    const res = await fetchWaMessages(phone);
    if (res?.messages) {
      setActiveWaMessages(res.messages);
    }
  }, [fetchWaMessages]);

  // Poll active WhatsApp conversation messages every 5 seconds
  useEffect(() => {
    if (!activeWaPhone) return;
    loadWaMessages(activeWaPhone);
    const iv = setInterval(() => {
      loadWaMessages(activeWaPhone);
    }, 5000);
    return () => clearInterval(iv);
  }, [activeWaPhone, loadWaMessages]);

  const selectConversation = useCallback(async (provider, id) => {
    setActiveConversation({ provider, id });
    if (provider === 'delivery') {
      await delivery.openConversation(id);
    } else if (provider === 'whatsapp') {
      setActiveWaMessages([]);
      await fetchWaMessages(id).then(res => {
        if (res?.messages) setActiveWaMessages(res.messages);
      });
    }
  }, [delivery, fetchWaMessages]);

  return {
    items,
    scopeFilter,
    setScopeFilter,
    activeConversation,
    selectConversation,
    canDelivery,
    canWhatsApp,
    activeWaMessages,
    delivery,
    wa,
  };
}
