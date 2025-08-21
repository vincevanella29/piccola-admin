import { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { usePrivy, useLogin, useWallets, useSendTransaction } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { BrowserProvider, ethers } from 'ethers';
import appData from '../utils/appData.jsx';
import { getContractInstance } from '../context/contracts.js';
import { getToken } from 'firebase/messaging';

export const useWallet = ({ provider, chainId, rpcUrl, blockExplorer, setError, setPageLoading, firebase, vapidKey }) => {
  const { t } = useTranslation();
  const { sendTransaction, isLoading, error } = useSendTransaction();
  const { ready, authenticated, logout, user, isLoading: isPrivyLoading, getAccessToken, link } = usePrivy();
  const { login: connectWalletPrivy } = useLogin({
    onComplete: async (user, isNewUser, wasAlreadyAuthenticated, loginMethod) => {
      if (user.wallet && !wasAlreadyAuthenticated) {
        const privyWallet = wallets.find((w) => w.address === user.wallet.address);
        if (privyWallet) {
          await setActiveWallet(privyWallet);
        }
      }
    },
    onError: (error) => {
      console.error('[useWallet] Login error:', error);
    },
  });
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const privyWallet = setActiveWallet;

  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roleLevel, setRoleLevel] = useState(-1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletDataReady, setIsWalletDataReady] = useState(false);
  const hasAuthenticatedRef = useRef(false);
  const isPrivyWalletActive = user?.wallet?.walletClientType === 'privy';
  const pendingWalletRef = useRef(null);

  const ensureCorrectNetwork = useCallback(
    async (walletAddress) => {
      if (isPrivyWalletActive || !window.ethereum || !walletAddress) {
        return true;
      }
      try {
        const browserProvider = new BrowserProvider(window.ethereum);
        const network = await browserProvider.getNetwork();
        const currentChainId = Number(network.chainId);
        if (currentChainId === chainId) {
          return true;
        }
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
          const newProvider = new BrowserProvider(window.ethereum);
          const newNetwork = await newProvider.getNetwork();
          if (Number(newNetwork.chainId) !== chainId) {
            setError(`Failed to switch to chainId ${chainId}`);
            return false;
          }
          return true;
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${chainId.toString(16)}`,
                  rpcUrls: [rpcUrl],
                  chainName: 'Polygon Amoy',
                  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                  blockExplorerUrls: [blockExplorer],
                },
              ],
            });
            return true;
          }
          setError(switchError.message);
          return false;
        }
      } catch (error) {
        setError(t('wallet.network_check_failed', { error: error.message }));
        return false;
      }
    },
    [isPrivyWalletActive, chainId, rpcUrl, blockExplorer]
  );

  // Nueva función: getSigner
  const getSigner = useCallback(
    async () => {
      const account = address || user?.wallet?.address;
      if (!account) {
        setError(t('wallet.no_wallet_connected'));
        return;
      }

      await ensureCorrectNetwork(account);

      let ethersProvider;
      if (isPrivyWalletActive && privyWallet && typeof privyWallet.getEthereumProvider === 'function') {
        const privyProvider = await privyWallet.getEthereumProvider();
        ethersProvider = new BrowserProvider(privyProvider);
      } else if (window.ethereum) {
        ethersProvider = new BrowserProvider(window.ethereum);
        const network = await ethersProvider.getNetwork();
        if (Number(network.chainId) !== chainId) {
          setError(t('wallet.wallet_on_wrong_network', { current: network.chainId, expected: chainId }));
          return false;
        }
      } else {
        setError(t('wallet.no_compatible_wallet_provider_detected'));
        return false;
      }

      const signer = await ethersProvider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== account.toLowerCase()) {
        setError(t('wallet.signer_address_does_not_match_connected_wallet'));
        return false;
      }

      return signer;
    },
    [address, user, isPrivyWalletActive, privyWallet, ensureCorrectNetwork, chainId]
  );

  useEffect(() => {
    if (!ready || hasAuthenticatedRef.current || isConnecting) {
      if (ready && !isConnecting) {
        setIsWalletDataReady(true);
      }
      return;
    }

    const checkSession = async () => {
      try {
        const walletAddress = address || user?.wallet?.address;
        const accessToken = await getAccessToken();

        if (!walletAddress || !accessToken) {
          setIsAuthenticated(false);
          setRoleLevel(-1);
          setIsWalletDataReady(true);
          return;
        }

        await ensureCorrectNetwork(walletAddress);

        // Obtener token de notificación
        let notificationToken = null;
        let permissionsGranted = false;
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            notificationToken = await getToken(firebase.messaging, { vapidKey });
            permissionsGranted = true;
          }
        } catch (err) {
          console.error('Error obteniendo token de notificación:', err);
        }

        await appData.loginWithPrivy({ 
          accessToken, 
          wallet: walletAddress.toLowerCase(),
          notification_token: notificationToken,
          device_type: 'web',
          permissions_granted: permissionsGranted
        });
        const res = await appData.fetchUserRole({ accessToken, walletAddress: walletAddress.toLowerCase() });
        setProfile(res.profile);

        pendingWalletRef.current = walletAddress.toLowerCase();
        setRoleLevel(res.role_level ?? -1);
        setAccount(walletAddress.toLowerCase());
        setIsAuthenticated(true);
        hasAuthenticatedRef.current = true;
      } catch (err) {
        setIsAuthenticated(false);
        setProfile(null);
        setRoleLevel(-1);
        pendingWalletRef.current = null;
      } finally {
        setIsWalletDataReady(true);
      }
    };

    checkSession();
  }, [ready, address, user, ensureCorrectNetwork, isConnecting]);

  const connectWallet = useCallback(
    async (appState) => {
      // Si el usuario ya está autenticado y tiene wallet: usar link() para multi-cuenta
      if (authenticated && user && user.wallet) {
        setError(t('wallet.already_logged_in_linking'));
        try {
          await link();
          setIsWalletDataReady(true);
        } catch (linkErr) {
          setError(t('wallet.link_account_failed_with_error', { error: linkErr?.message || linkErr?.toString() }));
        }
        return;
      }

      // Si el usuario está autenticado pero NO tiene wallet: intentar linkear, si falla desloguear
      if (authenticated && user && !user.wallet) {
        setError(t('wallet.authenticated_no_wallet_linking'));
        try {
          await link();
          // Esperamos a que user.wallet aparezca (puede requerir refrescar el estado externo)
          // Si después de link sigue sin wallet, deslogueamos
          if (!user.wallet) {
            setError(t('wallet.link_wallet_failed_logout'));
            await logout();
            disconnect();
            setAccount(null);
            setProfile(null);
            setRoleLevel(-1);
            setIsAuthenticated(false);
            setIsWalletDataReady(false);
            hasAuthenticatedRef.current = false;
            pendingWalletRef.current = null;
          }
        } catch (linkErr) {
          setError(t('wallet.link_account_failed_with_error', { error: linkErr?.message || linkErr?.toString() }));
          await logout();
          disconnect();
          setAccount(null);
          setProfile(null);
          setRoleLevel(-1);
          setIsAuthenticated(false);
          setIsWalletDataReady(false);
          hasAuthenticatedRef.current = false;
          pendingWalletRef.current = null;
        }
        return;
      }

      // Solo si NO está autenticado, intentar login
      setIsConnecting(true);
      setIsWalletDataReady(false);
      try {
        connectWalletPrivy();

        let walletAddress;
        let retries = 120;
        while (!walletAddress && retries > 0 && authenticated) {
          walletAddress = address || user?.wallet?.address || wallets[0]?.address;
          if (!walletAddress) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries--;
          }
        }

        if (!walletAddress && retries === 0) {
          setError(t('wallet.error_wallet_not_found'));
          setIsConnecting(false);
          setIsWalletDataReady(false);
          return;
        }

        const privyWallet = wallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
        if (privyWallet) {
          await setActiveWallet(privyWallet);
        }

        await ensureCorrectNetwork(walletAddress);
        const accessToken = await getAccessToken();
        if (!accessToken && retries === 0 && authenticated) {
          setError(t('wallet.no_privy_access_token'));
          setIsConnecting(false);
          setIsWalletDataReady(false);
          return;
        }

        // Obtener token de notificación
        let notificationToken = null;
        let permissionsGranted = false;
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            notificationToken = await getToken(firebase.messaging, { vapidKey });
            permissionsGranted = true;
          }
        } catch (err) {
          console.error('Error obteniendo token de notificación:', err);
        }

        await appData.loginWithPrivy({ 
          accessToken, 
          wallet: walletAddress.toLowerCase(),
          notification_token: notificationToken,
          device_type: 'web',
          permissions_granted: permissionsGranted
        });
        const res = await appData.fetchUserRole({ accessToken, walletAddress: walletAddress.toLowerCase() });
        setProfile(res.profile);

        pendingWalletRef.current = walletAddress.toLowerCase();
        setRoleLevel(res.role_level ?? -1);
        setAccount(walletAddress.toLowerCase());
        setIsAuthenticated(true);
        hasAuthenticatedRef.current = true;
      } catch (err) {
        // Manejo robusto de sesión rota o "user is already logged in"
        const errMsg = err?.message || err?.toString() || '';
        if (
          errMsg.includes('user is already logged in') ||
          errMsg.includes('already logged in')
        ) {
          if (user && user.wallet) {
            // Sesión válida: intentar vincular otra cuenta
            setError(t('wallet.already_logged_in_linking'));
            try {
              await link();
              // Opcional: puedes mostrar un mensaje de éxito aquí
            } catch (linkErr) {
              setError(t('wallet.link_account_failed_with_error', { error: linkErr?.message || linkErr?.toString() }));
            }
            setIsConnecting(false);
            setIsWalletDataReady(true);
            return;
          } else {
            // Sesión rota/incompleta: forzar logout
            setError(t('wallet.session_incomplete_or_broken'));
            try {
              await logout();
              disconnect();
            } catch (logoutErr) {
              setError(t('wallet.error_forcing_logout', { error: logoutErr?.message || logoutErr?.toString() }));
            }
            setAccount(null);
            setProfile(null);
            setRoleLevel(-1);
            setIsAuthenticated(false);
            setIsWalletDataReady(false);
            hasAuthenticatedRef.current = false;
            pendingWalletRef.current = null;
            return;
          }
        }
        if (
          errMsg.includes('OAuth code either expired or invalid') ||
          errMsg.includes('invalid_credentials')
        ) {
          setError(t('wallet.oauth_expired_or_invalid'));
          setIsConnecting(false);
          setIsWalletDataReady(false);
          hasAuthenticatedRef.current = false;
          pendingWalletRef.current = null;
          await logout();
          disconnect();
          return;
        }
        if (user && !user.wallet) {
          setError(t('wallet.session_incomplete_or_broken'));
          try {
            await logout();
            disconnect();
          } catch (logoutErr) {
            setError(t('wallet.error_forcing_logout', { error: logoutErr?.message || logoutErr?.toString() }));
          }
          setAccount(null);
          setProfile(null);
          setRoleLevel(-1);
          setIsAuthenticated(false);
          setIsWalletDataReady(false);
          hasAuthenticatedRef.current = false;
          pendingWalletRef.current = null;
          return;
        }
        setIsAuthenticated(false);
        setRoleLevel(-1);
        setAccount(null);
        setProfile(null);
        pendingWalletRef.current = null;
      } finally {
        setIsConnecting(false);
        setIsWalletDataReady(true);
      }
    },
    [authenticated, address, user, wallets, connectWalletPrivy, setActiveWallet, ensureCorrectNetwork, logout, disconnect]
  );

  const sendTx = useCallback(
    async (tx, appState) => {
      const wallet = user?.wallet;
      const privyActive = isPrivyWalletActive;
      const account = address || user?.wallet?.address;
      try {
        if (privyActive && sendTransaction && wallet && wallet.address) {
          await ensureCorrectNetwork(wallet.address);
          const txWithChainId = { ...tx, chainId };
          const result = await sendTransaction(txWithChainId);
          return result;
        }
        if (!account) {
          setError(t('wallet.no_wallet_connected'));
          return;
        }
        const signer = await getSigner();
        const txToSend = {
          to: tx.to,
          data: tx.data,
          ...(tx.value && { value: tx.value }),
          ...(tx.gas && { gasLimit: tx.gas }),
          ...(tx.gasPrice && { gasPrice: tx.gasPrice }),
          chainId: chainId,
        };
        const result = await signer.sendTransaction(txToSend);
        return result.hash;
      } catch (error) {
        setError(t('wallet.error_sending_transaction', { error: error.message }));
        return;
      }
    },
    [user, isPrivyWalletActive, address, sendTransaction, getSigner]
  );

  const disconnectWallet = useCallback(async (appState) => {
    try {
      await logout();
      disconnect();
    } catch (err) {
      setError(t('wallet.error_in_logout', { error: err?.message || err?.toString() }));
    } finally {
      setAccount(null);
      setProfile(null);
      setRoleLevel(-1);
      setIsAuthenticated(false);
      setIsWalletDataReady(false);
      hasAuthenticatedRef.current = false;
      pendingWalletRef.current = null;
    }
  }, [logout, disconnect]);

  const signMessage = useCallback(
    async (message) => {
      if (!address && !user?.wallet?.address) setError(t('wallet.no_address'));
      return await signMessageAsync({ message });
    },
    [address, user, signMessageAsync]
  );

  const [accessToken, setAccessToken] = useState(null);
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getAccessToken();
        setAccessToken(token);
      } catch {
        setAccessToken(null);
      }
    };
    fetchToken();
  }, [ready, authenticated, user, address]);

  const signTxData = useCallback(
    async (payload, appState) => {
      const message = payload;
      const account = address || user?.wallet?.address;
      try {
        if (isPrivyWalletActive) {
          await ensureCorrectNetwork(account);
          const signature = await signMessage(message, appState);
          let recovered;
          try {
            recovered = ethers.verifyMessage(message, signature);
          } catch (e) {
            setError(t('wallet.error_verifying_message'));
            return;
          }
          if (recovered.toLowerCase() !== account.toLowerCase()) {
            setError(t('wallet.signature_does_not_match_connected_wallet'));
            return;
          }
          return signature;
        }
        if (account) {
          const signer = await getSigner();
          return await signer.signMessage(message, appState);
        }
        setError(t('wallet.no_wallet_connected_or_authenticated'));
        return;
      } catch (error) {
        setError(t('wallet.error_signing_transaction', { error: error.message }));
        return;
      }
    },
    [accessToken, signMessage, isPrivyWalletActive, address, user, getSigner]
  );

  return {
    account,
    profile,
    setProfile,
    connectWallet,
    disconnectWallet,
    isConnecting,
    roleLevel,
    isAuthenticated,
    user,
    ready,
    signMessage,
    isPrivyLoading,
    isPrivyWalletActive,
    isWalletDataReady,
    sendTransaction,
    accessToken,
    error,
    provider,
    signTxData,
    sendTx,
    privyWallet,
    ensureCorrectNetwork,
    getSigner, // Nueva función exportada
  };
};

export default useWallet;