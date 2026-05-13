import { useState, useCallback, useMemo } from 'react';
import useChannels from '../useChannels';
import useGroups from '../useGroups';
import usePresence from '../usePresence';
import useCommunityActions from '../useCommunityActions';

export default function useCommunityTab({ appState }) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase();
  const adminLevel = appState?.companyRoleLevel ?? appState?.roleLevel ?? 0;
  const isAdmin = adminLevel === 3 || adminLevel === 4;

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

  // DM state
  const [dmPeer, setDmPeer] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);

  const handleSelectChannel = useCallback((slug) => {
    setMode('channel');
    groupHook.disconnectWs();
    setDmPeer(null);
    channelHook.openChannel(slug);
  }, [channelHook, groupHook]);

  const handleSelectGroup = useCallback((groupId) => {
    setMode('group');
    channelHook.disconnectWs();
    setDmPeer(null);
    groupHook.openGroup(groupId);
  }, [channelHook, groupHook]);

  const handlePinMessage = useCallback(async (messageId) => {
    if (!channelHook.activeSlug) return;
    await actions.pinChannelMessage(channelHook.activeSlug, messageId);
  }, [actions, channelHook.activeSlug]);

  const handleSelectDmPeer = useCallback(async (peer) => {
    setMode('dm');
    channelHook.disconnectWs();
    groupHook.disconnectWs();
    setDmPeer(peer);
    try {
      const res = await actions.fetchDmMessages(peer.wallet);
      setDmMessages(Array.isArray(res) ? res : (res?.messages || []));
    } catch {
      setDmMessages([]);
    }
  }, [actions, channelHook, groupHook]);

  const handleSendDm = useCallback(async (text) => {
    if (!dmPeer?.wallet || !text) return;
    try {
      await actions.sendDmMessage(dmPeer.wallet, text);
      const res = await actions.fetchDmMessages(dmPeer.wallet);
      setDmMessages(Array.isArray(res) ? res : (res?.messages || []));
    } catch (e) {
      console.error('DM send error:', e);
    }
  }, [actions, dmPeer]);

  const handleMemberClick = useCallback((member) => {
    setSelectedMemberProfile(member);
  }, []);

  return {
    token, walletAddress, isAdmin,
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
    dmMessages, setDmMessages,
    handleSelectChannel, handleSelectGroup, handlePinMessage,
    handleSelectDmPeer, handleSendDm, handleMemberClick
  };
}
