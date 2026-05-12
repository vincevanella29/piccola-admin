import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, UserCircle2, ArrowRight, Rocket,
  Trophy, BarChart3, ShieldCheck, Wallet,
  KeyRound, Fingerprint, Gauge, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LandingPanel from './components/LandingPanel.jsx';

// ── Atom: Pillar Feature Card ──
const PillarCard = ({ icon, accentClass, title, desc, features, cta, onClick, delay }) => {
  const IconComponent = icon;
  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    onClick={onClick}
    className={`group relative h-full p-6 md:p-8 rounded-3xl overflow-hidden cursor-pointer
      bg-light-surface dark:bg-dark-surface
      border border-light-border/20 dark:border-dark-border/20
      hover:border-light-border/40 dark:hover:border-dark-border/40
      backdrop-blur-md transition-all duration-500 flex flex-col`}
  >
    {/* Background glow */}
    <div className={`absolute top-0 right-0 w-48 h-48 ${accentClass} opacity-5 group-hover:opacity-10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity duration-500 pointer-events-none`} />

    {/* Icon */}
    <div className={`w-12 h-12 rounded-2xl ${accentClass}/10 flex items-center justify-center border ${accentClass}/20 mb-5`}>
      <IconComponent size={24} className={accentClass.replace('bg-', 'text-')} />
    </div>

    {/* Content */}
    <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight mb-2">
      {title}
    </h3>
    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-5">
      {desc}
    </p>

    {/* Feature pills */}
    <div className="flex flex-wrap gap-2 mb-6">
      {features.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary border border-light-border/10 dark:border-dark-border/10">
          <f.icon size={12} /> {f.label}
        </span>
      ))}
    </div>

    {/* CTA */}
    <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-matrix-green">
      <span>{cta}</span>
      <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-300" />
    </div>
  </motion.div>
  );
};

const Home = ({ appState }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isLoggedIn = !!(appState?.account || appState?.isAuthenticated);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    },
    exit: { opacity: 0 }
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex flex-col justify-center items-center p-4">
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-7xl mx-auto"
          >
            <LandingPanel appState={appState} />
          </motion.div>
        ) : (
          <motion.div
            key="hub"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-6xl w-full space-y-8"
          >
            {/* Welcome Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-3"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-matrix-green/10 border border-matrix-green/20 text-matrix-green text-xs font-bold uppercase tracking-wider">
                <Rocket size={12} />
                <span>{t('home.hero_badge')}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                {t('home.hero_title')}
              </h1>
              <p className="text-base text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto leading-relaxed">
                {t('home.hero_subtitle')}
              </p>
            </motion.div>

            {/* Pillar Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Employee Portal */}
              <PillarCard
                delay={0.1}
                icon={UserCircle2}
                accentClass="bg-matrix-green"
                title={t('home.pillar_employee_title')}
                desc={t('home.pillar_employee_desc')}
                features={[
                  { icon: Trophy, label: t('home.feat_merits') },
                  { icon: BarChart3, label: t('home.feat_rankings') },
                  { icon: Wallet, label: t('home.feat_payroll') },
                ]}
                cta={t('home.enter_portal')}
                onClick={() => navigate('/app/mi-ficha/employees')}
              />

              {/* B2B Alliances */}
              <PillarCard
                delay={0.2}
                icon={Building2}
                accentClass="bg-vanellix-purple"
                title={t('home.pillar_b2b_title')}
                desc={t('home.pillar_b2b_desc')}
                features={[
                  { icon: KeyRound, label: t('home.feat_dilithium') },
                  { icon: ShieldCheck, label: t('home.feat_quotas') },
                  { icon: Lock, label: t('home.feat_api') },
                ]}
                cta={t('home.enter_portal')}
                onClick={() => navigate('/app/b2b/partner')}
              />

              {/* Management Hub */}
              <PillarCard
                delay={0.3}
                icon={Gauge}
                accentClass="bg-matrix-green"
                title={t('home.pillar_admin_title')}
                desc={t('home.pillar_admin_desc')}
                features={[
                  { icon: BarChart3, label: t('home.feat_analytics') },
                  { icon: Fingerprint, label: t('home.feat_biometric') },
                  { icon: ShieldCheck, label: t('home.feat_security') },
                ]}
                cta={t('home.enter_portal')}
                onClick={() => navigate('/app/admin')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;

export const pageMetadata = {
  path: '/',
  label: 'home.label',
  category: 'restaurant.category',
  minRoleLevel: -1,
  order: 1,
  orderWalletMenu: 1,
  orderFooter: 1,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'home.description',
  icon: 'FiHome',
  isMainPage: true,
  isSearchable: false,
};
