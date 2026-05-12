// src/pages/delivery/components/PaymentsTab.jsx
// Transbank OneClick — config + LIVE test flow (inscription + payment)
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCreditCard, FaLock, FaUnlock, FaCheckCircle, FaExclamationTriangle,
  FaSave, FaSpinner, FaEye, FaEyeSlash, FaShieldAlt, FaFlask,
  FaRocket, FaExchangeAlt, FaCopy, FaCheck, FaChevronDown,
  FaMagic, FaPlay, FaSync, FaDollarSign, FaClipboardList
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as deliveryApi from '../../../utils/deliveryData';

// ── Constants ────────────────────────────────────────────────────
const TEST_CREDS = {
  commerce_code: '597055555542',
  api_key: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
  child_code: '597055555543',
};
const TEST_CARD = {
  number: '4051 8856 0044 6623',
  cvv: '123',
  expiry: 'Cualquier fecha futura',
  rut: '11.111.111-1',
  password: '123',
};

const inputCls = "w-full px-3 py-2.5 rounded-xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-sm outline-none border border-light-border/30 dark:border-dark-border/30 focus:border-matrix-green focus:ring-2 focus:ring-matrix-green/20 transition font-mono";
const labelCls = "text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5";

// ── Copy Button ──────────────────────────────────────────────────
const CopyBtn = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text.replace(/\s/g, '')); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className={`p-1 rounded transition-colors ${ok ? 'text-emerald-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-secondary'}`}>
      {ok ? <FaCheck size={9} /> : <FaCopy size={9} />}
    </button>
  );
};

