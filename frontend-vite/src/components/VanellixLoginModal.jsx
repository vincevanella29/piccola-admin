// VanellixLoginModal.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import useVanellixLogin from '../hooks/useVanellixLogin';

const VanellixLoginModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const {
    selectedMethod,
    email,
    setEmail,
    phone,
    setPhone,
    code,
    setCode,
    showCodeInput,
    errorMsg,
    handleSelectMethod,
    handleSendCode,
    handleLoginWithCode,
  } = useVanellixLogin({ onClose });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 100, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-[95vw] sm:max-w-md mx-4 sm:mx-auto h-auto max-h-[80vh] flex flex-col rounded-2xl shadow-modal border border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background text-light-text-primary dark:text-dark-text-primary overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-light-border/10 dark:border-dark-border/10">
            <h2 className="text-xl font-bold">{t('login.title')}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              ×
            </button>
          </div>
          <div className="flex flex-col p-6 space-y-4">
            {!selectedMethod ? (
              <>
                <p className="text-center text-sm mb-4">{t('select_login_method')}</p>
                <button
                  onClick={() => handleSelectMethod('wallet')}
                  className="w-full py-3 bg-vanellix-cyan text-white rounded-lg hover:bg-vanellix-cyan-dark"
                >
                  {t('connect_with_wallet')}
                </button>
                <button
                  onClick={() => handleSelectMethod('email')}
                  className="w-full py-3 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                >
                  {t('connect_with_email')}
                </button>
                <button
                  onClick={() => handleSelectMethod('phone')}
                  className="w-full py-3 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                >
                  {t('connect_with_phone')}
                </button>
                <button
                  onClick={() => handleSelectMethod('google')}
                  className="w-full py-3 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                >
                  {t('connect_with_google')}
                </button>
                <button
                  onClick={() => handleSelectMethod('twitter')}
                  className="w-full py-3 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                >
                  {t('connect_with_twitter')}
                </button>
              </>
            ) : (
              <>
                {selectedMethod === 'email' || selectedMethod === 'phone' ? (
                  <>
                    <input
                      type={selectedMethod === 'email' ? 'email' : 'tel'}
                      value={selectedMethod === 'email' ? email : phone}
                      onChange={(e) => selectedMethod === 'email' ? setEmail(e.target.value) : setPhone(e.target.value)}
                      placeholder={selectedMethod === 'email' ? t('enter_email') : t('enter_phone')}
                      className="w-full p-2 border rounded"
                    />
                    <button onClick={handleSendCode} className="w-full py-3 bg-vanellix-cyan text-white rounded-lg">
                      {t('send_code')}
                    </button>
                    {showCodeInput && (
                      <>
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder={t('enter_code')}
                          className="w-full p-2 border rounded mt-4"
                        />
                        <button onClick={handleLoginWithCode} className="w-full py-3 bg-vanellix-cyan text-white rounded-lg mt-2">
                          {t('login')}
                        </button>
                      </>
                    )}
                  </>
                ) : null}
                {errorMsg && <p className="text-red-500 text-center mt-2">{errorMsg}</p>}
              </>
            )}
          </div>
          <div className="px-6 py-3 border-t border-light-border/10 dark:border-dark-border/10 text-center text-xs text-gray-500">
            {t('wallet.embedded_wallet_info')}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VanellixLoginModal;