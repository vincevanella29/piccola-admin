import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useLoginWithEmail, 
  useLoginWithOAuth, 
  useLogin 
} from '@privy-io/react-auth';
import { X, Mail, ArrowRight, Wallet, Loader2, ShieldCheck } from 'lucide-react';
import { FaGoogle, FaTwitter } from 'react-icons/fa';
import PiccolaIcon from './common/PiccolaIcon';

const LogoImage = () => (
  <PiccolaIcon className="h-12 w-auto drop-shadow-md" />
);

const CustomLoginModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // --- PRIVY HOOKS ---
  const {
    sendCode,
    loginWithCode,
    isLoading: emailLoading,
    error: emailError
  } = useLoginWithEmail({
    onSuccess: onClose,
    onError: (err) => console.error("Email login error:", err)
  });

  const {
    initOAuth,
    isLoading: socialLoading,
    error: socialError
  } = useLoginWithOAuth({
    onSuccess: onClose,
    onError: (err) => console.error("Social login error:", err)
  });

  const {
    login,
    isLoading: walletLoading
  } = useLogin({
    onSuccess: onClose,
    onError: (err) => console.error("Wallet login error:", err)
  });

  const isLoading = emailLoading || socialLoading || walletLoading;

  // --- HANDLERS ---
  const handleSendEmailCode = async () => {
    if (!email.includes('@')) return;
    try {
      await sendCode({ email });
      setCodeSent(true);
    } catch (error) {
      console.error("Error sending code:", error);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    try {
      await loginWithCode({ code: verificationCode });
      onClose();
    } catch (error) {
      console.error("Error verifying code:", error);
    }
  };

  const handleSocialLogin = (provider) => initOAuth({ provider });

  const handleWalletLogin = () => {
    login({
      loginMethods: ['wallet'],
      walletChainType: 'ethereum-and-solana',
      disableSignup: false
    });
  };

  // --- RENDER ---
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop con Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container Centrado */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-md pointer-events-auto bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-[32px] shadow-2xl overflow-hidden relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                disabled={isLoading}
                className="absolute top-4 right-4 p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="p-8 flex flex-col items-center">
                {/* Header */}
                <div className="mb-8 flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-2xl shadow-inner">
                    <LogoImage />
                  </div>
                  <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                    {t('login.modal_title', 'Bienvenido')}
                  </h2>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    {t('login.modal_subtitle', 'Accede al ecosistema Vanellix')}
                  </p>
                </div>

                {/* --- EMAIL SECTION --- */}
                <div className="w-full space-y-4">
                  {!codeSent ? (
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-light-text-tertiary dark:text-dark-text-tertiary">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('login.email_placeholder', 'nombre@ejemplo.com')}
                        disabled={isLoading}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendEmailCode()}
                        className="w-full pl-10 pr-12 py-3 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendEmailCode}
                        disabled={isLoading || !email.includes('@')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-light-accent dark:bg-dark-accent text-white rounded-lg disabled:opacity-50 disabled:bg-gray-400 transition-all hover:scale-105"
                      >
                        {emailLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center mb-2">
                        {/* Badge monocromático */}
                        <span className="text-xs font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary px-2 py-1 rounded-full">
                          {t('login.code_sent_badge', 'Código enviado')}
                        </span>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                          {t('login.enter_code_desc', 'Ingresa el código enviado a')} <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{email}</span>
                        </p>
                      </div>
                      
                      <div className="relative">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="000000"
                          className="w-full text-center py-3 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border rounded-xl text-xl font-mono tracking-widest text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all"
                          autoFocus
                          maxLength={6}
                        />
                      </div>

                      <button
                        onClick={handleVerifyCode}
                        disabled={isLoading || verificationCode.length < 6}
                        className="w-full py-3 bg-light-accent dark:bg-dark-accent text-white font-bold rounded-xl shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                      >
                        {emailLoading ? <Loader2 size={18} className="animate-spin" /> : t('login.verify', 'Verificar')}
                      </button>

                      <button
                        onClick={() => { setCodeSent(false); setVerificationCode(''); }}
                        className="w-full text-xs text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-accent dark:hover:text-dark-accent transition-colors"
                      >
                        {t('login.use_different_email', 'Usar otro correo')}
                      </button>
                    </div>
                  )}

                  {emailError && (
                    <p className="text-xs text-center text-light-error dark:text-dark-error font-medium animate-pulse">
                      {emailError.message || t('login.error_generic', 'Error al enviar/verificar')}
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="w-full flex items-center gap-3 my-6">
                  <div className="h-[1px] flex-1 bg-light-border dark:bg-dark-border opacity-50" />
                  <span className="text-[10px] font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                    {t('login.or', 'O continúa con')}
                  </span>
                  <div className="h-[1px] flex-1 bg-light-border dark:bg-dark-border opacity-50" />
                </div>

                {/* --- SOCIAL & WALLET (Monocromáticos) --- */}
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSocialLogin('google')}
                      disabled={isLoading}
                      // Botón monocromático
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border rounded-xl hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-all shadow-sm disabled:opacity-50"
                    >
                      <FaGoogle className="text-current" /> {/* Usa el color del texto actual */}
                      <span className="text-sm font-semibold">Google</span>
                    </button>
                    <button
                      onClick={() => handleSocialLogin('twitter')}
                      disabled={isLoading}
                      // Botón monocromático
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border rounded-xl hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-all shadow-sm disabled:opacity-50"
                    >
                      <FaTwitter className="text-current" /> {/* Usa el color del texto actual */}
                      <span className="text-sm font-semibold">Twitter</span>
                    </button>
                  </div>

                  <button
                    onClick={handleWalletLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary rounded-xl hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all group disabled:opacity-50"
                  >
                    {walletLoading ? (
                      <Loader2 size={18} className="animate-spin text-light-accent dark:text-dark-accent" />
                    ) : (
                      <Wallet size={18} className="text-light-accent dark:text-dark-accent group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-sm font-semibold">
                      {walletLoading ? t('login.connecting', 'Conectando...') : t('login.connect_external_wallet', 'Conectar Wallet Externa')}
                    </span>
                  </button>
                </div>

                {socialError && (
                  <p className="text-xs text-center text-light-error dark:text-dark-error mt-3">
                    {socialError.message}
                  </p>
                )}

                {/* Footer Terms */}
                <div className="mt-6 flex items-center justify-center gap-1.5 opacity-50">
                  <ShieldCheck size={12} className="text-light-text-secondary dark:text-dark-text-secondary" />
                  <p className="text-[10px] text-center text-light-text-secondary dark:text-dark-text-secondary">
                    {t('login.terms_disclaimer', 'Al continuar aceptas los Términos y Condiciones.')}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CustomLoginModal;