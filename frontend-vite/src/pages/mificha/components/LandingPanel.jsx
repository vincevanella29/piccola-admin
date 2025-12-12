// src/pages/landing/components/LandingPanel.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
    ShieldCheck, Trophy, BarChart3, Wallet, 
    ArrowRight, Rocket, Lock, Fingerprint 
} from 'lucide-react';

// --- ATOM: Feature Card (Estilo Bento limpio) ---
const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="group flex flex-col p-4 rounded-2xl bg-light-surface-secondary/30 dark:bg-white/5 border border-light-border/10 dark:border-white/5 hover:bg-light-surface-secondary/50 dark:hover:bg-white/10 transition-all duration-300"
  >
    <div className="w-10 h-10 mb-3 rounded-xl bg-light-surface dark:bg-[#1a1a1a] flex items-center justify-center border border-light-border/10 dark:border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-sm">
      <Icon size={20} className="text-matrix-green" />
    </div>
    <div className="font-bold text-sm text-light-text-primary dark:text-white mb-1">
        {title}
    </div>
    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
        {desc}
    </div>
  </motion.div>
);

const LandingPanel = ({ appState, navigate }) => {
  const { t } = useTranslation();

  const handleConnect = async () => {
    try {
      if (typeof appState?.connectWallet === 'function') {
        // Si ya está conectado, redirigir
        if (appState?.account || appState?.isAuthenticated) {
          if(navigate) navigate('/app/mi-ficha');
          return;
        }
        await appState.connectWallet();
        return;
      }
    } catch (err) {
      console.error("Wallet connect error", err);
    }
  };

  const isConnected = !!(appState?.account || appState?.isAuthenticated);

  return (
    <div className="w-full relative overflow-hidden rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 shadow-2xl">
      
      {/* Background Decor (Sutil y Corporativo) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-matrix-green/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-light-accent/5 dark:bg-dark-accent/5 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row p-6 md:p-10 lg:p-12 gap-12 lg:gap-20">
        
        {/* --- LEFT SIDE: Value Proposition --- */}
        <div className="flex-1 flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-matrix-green/10 border border-matrix-green/20 text-matrix-green text-xs font-bold uppercase tracking-wider mb-6">
              <Rocket size={12} />
              <span>{t('landing.badge', 'Vanellix Ecosystem')}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-light-text-primary dark:text-white tracking-tight mb-4 leading-tight">
              {t('landing.welcome_title')}
            </h1>
            <p className="text-base md:text-lg text-light-text-secondary dark:text-dark-text-secondary leading-relaxed max-w-xl mb-8">
              {t('landing.welcome_subtitle')}
            </p>
          </motion.div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard
              delay={0.2}
              icon={Trophy}
              title={t('landing.feature_titles.merits')}
              desc={t('landing.feature_list.merits')}
            />
            <FeatureCard
              delay={0.3}
              icon={BarChart3}
              title={t('landing.feature_titles.rankings')}
              desc={t('landing.feature_list.rankings')}
            />
            <FeatureCard
              delay={0.4}
              icon={ShieldCheck}
              title={t('landing.feature_titles.payroll')}
              desc={t('landing.feature_list.payroll')}
            />
            <FeatureCard
              delay={0.5}
              icon={Wallet}
              title={t('landing.feature_titles.privacy')}
              desc={t('landing.feature_list.privacy')}
            />
          </div>
        </div>

        {/* --- RIGHT SIDE: Action Card (Login/Connect) --- */}
        <div className="w-full lg:w-[400px] flex items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full relative group"
          >
            {/* Card Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-matrix-green/20 to-light-accent/20 dark:to-dark-accent/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            
            <div className="relative w-full rounded-2xl bg-light-surface/80 dark:bg-[#151515]/90 backdrop-blur-xl border border-light-border/20 dark:border-white/10 p-8 shadow-xl">
              
              <div className="w-16 h-16 mx-auto mb-6 bg-light-surface-secondary dark:bg-white/5 rounded-2xl flex items-center justify-center border border-light-border/10 dark:border-white/5 shadow-inner">
                {isConnected ? <Lock size={32} className="text-matrix-green" /> : <Fingerprint size={32} className="text-light-text-secondary dark:text-white" />}
              </div>

              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-light-text-primary dark:text-white mb-2">
                  {isConnected ? t('landing.welcome_back', 'Bienvenido de nuevo') : t('landing.connect_title')}
                </h2>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {isConnected ? t('landing.continue_dashboard', 'Accede a tu panel de control') : t('landing.connect_desc')}
                </p>
              </div>

              <button
                onClick={handleConnect}
                className="w-full group relative flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-matrix-green text-white font-bold text-sm hover:shadow-lg hover:shadow-matrix-green/25 transition-all duration-300 active:scale-[0.98]"
              >
                <span>{isConnected ? t('landing.cta_enter', 'Ingresar al Dashboard') : t('landing.cta_connect')}</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-light-text-tertiary dark:text-gray-500">
                <ShieldCheck size={12} />
                <span>{t('landing.secure_connection', 'Conexión Segura vía Web3')}</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default LandingPanel;