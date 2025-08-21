// src/hooks/useModalWallet.jsx
import { useState, useCallback, useRef } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { ethers } from 'ethers'; // Added for encoding ERC20 transfers


export function useModalWallet(account, t, appState) {
  const { exportWallet } = usePrivy();
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [error, setError] = useState('');
  const [switchingChain, setSwitchingChain] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundingUrl, setFundingUrl] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState('');
  const [exportedWallet, setExportedWallet] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedToken, setSelectedToken] = useState(null); // Added for token transfers
  // Dynamic chain/network config from .env
  const ENV_CHAIN_ID = appState.chainId;
  const ENV_NETWORK = appState.network;
  const ENV_RPC_URL = appState.rpcUrl;
  const SUPPORTED_CHAINS = [ENV_CHAIN_ID]; // Only allow the chainId from .env

  const { wallets } = useWallets();
  const { connectWallet } = usePrivy();

  // Always use account prop for wallet detection, fallback to minimal wallet object if not found
  let wallet = wallets.find((w) => w.address?.toLowerCase() === account?.toLowerCase());
  if (!wallet && account) {
    wallet = { address: account, type: 'unknown', chainId: `eip155:${ENV_CHAIN_ID}` };
  }
  const walletType = wallet?.type || 'privy';
  // Always use ENV_CHAIN_ID as fallback
  const chainId = wallet?.chainId ? parseInt(wallet.chainId.split(':')[1]) : ENV_CHAIN_ID;
  const isSupportedChain = SUPPORTED_CHAINS.includes(chainId);

  // Add a refresh trigger for balance
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const { data: balance, error: balanceError, refetch: refetchBalance } = useBalance({
    address: account,
    chainId: isSupportedChain ? chainId : undefined,
    enabled: !!account && isSupportedChain,
  });

  // Function to trigger balance refresh
  const refreshBalances = useCallback(() => {
    setBalanceRefreshKey(k => k + 1);
    if (typeof refetchBalance === 'function') refetchBalance();
  }, [refetchBalance]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [account]);

  const handleSwitchChain = useCallback(
    async (e) => {
      if (!wallet) return;
      const newChainId = parseInt(e.target.value);
      if (newChainId === chainId) return;
      setSwitchingChain(true);
      try {
        await wallet.switchChain(newChainId);
      } catch (err) {
        appState.setError(t('wallet.error_switching_chain', { message: err?.message || JSON.stringify(err) }));
      } finally {
        setSwitchingChain(false);
      }
    },
    [wallet, chainId, t],
  );

  const handleAddFunds = useCallback(async () => {
    if (!wallet) {
      appState.setError('No wallet found');
      return;
    }
    if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
      appState.setError('Ingresa un monto válido en USD');
      return;
    }
    setFundLoading(true);
    try {
      await wallet.fund({ amount: Number(fundAmount), currency: 'USD' }); // Abre el modal de MoonPay/Privy en USD
      setFundAmount('');
    } catch (e) {
      appState.setError(e.message || 'Error');
    } finally {
      setFundLoading(false);
    }
  }, [wallet, fundAmount]);

  const handleExportWallet = useCallback(async () => {
    setExportLoading(true);
    setExportError('');
    try {
      await exportWallet(); // Abre el modal nativo de export de Privy
    } catch (e) {
      setExportError(e.message || 'Error');
    } finally {
      setExportLoading(false);
    }
  }, [exportWallet]);

  const isPrivyWalletActive = wallet?.walletClientType === 'privy' || wallet?.type === 'privy';

  const handleSend = useCallback(async () => {
    if (!wallet || !sendTo || !sendAmount || !selectedToken) {
      appState.setError(t('wallet.error_invalid_params'));
      return;
    }
    // Address validation (ethers v6)
    let isValidAddress = false;
    if (ethers && typeof ethers.isAddress === 'function') {
      isValidAddress = ethers.isAddress(sendTo);
    }
    if (!isValidAddress || typeof sendTo !== 'string' || sendTo.length !== 42 || !sendTo.startsWith('0x')) {
      appState.setError(t('wallet.invalid_address'));
      return;
    }
    if (Number(sendAmount) <= 0) {
      appState.setError(t('wallet.invalid_amount'));
      return;
    }
    if (Number(sendAmount) > selectedToken.balance) {
      appState.setError(t('wallet.error_insufficient_balance'));
      return;
    }

    try {
      // Ensure wallet is on the correct chain
      if (!isSupportedChain) {
        await wallet.switchChain(ENV_CHAIN_ID);
      }

      let txParams;
      const cleanSendTo = sendTo.trim();
      if (selectedToken.isNative) {
        // Native token (MATIC) transfer
        const amountInWei = ethers.parseUnits(sendAmount, selectedToken.decimals || 18);
        txParams = {
          to: cleanSendTo,
          value: amountInWei.toString(),
        };
      } else {
        // ERC20 token transfer
        const amount = ethers.parseUnits(sendAmount, selectedToken.decimals || 18);
        const erc20Interface = new ethers.Interface([
          'function transfer(address to, uint256 amount)',
        ]);
        const data = erc20Interface.encodeFunctionData('transfer', [cleanSendTo, amount]);
        txParams = {
          to: selectedToken.address,
          data,
          chainId: ENV_CHAIN_ID,
        };
      }
      // --- Privy pattern: signTxData + sendTx ---
      let plainTextToDisplay = `Transferencia de ${selectedToken.symbol}\n` +
        `A: ${cleanSendTo}\n` +
        `Cantidad: ${sendAmount} ${selectedToken.symbol}`;
      let transferSignature;
      try {
        transferSignature = await appState.signTxData(plainTextToDisplay);
        if (!transferSignature) {
          appState.setError(t('wallet.error_transfer'));
          return;
        }
      } catch (e) {
        appState.setError(e.message || t('wallet.error_transfer'));
        return;
      }
      // Puedes agregar la firma al txParams si tu backend la requiere, o simplemente pasarla a sendTx
      let transferHash;
      try {
        transferHash = await appState.sendTx(txParams, appState);
        if (!transferHash) {
          appState.setError(t('wallet.error_transfer'));
          return;
        }
      } catch (e) {
        appState.setError(e.message || t('wallet.error_transfer'));
        return;
      }
      // Opcional: feedback visual de éxito
      appState.setSuccess(`Transferencia enviada: ${transferHash}`, transferHash);


      setSendTo('');
      setSendAmount('');
      setSelectedToken(null);
      refreshBalances(); // Refresh balances after transfer
    } catch (err) {
      appState.setError(err.message || t('wallet.error_transfer'));
    }
  }, [wallet, sendTo, sendAmount, selectedToken, t, isPrivyWalletActive, isSupportedChain, refreshBalances]);

  const handleConnectExternalWallet = useCallback(() => {
    connectWallet();
  }, [connectWallet]);

  const toggleDisclaimer = () => setShowDisclaimer((v) => !v);

  return {
    wallet,
    walletType,
    chainId,
    isSupportedChain,
    balance,
    balanceError,
    sendTo,
    setSendTo,
    sendAmount,
    setSendAmount,
    error,
    setError,
    switchingChain,
    showDisclaimer,
    setShowDisclaimer,
    toggleDisclaimer,
    copied,
    setCopied,
    showAddFunds,
    setShowAddFunds,
    fundAmount,
    setFundAmount,
    fundingUrl,
    setFundingUrl,
    fundLoading,
    fundError,
    handleAddFunds,
    exportedWallet,
    exportLoading,
    exportError,
    handleExportWallet,
    handleCopy,
    handleSwitchChain,
    handleSend,
    handleConnectExternalWallet,
    isPrivyWalletActive,
    selectedToken, // Added
    setSelectedToken, // Added
    refreshBalances, // Ensure refreshBalances is exported
  };
}