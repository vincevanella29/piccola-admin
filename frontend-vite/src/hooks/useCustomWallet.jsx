import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSignMessage, useSendTransaction } from '@privy-io/react-auth';
import { ethers } from 'ethers';

export const useCustomWallet = (appState) => {
  const { t } = useTranslation();
  const { signMessage } = useSignMessage();
  const { sendTransaction } = useSendTransaction();
  
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentUiOptions, setCurrentUiOptions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Ref para evitar múltiples ejecuciones
  const isProcessingRef = useRef(false);
  // Ref para coordinar transiciones suaves entre modales (evitar flicker)
  const transitionTimeoutRef = useRef(null);

  // --- HELPER: Simular Transacción y Calcular Costos ---
  const simulateTransaction = async (tx) => {
    try {
      // Usamos el signer que ya construye useWallet (puede venir de Privy o de window.ethereum)
      if (!appState?.getSigner) return null;

      const signer = await appState.getSigner();
      if (!signer) return null;

      // Provider prioritario: el RPC público que ya usas en la app (más estable para estimar gas)
      const ethProvider = appState.provider || signer.provider;
      if (!ethProvider) {
        console.warn('[useCustomWallet] No hay provider disponible para simular transacción');
        return null;
      }
      const address = await signer.getAddress();

      // 1. Obtener balance siempre
      const balance = await ethProvider.getBalance(address);

      let gasLimit;
      let gasPrice;

      // Si el backend ya seteó gas y gasPrice en la tx, usar directamente esos valores
      if (tx.gas && tx.gasPrice) {
        try {
          gasLimit = BigInt(tx.gas);
          gasPrice = BigInt(tx.gasPrice);
        } catch (e) {
          console.warn('[useCustomWallet] gas/gasPrice de backend no son BigInt válidos, fallback a estimación', e);
        }
      }

      // Fallback: estimar usando RPC si no tenemos gas/gasPrice válidos
      if (!gasLimit || !gasPrice) {
        const [feeData, gasEstimate] = await Promise.all([
          ethProvider.getFeeData(),
          ethProvider.estimateGas({ ...tx, from: address }).catch((e) => {
            console.warn('[useCustomWallet] Falló estimación de gas, usando valor por defecto', e);
            return 300000n; // Default fallback
          }),
        ]);

        gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
        gasLimit = gasEstimate;
      }

      const estimatedGasCost = gasLimit * gasPrice;
      const value = tx.value ? BigInt(tx.value) : 0n;
      const totalRequired = value + estimatedGasCost;

      // 3. Formatear para humanos
      return {
        balanceRaw: balance,
        balanceFormatted: parseFloat(ethers.formatEther(balance)).toFixed(4),
        gasCostFormatted: parseFloat(ethers.formatEther(estimatedGasCost)).toFixed(6),
        totalFormatted: parseFloat(ethers.formatEther(totalRequired)).toFixed(4),
        hasFunds: balance >= totalRequired,
        symbol: appState.chainId === 137 || appState.chainId === 80002 ? 'MATIC' : 'ETH',
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      };
    } catch (error) {
      console.warn('[useCustomWallet] Error simulando transacción (se omite sección de costos):', error);
      return null;
    }
  };

  // Función personalizada para enviar transacciones
  const customSendTransaction = useCallback(async (transaction, uiOptions = {}) => {
    return new Promise(async (resolve, reject) => {
      // Limpiar cualquier transición pendiente
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }

      // Cerrar cualquier modal de firma antes de abrir el de transacción
      setIsSignatureModalOpen(false);
      setCurrentMessage('');

      setCurrentTransaction(transaction);
      
      // 1. Calcular costos antes de abrir (UX: Mostrar info real)
      const simulationData = await simulateTransaction(transaction);
      
      // 2. Inyectar datos financieros en las opciones de UI
      const enrichedUiOptions = {
        ...uiOptions,
        financials: simulationData // Pasamos esto al Modal
      };

      setCurrentUiOptions(enrichedUiOptions);
      setError(null);
      setSuccess(false);

      // Pequeño delay para que las transiciones se vean más suaves (cerrar -> pausar -> abrir)
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransactionModalOpen(true);
        transitionTimeoutRef.current = null;
      }, 220);

      window.customTransactionResolve = resolve;
      window.customTransactionReject = reject;
    });
  }, [appState]); // Agregamos appState a deps

  // Función personalizada para firmar mensajes
  const customSignMessage = useCallback(async (message, uiOptions = {}) => {
    return new Promise((resolve, reject) => {
      // Limpiar cualquier transición pendiente
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }

      // Cerrar cualquier modal de transacción antes de abrir el de firma
      setIsTransactionModalOpen(false);
      setCurrentTransaction(null);

      setCurrentMessage(message);
      setCurrentUiOptions(uiOptions);
      setError(null);
      setSuccess(false);

      // Pequeño delay para que no se vean dos modales "flasheando" a la vez
      transitionTimeoutRef.current = setTimeout(() => {
        setIsSignatureModalOpen(true);
        transitionTimeoutRef.current = null;
      }, 220);

      window.customSignatureResolve = resolve;
      window.customSignatureReject = reject;
    });
  }, []);

  // Handler para transacciones con useSendTransaction
  const handleTransactionConfirm = useCallback(async () => {
    if (isProcessingRef.current) {
      return;
    }
    
    isProcessingRef.current = true;
    setIsLoading(true);
    setError(null);
      
    try {
      // No tocamos la tx ni la chain: usamos siempre el sendTx ya existente
      const result = await appState.sendTx(currentTransaction, appState);
      
      if (!result) {
        throw new Error('No se recibió hash de transacción');
      }
      
      let hashValue;
      if (typeof result === 'string') {
        hashValue = result;
      } else if (result && typeof result === 'object') {
        hashValue = result.hash || result.transactionHash || result.txHash || result;
      } else {
        throw new Error('Formato de resultado de transacción inválido');
      }
      
      if (typeof hashValue !== 'string' || !hashValue.startsWith('0x')) {
        throw new Error(`Hash de transacción inválido: ${hashValue}`);
      }

      // Intentar confirmar on-chain usando el provider, si está disponible
      if (appState?.provider) {
        try {
          const receipt = await appState.provider.waitForTransaction(hashValue);
          if (!receipt || receipt.status !== 1) {
            throw new Error(t('transaction.failed_onchain'));
          }
        } catch (waitErr) {
          console.error('[useCustomWallet] Error esperando receipt de transacción:', waitErr);
          throw waitErr;
        }
      }
      
      // Actualizar UI a éxito antes de cerrar
      setSuccess(true);
      
      if (window.customTransactionResolve) {
        window.customTransactionResolve(hashValue);
      }
      
    } catch (err) {
      console.error('[useCustomWallet] Transaction error:', err);
      setError(err.message || t('transaction.error'));
      
      // NO rechazar la promesa inmediatamente si quieres que el usuario pueda reintentar
      // Si prefieres cerrar al error:
      /* if (window.customTransactionReject) {
        window.customTransactionReject(err);
      }
      */
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [currentTransaction, appState, t, sendTransaction]);

  // **HANDLER CON DEBUGGING**: Firma manteniendo whitelabel con normalización
  const handleSignatureConfirm = useCallback(async () => {
    if (isProcessingRef.current) {
      return;
    }
    
    isProcessingRef.current = true;
    setIsLoading(true);
    setError(null);
      
    try {
      let signature;
      const msg = typeof currentMessage === 'string' ? currentMessage : JSON.stringify(currentMessage);
      signature = ethers.id(msg);
      
      if (!signature) {
        throw new Error('No se pudo generar la firma simulada');
      }
      
      
      
      setSuccess(true);

      if (window.customSignatureResolve) {
        window.customSignatureResolve(signature);
      }
      
      setTimeout(() => {
        setIsSignatureModalOpen(false);
        setCurrentMessage('');
        setCurrentUiOptions({});
        setError(null);
        setSuccess(false);
        setIsLoading(false);
        isProcessingRef.current = false;
      }, 1500);
      
    } catch (err) {
      console.error('[useCustomWallet] Error en proceso de firma:', err);
      setError(err.message || t('signature.error'));
      // Permitir reintento no cerrando el modal automáticamente en error
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [currentMessage, appState, t, signMessage]);

  // Resto de handlers
  const handleTransactionCancel = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setIsTransactionModalOpen(false);
    setCurrentTransaction(null);
    setCurrentUiOptions({});
    setError(null);
    setSuccess(false);
    isProcessingRef.current = false;
      
    if (window.customTransactionReject) {
      window.customTransactionReject(new Error('User cancelled transaction'));
    }
  }, []);

  const handleSignatureCancel = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setIsSignatureModalOpen(false);
    setCurrentMessage('');
    setCurrentUiOptions({});
    setError(null);
    setSuccess(false);
    isProcessingRef.current = false;
      
    if (window.customSignatureReject) {
      window.customSignatureReject(new Error('User cancelled signature'));
    }
  }, []);

  const closeTransactionModal = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setIsTransactionModalOpen(false);
    setCurrentTransaction(null);
    setCurrentUiOptions({});
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    isProcessingRef.current = false;
  }, []);

  const closeSignatureModal = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setIsSignatureModalOpen(false);
    setCurrentMessage('');
    setCurrentUiOptions({});
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    isProcessingRef.current = false;
  }, []);

  return {
    customSendTransaction,
    customSignMessage,
    isTransactionModalOpen,
    isSignatureModalOpen,
    currentTransaction,
    currentMessage,
    currentUiOptions, // Aquí viaja la info financiera ahora
    isLoading,
    error,
    success,
    handleTransactionConfirm,
    handleTransactionCancel,
    handleSignatureConfirm,
    handleSignatureCancel,
    closeTransactionModal,
    closeSignatureModal,
  };
};

export default useCustomWallet;