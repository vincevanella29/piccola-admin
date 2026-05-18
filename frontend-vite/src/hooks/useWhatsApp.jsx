// src/hooks/useWhatsApp.jsx
// Centralized hook for WhatsApp Cloud API integration
import { useState, useCallback } from 'react';
import appData from '../utils/appData.jsx';

const useWhatsApp = ({ token, account }) => {
  const [config, setConfig] = useState(null);
  const [templates, setTemplates] = useState([]);

  const [conversations, setConversations] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const args = { accessToken: token, wallet: account };

  // ─── Config ───────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const res = await appData.waGetConfig(args);
      setConfig(res);
      setQuickReplies(res?.quick_replies || []);
      return res;
    } catch (e) { console.error('[useWhatsApp] fetchConfig:', e); }
  }, [token, account]);

  const saveConfig = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.waSaveConfig({ ...args, data });
      await fetchConfig();
      return res;
    } finally { setIsLoading(false); }
  }, [token, account, fetchConfig]);

  // ─── Templates ────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.waGetTemplates(args);
      setTemplates(res?.templates || []);
      return res;
    } catch (e) { console.error('[useWhatsApp] fetchTemplates:', e); }
    finally { setIsLoading(false); }
  }, [token, account]);

  const createTemplate = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.waCreateTemplate({ ...args, data });
      await fetchTemplates();
      return res;
    } finally { setIsLoading(false); }
  }, [token, account, fetchTemplates]);

  const deleteTemplate = useCallback(async (name) => {
    setIsLoading(true);
    try {
      const res = await appData.waDeleteTemplate({ ...args, name });
      await fetchTemplates();
      return res;
    } finally { setIsLoading(false); }
  }, [token, account, fetchTemplates]);

  // ─── Send ─────────────────────────────────────
  const sendMessage = useCallback(async (data) => {
    setIsLoading(true);
    try {
      return await appData.waSendMessage({ ...args, data });
    } finally { setIsLoading(false); }
  }, [token, account]);

  const sendBulk = useCallback(async (data) => {
    setIsLoading(true);
    try {
      return await appData.waSendBulk({ ...args, data });
    } finally { setIsLoading(false); }
  }, [token, account]);



  // ─── Quick Replies ────────────────────────────
  const fetchQuickReplies = useCallback(async () => {
    try {
      const res = await appData.waGetQuickReplies(args);
      setQuickReplies(res?.quick_replies || []);
      return res;
    } catch (e) { console.error('[useWhatsApp] fetchQuickReplies:', e); }
  }, [token, account]);

  const saveQuickReplies = useCallback(async (data) => {
    const res = await appData.waSaveQuickReplies({ ...args, data });
    setQuickReplies(data.quick_replies || []);
    return res;
  }, [token, account]);

  // ─── Conversations ────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await appData.waGetConversations(args);
      setConversations(res?.conversations || []);
      return res;
    } catch (e) { console.error('[useWhatsApp] fetchConversations:', e); }
  }, [token, account]);

  const fetchMessages = useCallback(async (phone) => {
    try {
      const res = await appData.waGetMessages({ ...args, phone });
      return res;
    } catch (e) { console.error('[useWhatsApp] fetchMessages:', e); }
  }, [token, account]);

  return {
    // Config
    config, fetchConfig, saveConfig,
    // Templates
    templates, fetchTemplates, createTemplate, deleteTemplate,
    // Send
    sendMessage, sendBulk,

    // Quick Replies
    quickReplies, fetchQuickReplies, saveQuickReplies,
    // Conversations
    conversations, fetchConversations, fetchMessages,
    // State
    isLoading,
  };
};

export default useWhatsApp;
