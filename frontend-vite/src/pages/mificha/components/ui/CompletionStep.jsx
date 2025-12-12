// src/pages/employees_register/components/ui/CompletionStep.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';

const CompletionStep = ({ success, message, onRetry, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center p-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
        className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
            success ? 'bg-matrix-green/10 text-matrix-green' : 'bg-dark-error/10 text-dark-error'
        }`}
      >
        {success ? <CheckCircle size={64} /> : <XCircle size={64} />}
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-2">
        {success ? t('register.success_title', '¡Identidad Verificada!') : t('register.error_title', 'Validación Fallida')}
      </h2>
      
      <p className="text-dark-text-secondary mb-8 leading-relaxed">
        {message || (success 
            ? t('register.success_msg', 'Tu registro biométrico se ha completado correctamente. Ya puedes acceder a tu ficha.') 
            : t('register.error_msg', 'No pudimos validar tu identidad. Por favor intenta nuevamente con mejor iluminación.'))
        }
      </p>

      <div className="w-full flex flex-col gap-3">
        {success ? (
             <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
             >
                {t('register.go_dashboard', 'Ir a mi Ficha')} <ArrowRight size={18} />
             </button>
        ) : (
            <button
                onClick={onRetry}
                className="w-full py-3.5 rounded-xl bg-dark-surface-secondary text-white font-bold hover:bg-white/10 transition-colors"
            >
                {t('register.retry', 'Intentar de Nuevo')}
            </button>
        )}
      </div>
    </div>
  );
};

export default CompletionStep;