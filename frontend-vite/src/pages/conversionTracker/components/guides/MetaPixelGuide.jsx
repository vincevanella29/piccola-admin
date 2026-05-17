import React from 'react';
import { useTranslation } from 'react-i18next';
import { Target, Search, Fingerprint, Activity, ChevronRight, CheckCircle2 } from 'lucide-react';
import TrackerPlayground from './TrackerPlayground';

const MetaPixelGuide = ({ microStep, form, handleCredChange, onNext, onFinish, eventsFired, onFireEvent }) => {
  const { t } = useTranslation();

  const trackerId = form?.credentials?.pixel_id;
  const accessToken = form?.credentials?.access_token;
  const isIdValid = trackerId && trackerId.length > 5 && accessToken && accessToken.length > 5;

  if (microStep === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-24 h-24 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          <Target size={48} />
        </div>
        <h2 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
          {t('tracker_guides.meta.title', 'Meta Pixel Setup Guide')}
        </h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-md mb-10 text-lg">
          {t('tracker_guides.meta.subtitle', 'Track Facebook & Instagram conversions')}
        </p>
        <button
          type="button"
          onClick={onNext}
          className="px-8 py-4 rounded-2xl bg-matrix-green text-black font-bold flex items-center gap-3 shadow-neon transition-transform hover:scale-105"
        >
          {t('tracker_guides.assistant.start', 'Start Setup')} <ChevronRight size={24} />
        </button>
      </div>
    );
  }

  if (microStep === 1) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center justify-center mb-6">
          <Search size={32} />
        </div>
        <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
          {t('tracker_guides.meta.step1.title', '1. Find your Pixel ID')}
        </h3>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-10 text-lg leading-relaxed">
          {t('tracker_guides.meta.step1.desc', 'Go to Meta Events Manager. Select your Data Source (Pixel). Your ID is a string of numbers located under the name.')}
        </p>
        <button
          type="button"
          onClick={onNext}
          className="px-8 py-4 rounded-2xl bg-matrix-green text-black font-bold flex items-center gap-3 shadow-neon transition-transform hover:scale-105"
        >
          {t('tracker_guides.assistant.ihaveid', 'I have my ID')} <ChevronRight size={24} />
        </button>
      </div>
    );
  }

  if (microStep === 2) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-purple-500/20 text-purple-500 border border-purple-500/30 flex items-center justify-center mb-6">
          <Fingerprint size={32} />
        </div>
        <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
          {t('tracker_guides.meta.step2.title', '2. Enter your ID')}
        </h3>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
          {t('tracker_guides.meta.step2.desc', 'Paste your Meta Pixel ID below to connect it to the ecosystem.')}
        </p>
        
        <div className="w-full space-y-5 text-left mb-8">
          <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-wider pl-1">
              Pixel ID
            </label>
            <input
              type="text"
              value={form?.credentials?.pixel_id || ''}
              onChange={handleCredChange('pixel_id')}
              placeholder="e.g. 123456789012345"
              className="w-full rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50 border-2 border-light-border/40 dark:border-dark-border/40 px-5 py-4 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-blue-500 transition-all font-mono text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-wider pl-1">
              Access Token (CAPI)
            </label>
            <input
              type="text"
              value={form?.credentials?.access_token || ''}
              onChange={handleCredChange('access_token')}
              placeholder="e.g. EAAB..."
              className="w-full rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50 border-2 border-light-border/40 dark:border-dark-border/40 px-5 py-4 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-blue-500 transition-all font-mono text-base"
            />
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2 pl-1">Required for Conversions API server-side tracking.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onFinish}
          disabled={!isIdValid}
          className="w-full px-8 py-4 rounded-2xl bg-blue-500 text-white font-bold flex items-center justify-center gap-3 shadow-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('tracker_guides.assistant.finish', 'Save & Continue')} <CheckCircle2 size={24} />
        </button>
      </div>
    );
  }



  return null;
};

export default MetaPixelGuide;
