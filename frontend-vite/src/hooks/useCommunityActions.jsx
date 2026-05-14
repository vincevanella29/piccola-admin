// src/hooks/useCommunityActions.jsx
// Wraps direct utils calls to respect architectural mandate: pages call hooks, hooks call utils.
import { useCallback, useMemo } from 'react';
import * as communityApi from '../utils/communityData';

export default function useCommunityActions(appState) {
  const token = appState?.token;
  const walletAddress = (appState?.account || '').toLowerCase();

  const handleAction = useCallback(async (actionFn, params = {}) => {
    if (!token || !walletAddress) return null;
    try {
      return await actionFn({ token, walletAddress, ...params });
    } catch (e) {
      console.error('Community action error:', e);
      throw e;
    }
  }, [token, walletAddress]);

  return useMemo(() => ({
    fetchMyMerits: () => handleAction(communityApi.fetchMyMerits),
    fetchMemberMeritProfile: (memberWallet, rut) => handleAction(communityApi.fetchMemberMeritProfile, { memberWallet, rut }),
    pinChannelMessage: (slug, messageId) => handleAction(communityApi.pinChannelMessage, { slug, messageId }),
    fetchDmConversations: () => handleAction(communityApi.fetchDmConversations),
    sendDmMessage: (peerWallet, text) => handleAction(communityApi.sendDmMessage, { peerWallet, text }),
    fetchDmMessages: (peerWallet) => handleAction(communityApi.fetchDmMessages, { peerWallet }),
    searchWorkers: (q) => handleAction(communityApi.searchWorkers, { q }),
    createDmChannel: (peerWallet) => handleAction(communityApi.createDmChannel, { peerWallet }),
    updateGroup: (groupId, data) => handleAction(communityApi.updateGroup, { groupId, data }),
    createGroup: (data) => handleAction(communityApi.createGroup, { data }),
    updateGroupMemberRole: (groupId, memberWallet, role) => handleAction(communityApi.updateGroupMemberRole, { groupId, memberWallet, role }),
    removeGroupMember: (groupId, memberWallet) => handleAction(communityApi.removeGroupMember, { groupId, memberWallet }),
    fetchCatalogs: () => handleAction(communityApi.fetchCatalogs),
    fetchSectionPerms: () => handleAction(communityApi.fetchSectionPerms),
    updateSectionPerms: (seccion, data) => handleAction(communityApi.updateSectionPerms, { seccion, data }),
  }), [handleAction]);
}
