import { useEffect, useMemo } from 'react';
import useConversionEvents from './useConversionEvents.jsx';

// New minimal hook that delegates to useConversionEvents
// Removes all Drip logic. Only dispatches events to active providers.

const useConversionTracker = ({ profile, accessToken, account }) => {
  const {
    ready,
    appState,
    setUser,
    // core helpers
    trackPageView,
    trackViewItem,
    trackStake,
    trackUnstake,
    trackClaimStake,
    trackWalletCreated,
    trackTransfer,
    trackFundingStart,
    trackFundingCompleted,
    trackFundingFailed,
    trackSwap,
  } = useConversionEvents({ token: accessToken, account, debug: false });

  // keep user context in trackers
  useEffect(() => {
    if (account) {
      setUser({ walletAddress: (account || '').toLowerCase(), email: profile?.email });
    }
  }, [account, profile?.email, setUser]);

  // Optional memo for consumers
  const isReady = useMemo(() => !!ready, [ready]);

  return {
    ready: isReady,
    appState, // for useNotifications
    // helpers
    trackPageView,
    trackViewItem,
    trackStake,
    trackUnstake,
    trackClaimStake,
    trackWalletCreated,
    trackTransfer,
    trackFundingStart,
    trackFundingCompleted,
    trackFundingFailed,
    trackSwap,
  };
};

export default useConversionTracker;