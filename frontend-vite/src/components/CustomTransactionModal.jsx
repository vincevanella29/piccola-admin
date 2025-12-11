import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, AlertTriangle, CheckCircle2, ExternalLink, Copy, 
  ArrowRightLeft, Key, Layers, Wallet, Loader2, ShieldCheck, 
  Fuel, Coins, Calculator, Lock, Terminal 
} from 'lucide-react';
import { useWalletBalances } from '../hooks/useWalletBalances.jsx';

// --- Subcomponente para filas de detalle ---
// NOTA: Se ha mejorado para manejar direcciones y valores con iconos relevantes
const DetailRow = ({ label, value, type = 'text', icon, valueClass = '', onCopy, copied, isAddress = false, isValue = false }) => {
  const Icon = isAddress ? Lock : (isValue ? Coins : (icon || null));
  const displayValue = isAddress && value ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

  return (
    <div className="flex justify-between items-start text-sm py-1">
      <span className="text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 font-medium">
        {Icon && <Icon size={14} className="text-light-accent dark:text-dark-accent" />} 
        {label}
      </span>
      <div className="flex items-center gap-2 max-w-[60%] ml-4">
        <span 
          className={`text-right ${isAddress ? 'font-mono text-xs' : 'font-semibold'} text-light-text-primary dark:text-dark-text-primary ${valueClass}`}
        >
          {displayValue}
        </span>
        {onCopy && (
          <button 
            onClick={() => onCopy(value)} 
            className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
            title={copied ? 'Copiado' : 'Copiar'}
          >
            {copied ? <CheckCircle2 size={12} className="text-green-500"/> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
};

// --- Subcomponente para mostrar la tabla de Data de Contrato (Human Readable) ---
const ContractDataDisplay = ({ dataSummary, transaction, t }) => {
    // Función para formatear el valor de manera legible
    const formatValue = (value) => {
        if (typeof value === 'boolean') return value ? t('common.yes', 'Sí') : t('common.no', 'No');
        if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
            return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); // Formato de miles
        }
        return String(value);
    };

    return (
        <div className="bg-light-background dark:bg-dark-background rounded-xl p-4 space-y-3 shadow-inner">
            {/* Título Principal */}
            {dataSummary.type && (
                <div className="text-sm font-extrabold text-light-text-primary dark:text-dark-text-primary border-b border-light-border/50 dark:border-dark-border/50 pb-2">
                    {dataSummary.type}
                </div>
            )}

            {/* Subtítulo Opcional */}
            {dataSummary.title && (
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {dataSummary.title}
                </p>
            )}

            {/* Tabla de Detalles con DL/DT/DD para accesibilidad y alineación */}
            <dl className="mt-2 space-y-1">
                {Object.entries(dataSummary.data || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-start text-xs">
                        {/* Clave (dt) */}
                        <dt className="text-light-text-secondary dark:text-dark-text-secondary font-medium mr-2 max-w-[40%]">
                            {key}
                        </dt>
                        {/* Valor (dd) */}
                        <dd className="text-light-text-primary dark:text-dark-text-primary font-semibold text-right break-all max-w-[60%]">
                            {formatValue(value)}
                        </dd>
                    </div>
                ))}
            </dl>

            {/* Metadatos */}
            <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary pt-2 border-t border-light-border/50 dark:border-dark-border/50">
                {t('transaction.hex_data_bytes', { bytes: (transaction.data.length - 2) / 2 })}
            </div>
        </div>
    );
};

// --- Componente Principal ---
const CustomTransactionModal = ({
  isOpen,
  onClose,
  transaction,
  uiOptions = {},
  appState,
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
  success = false
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState('');
  const [showHexData, setShowHexData] = useState(false);

  // ... (Toda la lógica de props, estados y hooks se mantiene igual)
  const {
    title = t('transaction.send_transaction', 'Enviar Transacción'),
    description = t('transaction.review_confirm', 'Revisa los detalles y confirma la transacción.'),
    buttonText = t('transaction.submit', 'Confirmar Transacción'),
    transactionInfo,
    isCancellable = true,
    successHeader = t('transaction.complete', 'Transacción Completa'),
    successDescription = t('transaction.all_set', 'Tu transacción ha sido procesada correctamente.'),
    financials 
  } = uiOptions;

  const account = appState?.account;
  const chainId = appState?.chainId;
  const { tokens: balanceTokens = [], loading: balancesLoading } = useWalletBalances(account, isOpen, chainId) || {};
  const nativeToken = Array.isArray(balanceTokens) ? balanceTokens.find((t) => t?.isNative) : null;
  const nativeBalance = typeof nativeToken?.balance === 'number' ? nativeToken.balance : null;
  // Usar el symbol de la red nativa como fallback, pero mejor usar el nativo real si lo tenemos
  const nativeSymbol = nativeToken?.symbol || (chainId === 137 || chainId === 80002 ? 'MATIC' : 'ETH'); 

  // Fallback: si no llega financials desde el hook, intentamos calcularlo directo
  let derivedFinancials = null;
  try {
    const gasLimitRaw = transaction?.gas ?? transaction?.gasLimit;
    const gasPriceRaw = transaction?.gasPrice ?? transaction?.maxFeePerGas ?? transaction?.maxPriorityFeePerGas;

    if (gasLimitRaw && gasPriceRaw) {
      const gasLimit = BigInt(gasLimitRaw);
      const gasPrice = BigInt(gasPriceRaw);
      const estimatedGasCostWei = gasLimit * gasPrice;
      const valueWei = transaction.value ? BigInt(transaction.value) : 0n;
      const totalWei = estimatedGasCostWei + valueWei;

      const toEth = (wei) => Number(wei) / 1e18;

      derivedFinancials = {
        balanceFormatted: null, 
        gasCostFormatted: toEth(estimatedGasCostWei).toFixed(6),
        totalFormatted: toEth(totalWei).toFixed(4),
        hasFunds: true, 
        // Usar el nativeSymbol real o el symbol de uiOptions si es diferente (aunque para costos suele ser nativo)
        symbol: uiOptions?.symbol || nativeSymbol, 
      };
    }
  } catch (e) {
    console.warn('[CustomTransactionModal] No se pudo derivar financials desde transaction', e);
  }

  const effectiveFinancials = financials || derivedFinancials;

  // Función para extraer información automáticamente de la transacción (mantenida)
  const extractTransactionInfo = () => {
    if (!transaction?.data || !transaction?.to) return null;

    const approveSignature = '0x095ea7b3'; 

    if (transaction.data.startsWith(approveSignature)) {
      const spender = '0x' + transaction.data.slice(34, 74);
      // const amount = '0x' + transaction.data.slice(74, 138); 

      return {
        type: 'token_approval',
        spender: spender,
        tokenAddress: transaction.to,
        network: t('transaction.default_network_name', 'Red Principal'),
        estimatedFee: t('transaction.default_estimated_fee', 'Bajo'),
        payWith: transaction.from || t('transaction.default_pay_with_label', 'Mi Billetera')
      };
    }
    return null;
  };

  const autoDetectedInfo = extractTransactionInfo();
  const displayInfo = transactionInfo || (autoDetectedInfo ? {
    title: t('transaction.details', 'Detalles de la Transacción'),
    action: autoDetectedInfo.type === 'token_approval' ? t('transaction.approve_tokens', 'Aprobar Tokens') : t('transaction.execute', 'Ejecutar Contrato'),
    tokenInfo: autoDetectedInfo
  } : null);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-md pointer-events-auto bg-light-surface dark:bg-dark-surface rounded-[32px] shadow-2xl border border-light-border dark:border-dark-border overflow-hidden flex flex-col relative max-h-[90vh]"
            >
              
              {/* Close Button (Solo si no está cargando o exitoso) */}
              {!isLoading && !success && (
                <button
                  onClick={onCancel}
                  className="absolute top-4 right-4 p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors z-10"
                >
                  <X size={20} />
                </button>
              )}

              {/* --- HEADER --- */}
              <div className="pt-8 px-8 pb-4 flex flex-col items-center text-center bg-gradient-to-b from-light-surface-secondary/50 to-transparent dark:from-dark-surface-secondary/50">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`p-4 rounded-2xl mb-4 shadow-inner ${
                    success
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      : error
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-light-accent/10 text-light-accent dark:bg-dark-accent/20 dark:text-dark-accent'
                  }`}
                >
                  {success ? <CheckCircle2 size={32} /> : error ? <AlertTriangle size={32} /> : <ArrowRightLeft size={32} />}
                </motion.div>

                <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight leading-tight">
                  {success ? successHeader : error ? t('transaction.failed', 'Transacción Fallida') : title}
                </h2>
                
                {!success && !error && displayInfo?.action && (
                  <div className="mt-2 px-3 py-1 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    {displayInfo.action}
                  </div>
                )}
              </div>

              {/* --- SCROLLABLE CONTENT --- */}
              <div className="flex-1 overflow-y-auto px-8 py-2 space-y-5 scrollbar-thin scrollbar-thumb-light-border dark:scrollbar-thumb-dark-border">
                
                {/* SUCCESS STATE */}
                {success ? (
                  <div className="text-center space-y-6 py-4">
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      {successDescription}
                    </p>
                    {transaction?.hash && (
                      <div className="bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl p-4 border border-light-border/50 dark:border-dark-border/50 text-left">
                        <p className="text-xs font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-2">
                          {t('transaction.hash', 'Hash de la Transacción')}
                        </p>
                        <div className="flex items-center gap-2 bg-light-background dark:bg-dark-background p-2 rounded-lg">
                          <code className="text-xs font-mono text-light-accent dark:text-dark-accent flex-1 truncate">
                            {transaction.hash}
                          </code>
                          <button
                            onClick={() => handleCopy(transaction.hash, 'hash')}
                            className="p-1.5 rounded hover:bg-light-surface dark:hover:bg-dark-surface transition-colors text-light-text-secondary dark:text-dark-text-secondary"
                            title={t('common.copy', 'Copiar')}
                          >
                            {copied === 'hash' ? <CheckCircle2 size={14} className="text-green-500"/> : <Copy size={14} />}
                          </button>
                        </div>
                        <a 
                          href={`https://amoy.polygonscan.com/tx/${transaction.hash}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-3 flex items-center justify-center gap-1 text-xs text-light-accent dark:text-dark-accent font-medium hover:underline"
                        >
                          <ExternalLink size={12} /> {t('transaction.view_on_explorer', 'Ver en Explorador')}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  /* REVIEW STATE */
                  <>
                    {!error && (
                      <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                        {description}
                      </p>
                    )}

                    {/* --- SECCIÓN DE COSTOS (HUMAN READABLE) --- */}
                    {effectiveFinancials && !error && (
                      <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 rounded-2xl p-4 space-y-3 border border-light-border/50 dark:border-dark-border/50">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 font-medium">
                            <Fuel size={14} /> {t('transaction.cost_gas', 'Costo de Gas (Estimado)')}
                          </span>
                          <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {effectiveFinancials.gasCostFormatted} {effectiveFinancials.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 font-medium">
                            <Calculator size={14} /> {t('transaction.total_to_pay', 'Total a Pagar')}
                          </span>
                          <span className="text-lg font-bold text-light-accent dark:text-dark-accent"> {/* Aumento de tamaño y color para el total */}
                            {effectiveFinancials.totalFormatted} {effectiveFinancials.symbol}
                          </span>
                        </div>
                        <div className="h-[1px] bg-light-border/50 dark:bg-dark-border/50 my-1" />
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2 font-medium">
                            <Wallet size={14} /> {t('transaction.your_balance', 'Tu Balance')}
                          </span>
                          <span className={`text-sm font-medium ${effectiveFinancials.hasFunds === false ? 'text-red-500' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                            {nativeBalance !== null ? nativeBalance.toFixed(4) : (effectiveFinancials.balanceFormatted ?? '—')} {nativeSymbol}
                          </span>
                        </div>
                        {effectiveFinancials.hasFunds === false && (
                          <div className="mt-2 p-3 bg-red-100/50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-sm text-red-600 dark:text-red-400">
                            <AlertTriangle size={16} />
                            <span className="font-semibold">{t('transaction.insufficient_funds', 'Fondos Insuficientes')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Enhanced Transaction Info */}
                    {displayInfo && !error && (
                      <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 rounded-2xl p-5 space-y-4 border border-light-border/50 dark:border-dark-border/50">
                        
                        <p className="text-xs font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-3">
                          {t('transaction.contract_details', 'Detalles de la Operación')}
                        </p>

                        {/* Token Info Block (Approve) */}
                        {displayInfo.tokenInfo && (
                          <div className="space-y-1">
                            <DetailRow 
                              label={t('transaction.spender', 'Contrato Destino (Spender)')} 
                              value={displayInfo.tokenInfo.spender} 
                              isAddress
                              onCopy={(val) => handleCopy(val, 'spender')}
                              copied={copied === 'spender'}
                            />
                            <DetailRow 
                              label={t('transaction.token', 'Token')} 
                              value={displayInfo.tokenInfo.tokenAddress} 
                              isAddress
                              onCopy={(val) => handleCopy(val, 'token')}
                              copied={copied === 'token'}
                            />
                            <div className="h-[1px] bg-light-border/50 dark:bg-dark-border/50 my-3" />
                            <DetailRow 
                              label={t('transaction.network', 'Red')} 
                              value={displayInfo.tokenInfo.network} 
                              icon={Layers}
                            />
                            {/* Solo mostramos el Fee estático si no tenemos los datos financieros reales */}
                            {!effectiveFinancials && (
                              <DetailRow 
                                label={t('transaction.fee', 'Fee Estimado')} 
                                value={displayInfo.tokenInfo.estimatedFee} 
                                valueClass="text-green-600 dark:text-green-400 font-bold"
                              />
                            )}
                          </div>
                        )}

                        {/* Basic/Contract Info (Transfer/Call simple) */}
                        {!displayInfo.tokenInfo && (
                          <div className="space-y-1">
                            {transaction?.to && (
                              <DetailRow 
                                label={t('transaction.to', 'Contrato/Destinatario')} 
                                value={transaction.to} 
                                isAddress
                                onCopy={(val) => handleCopy(val, 'to')}
                                copied={copied === 'to'}
                              />
                            )}
                            {transaction?.value && transaction.value !== '0' && (
                              <DetailRow 
                                label={t('transaction.value', 'Valor a Enviar')} 
                                value={`${Number(BigInt(transaction.value)) / 1e18} ${nativeSymbol}`} // Convertir WEI a ETH/MATIC legible
                                isValue
                                valueClass="font-bold text-light-accent dark:text-dark-accent"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transaction Data Preview (Advanced) */}
                    {!error && transaction?.data && transaction.data !== '0x' && (
                       <div className="bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-2xl p-4 space-y-3 border border-light-border dark:border-dark-border">
                            <div className="flex items-center justify-between mb-2">
                               {/* Icono más prominente para indicar datos técnicos */}
                               <span className="text-xs font-bold uppercase tracking-wider text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                 <Terminal size={14} className="text-light-accent dark:text-dark-accent" /> 
                                 {showHexData ? t('transaction.hex_data', 'Datos Hexadecimales') : t('transaction.human_readable_data', 'Datos de Contrato (Decodificado)')}
                               </span>
                               {/* Toggle Button Clean */}
                               <div className="flex items-center gap-3">
                                 <button
                                   onClick={() => setShowHexData(!showHexData)}
                                   className="text-xs px-2 py-1 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-accent dark:text-dark-accent hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors font-medium"
                                 >
                                   {showHexData ? t('transaction.view_human', 'Ver Legible') : t('transaction.view_hex', 'Ver Hex')}
                                 </button>
                                 {showHexData && (
                                   <button
                                     onClick={() => handleCopy(transaction.data, 'data')}
                                     className="p-1.5 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-surface dark:hover:bg-dark-surface transition-colors"
                                     title={t('common.copy', 'Copiar')}
                                   >
                                     {copied === 'data' ? <CheckCircle2 size={12} className="text-green-500"/> : <Copy size={12} />}
                                   </button>
                                 )}
                               </div>
                            </div>

                            {/* Contenido de la Data */}
                            {showHexData ? (
                              // Vista HEX
                              <div className="bg-light-background dark:bg-dark-background rounded-xl p-3 font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary break-all max-h-32 overflow-y-auto scrollbar-thin">
                                {transaction.data}
                              </div>
                            ) : (
                              // Vista HUMAN
                              <>
                                {displayInfo?.dataSummary ? (
                                  // 1) Data estructurada -> Usar el nuevo subcomponente de tabla
                                  <ContractDataDisplay 
                                    dataSummary={displayInfo.dataSummary} 
                                    transaction={transaction} 
                                    t={t} 
                                  />
                                ) : displayInfo?.summary ? (
                                  // 2) Summary humano simple
                                  <div className="bg-light-background dark:bg-dark-background rounded-xl p-4 space-y-2 shadow-inner">
                                    <div className="text-sm leading-relaxed text-light-text-primary dark:text-dark-text-primary">
                                      {displayInfo.summary}
                                    </div>
                                    <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary pt-2 border-t border-light-border/50 dark:border-dark-border/50">
                                      {t('transaction.hex_data_bytes', { bytes: (transaction.data.length - 2) / 2 })}
                                    </div>
                                  </div>
                                ) : (
                                  // 3) Fallback genérico
                                  <div className="bg-light-background dark:bg-dark-background rounded-xl p-4 space-y-2 shadow-inner">
                                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      {t('transaction.contract_call_summary', {
                                        defaultValue: 'Llamada a contrato con datos en hex ({{bytes}} bytes).',
                                        bytes: (transaction.data.length - 2) / 2,
                                      })}
                                    </div>
                                    <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
                                      {t('transaction.use_advanced_tools_hint', 'El decodificador automático no ha arrojado datos legibles. Puedes ver el HEX o decodificarlo con herramientas avanzadas.')}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                       </div>
                    )}

                    {/* ERROR STATE */}
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-3 animate-shake">
                        <div className="text-red-500 dark:text-red-400 mt-0.5"><AlertTriangle size={18} /></div>
                        <div>
                            <p className="font-bold text-sm text-red-600 dark:text-red-400">
                            {t('transaction.error_title', 'Error de Transacción')}
                          </p>
                          <p className="text-xs text-red-500 dark:text-red-300 mt-1 leading-relaxed">
                            {error?.message || error || t('transaction.unknown_error', 'Ocurrió un error desconocido.')}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* --- FOOTER ACTIONS --- */}
              <div className="p-8 pt-4 mt-auto bg-light-surface dark:bg-dark-surface z-20">
                {success ? (
                  <button
                    onClick={onClose}
                    className="w-full py-3.5 bg-light-accent dark:bg-dark-accent text-white rounded-xl font-bold shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {t('transaction.close', 'Cerrar')}
                  </button>
                ) : (
                  <div className="flex gap-3">
                    {isCancellable && (
                      <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-3.5 border border-light-border dark:border-dark-border rounded-xl text-light-text-secondary dark:text-dark-text-secondary font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors disabled:opacity-50"
                      >
                        {t('transaction.cancel', 'Cancelar')}
                      </button>
                    )}
                    <button
                      onClick={onConfirm}
                      disabled={isLoading || !!error || (effectiveFinancials && effectiveFinancials.hasFunds === false)} 
                      className="flex-[1.5] py-3.5 bg-light-accent dark:bg-dark-accent text-white rounded-xl font-bold shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {t('transaction.processing', 'Procesando...')}
                        </>
                      ) : (
                        <>
                          <Wallet size={18} />
                          {buttonText}
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Secure Badge */}
                {!success && !error && !isLoading && (
                   <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary opacity-70">
                      <ShieldCheck size={12} />
                      <span>{t('transaction.protected_by_blockchain', 'Protegido por Blockchain')}</span>
                   </div>
                )}
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CustomTransactionModal;