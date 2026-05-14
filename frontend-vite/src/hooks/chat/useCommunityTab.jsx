import { useState, useCallback, useMemo, useEffect } from 'react';
import useChannels from '../useChannels';
import useGroups from '../useGroups';
import usePresence from '../usePresence';
import useCommunityActions from '../useCommunityActions';
import useDmChat from './useDmChat';
import { setSectionColorOverrides } from '../../pages/chat/components/community/sectionColors';

export default function useCommunityTab({ appState }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase();
  const adminLevel = appState?.companyRoleLevel ?? appState?.roleLevel ?? 0;
  const isAdmin = adminLevel === 3 || adminLevel === 4;
  const canPin = adminLevel >= 3 && adminLevel <= 5;

  const channelHook = useChannels({ appState, enabled: true });
  const groupHook = useGroups({ appState, enabled: true });
  const presence = usePresence({ appState, enabled: true });
  const actions = useCommunityActions(appState);

  const [mode, setMode] = useState(null); // 'channel' | 'group' | 'dm' | null
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(true);
  const [showSectionPerms, setShowSectionPerms] = useState(false);
  const [selectedGroupForSettings, setSelectedGroupForSettings] = useState(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);

  // Initialize global section color overrides on mount
  useEffect(() => {
    if (token && walletAddress && actions) {
      actions.fetchSectionPerms().then(res => {
        if (res?.sections) {
          const overrides = {};
          res.sections.forEach(s => {
            if (s.color) overrides[s.seccion.toLowerCase()] = s.color;
          });
          setSectionColorOverrides(overrides);
        }
      }).catch(() => {});
    }
  }, [token, walletAddress, actions]);
  
  // DM state
  const [dmPeer, setDmPeer] = useState(null);
  const [dmConversations, setDmConversations] = useState([]);
  const [dmConvosLoading, setDmConvosLoading] = useState(false);

  // Real-time DM hook
  const dmChat = useDmChat({
    appState,
    peer: dmPeer,
    enabled: mode === 'dm' && !!dmPeer,
  });

  // Load DM conversations list
  const loadDmConversations = useCallback(async () => {
    if (!token || !walletAddress) return;
    setDmConvosLoading(true);
    try {
      const res = await actions.fetchDmConversations();
      const list = Array.isArray(res) ? res : (res?.conversations || res?.data || []);
      setDmConversations(list);
    } catch {
      setDmConversations([]);
    } finally {
      setDmConvosLoading(false);
    }
  }, [token, walletAddress, actions]);

  // Load DM conversations on mount
  useEffect(() => {
    if (token && walletAddress) {
      loadDmConversations();
    }
  }, [token, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectChannel = useCallback((slug) => {
    setMode('channel');
    groupHook.disconnectWs();
    dmChat.disconnectWs();
    setDmPeer(null);
    channelHook.openChannel(slug);
  }, [channelHook, groupHook, dmChat]);

  const handleSelectGroup = useCallback((groupId) => {
    setMode('group');
    channelHook.disconnectWs();
    dmChat.disconnectWs();
    setDmPeer(null);
    groupHook.openGroup(groupId);
  }, [channelHook, groupHook, dmChat]);

  const handlePinMessage = useCallback(async (messageId) => {
    if (!channelHook.activeSlug) return;
    await actions.pinChannelMessage(channelHook.activeSlug, messageId);
  }, [actions, channelHook.activeSlug]);

  const handleSelectDmPeer = useCallback(async (peer) => {
    setMode('dm');
    channelHook.disconnectWs();
    groupHook.disconnectWs();
    setDmPeer(peer);
    // Refresh conversations list
    loadDmConversations();
  }, [channelHook, groupHook, loadDmConversations]);

  // Select from conversation list (sidebar click)
  const handleSelectDmConvo = useCallback((convo) => {
    const peerWallet = (convo.peer_wallet || '').toLowerCase();
    const employee = peerWallet ? presence.employeeMap[peerWallet] : null;

    // Build peer object from conversation data, enriched by employee directory
    const peer = {
      wallet: convo.peer_wallet,
      name: convo.peer_name || employee?.name || convo.peer_wallet,
      cargo: convo.peer_cargo || employee?.cargo,
      seccion: convo.peer_seccion || employee?.seccion,
      profile_image_url: convo.peer_profile_image_url || employee?.profile_image_url,
    };
    handleSelectDmPeer(peer);
  }, [handleSelectDmPeer, presence.employeeMap]);

  const handleSendDm = useCallback(async (text) => {
    if (!dmPeer?.wallet || !text) return;
    await dmChat.sendMessage(text);
    // Refresh conversations list after sending
    loadDmConversations();
  }, [dmChat, dmPeer, loadDmConversations]);

  const handleMemberClick = useCallback((member) => {
    setSelectedMemberProfile(member);
  }, []);

  return {
    token, walletAddress, isAdmin, adminLevel, canPin,
    channelHook, groupHook, presence,
    mode, setMode,
    showCreateChannel, setShowCreateChannel,
    showCreateGroup, setShowCreateGroup,
    showDmPicker, setShowDmPicker,
    showMembersPanel, setShowMembersPanel,
    showSectionPerms, setShowSectionPerms,
    selectedGroupForSettings, setSelectedGroupForSettings,
    selectedMemberProfile, setSelectedMemberProfile,
    dmPeer, setDmPeer,
    dmChat,
    dmConversations, dmConvosLoading, loadDmConversations,
    handleSelectChannel, handleSelectGroup, handlePinMessage,
    handleSelectDmPeer, handleSelectDmConvo, handleSendDm, handleMemberClick
  };
}
