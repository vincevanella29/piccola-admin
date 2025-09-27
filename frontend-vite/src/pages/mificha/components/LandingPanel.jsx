import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Trophy, BarChart3, Wallet } from 'lucide-react';

const Feature = ({ icon: Icon, title, desc }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-surface-secondary/60 border border-dark-border/30">
    <div className="mt-0.5">
      <Icon size={18} className="text-matrix-green" />
    </div>
    <div className="text-sm">
      <div className="font-semibold text-dark-text-primary">{title}</div>
      <div className="text-dark-text-secondary">{desc}</div>
    </div>
  </div>
);

const LandingPanel = ({ appState }) => {
  const { t } = useTranslation();

  const handleConnect = async () => {
    try {
      if (typeof appState?.connectWallet === 'function') {
        if (appState?.account || appState?.isAuthenticated) {
          navigate('/app/mi-ficha');
          return;
        }
        await appState.connectWallet();
        return;
      }
    } catch (err) {
      console.error(t('wallet.connect_error'), err);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-dark-border/30 bg-dark-surface p-5 md:p-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Texto principal */}
        <div className="flex-1 space-y-4">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t('landing.welcome_title')}
          </h1>
          <p className="text-dark-text-secondary">
            {t('landing.welcome_subtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <Feature
              icon={Trophy}
              title={t('landing.feature_titles.merits')}
              desc={t('landing.feature_list.merits')}
            />
            <Feature
              icon={BarChart3}
              title={t('landing.feature_titles.rankings')}
              desc={t('landing.feature_list.rankings')}
            />
            <Feature
              icon={ShieldCheck}
              title={t('landing.feature_titles.payroll')}
              desc={t('landing.feature_list.payroll')}
            />
            <Feature
              icon={Wallet}
              title={t('landing.feature_titles.privacy')}
              desc={t('landing.feature_list.privacy')}
            />
          </div>
        </div>

        {/* Card de acción */}
        <div className="w-full lg:w-[340px]">
          <div className="rounded-xl border border-dark-border/30 bg-dark-surface-secondary/60 p-5">
            <h2 className="text-lg font-semibold mb-1">{t('landing.connect_title')}</h2>
            <p className="text-sm text-dark-text-secondary mb-4">
              {t('landing.connect_desc')}
            </p>

            <button
              onClick={handleConnect}
              disabled={!!(appState?.account || appState?.isAuthenticated)}
              className="w-full px-4 py-2.5 rounded-lg bg-matrix-green text-white font-semibold hover:opacity-90 transition"
            >
              {t('landing.cta_connect')}
            </button>

            <p className="text-[12px] text-dark-text-secondary mt-3">
              {t('landing.disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPanel;
