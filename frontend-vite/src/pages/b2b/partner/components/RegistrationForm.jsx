import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, AlertCircle, Bell, Mail } from 'lucide-react';

const RegistrationForm = ({ error, formData, setFormData, handleRegister }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-light-surface dark:bg-dark-surface p-8 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-matrix-green/10 flex items-center justify-center text-matrix-green">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
              {t('b2b.register_title')}
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              {t('b2b.register_desc')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              {t('b2b.company_name')}
            </label>
            <input 
              required 
              type="text" 
              value={formData.company_name} 
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} 
              className="w-full px-4 py-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50 focus:ring-2 focus:ring-matrix-green outline-none text-light-text-primary dark:text-dark-text-primary" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              {t('b2b.contact_email')}
            </label>
            <input 
              required 
              type="email" 
              value={formData.contact_email} 
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} 
              className="w-full px-4 py-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50 focus:ring-2 focus:ring-matrix-green outline-none text-light-text-primary dark:text-dark-text-primary" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              {t('b2b.contact_phone')}
            </label>
            <input 
              type="text" 
              value={formData.contact_phone} 
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} 
              className="w-full px-4 py-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50 focus:ring-2 focus:ring-matrix-green outline-none text-light-text-primary dark:text-dark-text-primary" 
            />
          </div>

          <div className="pt-4 border-t border-light-border/30 dark:border-dark-border/30 space-y-4">
            <h3 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
              Notificaciones y Correos
            </h3>
            
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-start">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={formData.opt_in_notifications}
                  onChange={(e) => setFormData({ ...formData, opt_in_notifications: e.target.checked })}
                />
                <div className="w-5 h-5 rounded-[6px] border-2 border-gray-300 dark:border-gray-600 peer-checked:bg-matrix-green peer-checked:border-matrix-green transition-all flex items-center justify-center bg-white dark:bg-[#1a1a1a] mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary flex items-center gap-1.5">
                  <Bell size={14} className="text-vanellix-cyan" /> 
                  Activar Notificaciones Push
                </span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                  Recibe alertas instantáneas sobre tus promociones B2B y aprobaciones.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-start">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={formData.opt_in_mailing}
                  onChange={(e) => setFormData({ ...formData, opt_in_mailing: e.target.checked })}
                />
                <div className="w-5 h-5 rounded-[6px] border-2 border-gray-300 dark:border-gray-600 peer-checked:bg-matrix-green peer-checked:border-matrix-green transition-all flex items-center justify-center bg-white dark:bg-[#1a1a1a] mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary flex items-center gap-1.5">
                  <Mail size={14} className="text-vanellix-cyan" /> 
                  Suscribirse al Mailing B2B
                </span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                  Novedades de la API, actualizaciones técnicas y nuevas integraciones B2B.
                </span>
              </div>
            </label>
          </div>

          <button 
            type="submit" 
            className="w-full py-4 mt-6 bg-matrix-green hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
          >
            {t('b2b.submit_btn')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default RegistrationForm;