const CredRow = ({ label, value, mono = true }) => (
  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10">
    <div className="flex-1 min-w-0">
      <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">{label}</span>
      <p className={`text-xs text-light-text-primary dark:text-dark-text-primary truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
    <CopyBtn text={value} />
  </div>
);

// ── Environment Card ─────────────────────────────────────────────
const EnvCard = ({ env, label, icon: Icon, color, config, onSave, isSaving, isActive }) => {
  const [commerceCode, setCommerceCode] = useState(config?.commerce_code || '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setCommerceCode(config?.commerce_code || ''); setApiKey(''); setDirty(false); }, [config]);

  const handleSave = () => { onSave({ target: env, commerce_code: commerceCode, api_key: apiKey }); setDirty(false); setApiKey(''); };
  const handleAutoFill = () => { setCommerceCode(TEST_CREDS.commerce_code); setApiKey(TEST_CREDS.api_key); setDirty(true); toast.info('🔑 Credenciales test llenadas'); };

  const bc = isActive ? (color === 'amber' ? 'border-amber-500/40' : 'border-emerald-500/40') : 'border-light-border/20 dark:border-dark-border/20';
  const hbg = isActive ? (color === 'amber' ? 'bg-amber-500/5' : 'bg-emerald-500/5') : 'bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20';

  return (
    <div className={`rounded-2xl border-2 ${bc} overflow-hidden transition-all`}>
      <div className={`flex items-center justify-between px-4 py-3 ${hbg} border-b border-light-border/10 dark:border-dark-border/10`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color === 'amber' ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
            <Icon size={14} className={color === 'amber' ? 'text-amber-500' : 'text-emerald-500'} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</h4>
            <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
              {env === 'test' ? 'Sandbox para pruebas' : 'Transacciones reales'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config?.has_key && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold"><FaCheckCircle size={8} /> OK</span>}
          {isActive && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${color === 'amber' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}><FaUnlock size={8} /> Activo</span>}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {env === 'test' && !config?.has_key && (
          <button onClick={handleAutoFill} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
            <FaMagic size={10} /> Auto-llenar credenciales test
          </button>
        )}
        <div>
          <label className={labelCls}><FaShieldAlt size={9} /> Código de Comercio</label>
          <input type="text" value={commerceCode} onChange={e => { setCommerceCode(e.target.value); setDirty(true); }}
            placeholder={env === 'test' ? '597055555542' : 'Tu código de producción'} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}><FaLock size={9} /> API Key Secret</label>
          <form autoComplete="off" onSubmit={e => e.preventDefault()} className="relative">
            <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => { setApiKey(e.target.value); setDirty(true); }}
              autoComplete="new-password" placeholder={config?.has_key ? `${config.api_key} (actual)` : 'Pega tu API Key'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-secondary transition-colors">
              {showKey ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
            </button>
          </form>
        </div>
        {dirty && (
          <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} onClick={handleSave} disabled={isSaving || !commerceCode}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {isSaving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />} Guardar {label}
          </motion.button>
        )}
      </div>
    </div>
  );
};

// ── Live Test Panel ──────────────────────────────────────────────
const LiveTestPanel = ({ appState, tbConfig }) => {
  const [inscription, setInscription] = useState(null);
  const [testAmount, setTestAmount] = useState(1000);
  const [lastTx, setLastTx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const auth = { token: appState?.token, walletAddress: appState?.account };

  // Load inscription status
  const loadStatus = useCallback(async () => {
    try {
      const res = await deliveryApi.getInscriptionStatus(auth);
      setInscription(res?.last_inscription || null);
    } catch {}
  }, [appState]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Start inscription
  const handleInscribe = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/api/delivery/transbank/inscription/finish`;
      const res = await deliveryApi.startInscription({
        ...auth,
        username: 'admin_test',
        email: 'test@piccola.cl',
        return_url: returnUrl,
      });

      if (res?.full_url) {
        // Open Transbank in new window
        const win = window.open(res.full_url, 'transbank_inscription', 'width=600,height=700');
        toast.info('🏦 Redirigiendo a Transbank...');

        // Poll for completion
        setPolling(true);
        const interval = setInterval(async () => {
          try {
            const status = await deliveryApi.getInscriptionStatus(auth);
            if (status?.last_inscription?.tbk_user) {
              setInscription(status.last_inscription);
              setPolling(false);
              clearInterval(interval);
              toast.success('✅ ¡Tarjeta inscrita!');
            }
          } catch {}
        }, 3000);

        // Stop polling after 3 min
        setTimeout(() => { clearInterval(interval); setPolling(false); }, 180000);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Test payment
  const handleTestPayment = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.testAuthorize({ ...auth, amount: testAmount });
      setLastTx(res?.transaction || null);
      if (res?.success) {
        toast.success(`✅ Pago de $${testAmount.toLocaleString()} aprobado`);
      } else {
        toast.error('❌ Pago rechazado');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-blue-500/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-500/5 border-b border-light-border/10 dark:border-dark-border/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <FaPlay size={11} className="text-blue-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Test en Vivo</h4>
            <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Inscribe tarjeta y haz un pago de prueba</p>
          </div>
        </div>
        <button onClick={loadStatus} className="p-1.5 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
          <FaSync size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Inscription */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${inscription?.tbk_user ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>1</div>
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Inscribir tarjeta</span>
            {inscription?.tbk_user && <FaCheckCircle size={10} className="text-emerald-500" />}
          </div>

          {inscription?.tbk_user ? (
            <div className="space-y-1.5 ml-7">
              <CredRow label="Tarjeta" value={`${inscription.card_type || 'VISA'} ****${String(inscription.card_number).slice(-4)}`} mono={false} />
              <CredRow label="TBK User" value={inscription.tbk_user} />
              <button onClick={handleInscribe} disabled={loading}
                className="text-[10px] text-blue-500 hover:underline mt-1">
                Inscribir otra tarjeta
              </button>
            </div>
          ) : (
            <div className="ml-7">
              <button onClick={handleInscribe} disabled={loading || polling}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {loading || polling ? <FaSpinner size={12} className="animate-spin" /> : <FaCreditCard size={12} />}
                {polling ? 'Esperando Transbank...' : 'Inscribir tarjeta de prueba'}
              </button>
              <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1.5 leading-relaxed">
                Se abrirá Transbank. Usa la tarjeta <strong>4051 8856 0044 6623</strong>, CVV <strong>123</strong>, 
                RUT <strong>11.111.111-1</strong>, clave <strong>123</strong>
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Test payment */}
        <div className={!inscription?.tbk_user ? 'opacity-40 pointer-events-none' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${lastTx ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>2</div>
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Cobrar</span>
            {lastTx?.detail?.status === 'AUTHORIZED' && <FaCheckCircle size={10} className="text-emerald-500" />}
          </div>

          <div className="ml-7 space-y-2">
            <div>
              <label className={labelCls}><FaDollarSign size={9} /> Monto (CLP)</label>
              <input type="number" value={testAmount} onChange={e => setTestAmount(Number(e.target.value))}
                className={inputCls} min={50} max={999999} />
            </div>
            <button onClick={handleTestPayment} disabled={loading || !inscription?.tbk_user}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <FaSpinner size={12} className="animate-spin" /> : <FaDollarSign size={12} />}
              Cobrar ${testAmount.toLocaleString()} CLP
            </button>
          </div>
        </div>

        {/* Transaction result */}
        {lastTx && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl border ${lastTx.detail?.response_code === 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {lastTx.detail?.response_code === 0
                ? <><FaCheckCircle size={12} className="text-emerald-500" /><span className="text-xs font-bold text-emerald-500">Pago aprobado</span></>
                : <><FaExclamationTriangle size={12} className="text-red-500" /><span className="text-xs font-bold text-red-500">Pago rechazado</span></>
              }
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div><span className="text-light-text-tertiary dark:text-dark-text-tertiary">Orden:</span> <span className="font-mono text-light-text-primary dark:text-dark-text-primary">{lastTx.buy_order}</span></div>
              <div><span className="text-light-text-tertiary dark:text-dark-text-tertiary">Monto:</span> <span className="font-bold text-light-text-primary dark:text-dark-text-primary">${lastTx.detail?.amount?.toLocaleString()}</span></div>
              <div><span className="text-light-text-tertiary dark:text-dark-text-tertiary">Auth:</span> <span className="font-mono text-light-text-primary dark:text-dark-text-primary">{lastTx.detail?.authorization_code}</span></div>
              <div><span className="text-light-text-tertiary dark:text-dark-text-tertiary">Tipo:</span> <span className="text-light-text-primary dark:text-dark-text-primary">{lastTx.detail?.payment_type_code}</span></div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ── Test Card Reference ──────────────────────────────────────────
const TestCardReference = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-500/20 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left">
        <div className="flex items-center gap-2">
          <FaClipboardList size={12} className="text-amber-500" />
          <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Datos de prueba Transbank</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <FaChevronDown size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-4 space-y-3 border-t border-amber-500/10">
              <div>
                <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2">Credenciales Test</h4>
                <div className="space-y-1.5">
                  <CredRow label="Commerce Code Mall" value={TEST_CREDS.commerce_code} />
                  <CredRow label="Commerce Code Tienda" value={TEST_CREDS.child_code} />
                  <CredRow label="API Key Secret" value={TEST_CREDS.api_key} />
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Tarjeta VISA Test</h4>
                <div className="space-y-1.5">
                  <CredRow label="Número" value={TEST_CARD.number} />
                  <div className="grid grid-cols-3 gap-1.5">
                    <CredRow label="CVV" value={TEST_CARD.cvv} />
                    <CredRow label="Vencimiento" value={TEST_CARD.expiry} mono={false} />
                    <CredRow label="RUT" value={TEST_CARD.rut} />
                  </div>
                  <CredRow label="Clave banco" value={TEST_CARD.password} />
                </div>
              </div>
              <div className="px-2.5 py-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
                <p className="text-[10px] text-blue-500 leading-relaxed">
                  <strong>OneClick</strong> permite al cliente inscribir su tarjeta una vez y después pagar sin ingresarla de nuevo. 
                  El flujo es: inscribir → recibir tbk_user → usar tbk_user para cobrar.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Tab ─────────────────────────────────────────────────────
const PaymentsTab = ({ appState }) => {
  const [tbConfig, setTbConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getAuth = useCallback(() => ({ token: appState?.token, walletAddress: appState?.account }), [appState]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await deliveryApi.getTransbankConfig(getAuth());
      setTbConfig(res?.transbank || null);
    } catch (err) {
      console.error('Load Transbank config:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuth]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSaveEnv = async ({ target, commerce_code, api_key }) => {
    setIsSaving(true);
    try {
      await deliveryApi.updateTransbankConfig({ ...getAuth(), target, commerce_code, api_key, environment: tbConfig?.environment || 'test' });
      toast.success(`✅ Transbank ${target} actualizado`);
      loadConfig();
    } catch (err) { toast.error(err.message); }
    finally { setIsSaving(false); }
  };

  const handleSwitchEnv = async (env) => {
    setIsSaving(true);
    try {
      await deliveryApi.switchTransbankEnv({ ...getAuth(), environment: env });
      toast.success(`✅ Ambiente: ${env === 'test' ? 'Test' : 'Producción'}`);
      setTbConfig(prev => ({ ...prev, environment: env }));
    } catch (err) { toast.error(err.message); }
    finally { setIsSaving(false); }
  };

  const currentEnv = tbConfig?.environment || 'test';

  if (isLoading) return <div className="flex justify-center py-16"><FaSpinner size={20} className="animate-spin text-matrix-green" /></div>;

  return (
    <div className="space-y-4">
      {/* Header + env toggle */}
      <div className="rounded-2xl border border-light-border/20 dark:border-dark-border/20 overflow-hidden">
        <div className="px-4 py-3 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border-b border-light-border/10 dark:border-dark-border/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <FaCreditCard size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Transbank OneClick</h3>
              <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Inscripción + cobro automático con tarjeta</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <label className={labelCls}><FaExchangeAlt size={9} /> Ambiente Activo</label>
          <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl">
            <button onClick={() => handleSwitchEnv('test')} disabled={isSaving}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${currentEnv === 'test' ? 'bg-amber-500/20 text-amber-500 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary'}`}>
              <FaFlask size={11} /> Test
            </button>
            <button onClick={() => handleSwitchEnv('production')} disabled={isSaving}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${currentEnv === 'production' ? 'bg-emerald-500/20 text-emerald-500 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary'}`}>
              <FaRocket size={11} /> Producción
            </button>
          </div>
          {currentEnv === 'production' && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
              <FaExclamationTriangle size={10} className="text-red-500 shrink-0" />
              <p className="text-[10px] text-red-500 font-medium">Producción activo — transacciones reales</p>
            </div>
          )}
        </div>
      </div>

      {/* Test env config */}
      <EnvCard env="test" label="Test / Sandbox" icon={FaFlask} color="amber" config={tbConfig?.test} onSave={handleSaveEnv} isSaving={isSaving} isActive={currentEnv === 'test'} />

      {/* Production env config */}
      <EnvCard env="production" label="Producción" icon={FaRocket} color="emerald" config={tbConfig?.production} onSave={handleSaveEnv} isSaving={isSaving} isActive={currentEnv === 'production'} />

      {/* Live test panel — only show in test mode */}
      {currentEnv === 'test' && <LiveTestPanel appState={appState} tbConfig={tbConfig} />}

      {/* Test card reference */}
      <TestCardReference />
    </div>
  );
};

export default PaymentsTab;
