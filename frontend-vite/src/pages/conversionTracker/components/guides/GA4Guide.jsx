import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Search, Fingerprint, Activity, ChevronRight, CheckCircle2 } from 'lucide-react';
import TrackerPlayground from './TrackerPlayground';

const GA4Guide = ({ microStep, form, handleAnalyticsChange, handleCredChange, onNext, onFinish, eventsFired, onFireEvent }) => {
  const { t } = useTranslation();

  const trackerId = form?.credentials?.measurementId || form?.analytics_settings?.ga4_property_id;
  const isIdValid = trackerId && trackerId.length > 5;

  if (microStep === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-24 h-24 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
          <BarChart3 size={48} />
        </div>
        <h2 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
          {t('tracker_guides.ga4.title', 'Google Analytics 4 Setup Guide')}
        </h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-md mb-10 text-lg">
          {t('tracker_guides.ga4.subtitle', 'Track user behavior and eCommerce events')}
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
        <div className="w-16 h-16 rounded-3xl bg-orange-500/20 text-orange-500 border border-orange-500/30 flex items-center justify-center mb-6">
          <Search size={32} />
        </div>
        <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
          {t('tracker_guides.ga4.step1.title', '1. Find your Measurement ID')}
        </h3>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-10 text-lg leading-relaxed">
          {t('tracker_guides.ga4.step1.desc', "Go to GA4 Admin > Data Streams > Web. Your Measurement ID starts with 'G-'.")}
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
        <div className="w-16 h-16 rounded-3xl bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 flex items-center justify-center mb-6">
          <Fingerprint size={32} />
        </div>
        <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
          {t('tracker_guides.ga4.step2.title', '2. Enter your ID')}
        </h3>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">
          {t('tracker_guides.ga4.step2.desc', 'Paste your Measurement ID below to start tracking traffic and sales.')}
        </p>
        
        <div className="w-full space-y-5 text-left mb-8">
          <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-wider pl-1">
              Measurement ID <span className="text-[10px] text-gray-500 font-normal lowercase">(Frontend Tracking)</span>
            </label>
            <input
              type="text"
              value={form?.credentials?.measurementId || ''}
              onChange={handleCredChange('measurementId')}
              placeholder="e.g. G-123456789"
              className="w-full rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50 border-2 border-light-border/40 dark:border-dark-border/40 px-5 py-4 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-yellow-500 transition-all font-mono text-base"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2 uppercase tracking-wider pl-1 mt-4">
              Property ID <span className="text-[10px] text-gray-500 font-normal lowercase">(Backend Real-time Analytics)</span>
            </label>
            <input
              type="text"
              value={form?.analytics_settings?.ga4_property_id || ''}
              onChange={handleAnalyticsChange('ga4_property_id')}
              placeholder="e.g. 123456789 (Numbers only)"
              className="w-full rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50 border-2 border-light-border/40 dark:border-dark-border/40 px-5 py-4 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-vanellix-cyan transition-all font-mono text-base"
            />
            <p className="text-[10px] text-gray-500 mt-1.5 pl-1">Found in GA4 Admin → Property Settings → Property ID.</p>
          </div>
          
          <div className="flex items-center gap-3 pt-2 pl-1 mt-6 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-4 rounded-2xl border border-light-border/30 dark:border-dark-border/30">
            <div className="relative flex items-center shrink-0">
              <input
                type="checkbox"
                id="enable_local_backup"
                checked={!!form?.analytics_settings?.enable_local_backup}
                onChange={handleAnalyticsChange('enable_local_backup')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-matrix-green"></div>
            </div>
            <div>
              <label htmlFor="enable_local_backup" className="text-sm font-bold cursor-pointer text-light-text-primary dark:text-dark-text-primary">
                Enable Local DB Backup
              </label>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Keep a local copy of events directly in your MongoDB.</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onFinish}
          disabled={!isIdValid}
          className="w-full px-8 py-4 rounded-2xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-3 shadow-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('tracker_guides.assistant.finish', 'Save & Continue')} <CheckCircle2 size={24} />
        </button>
      </div>
    );
  }



  return null;
};

export default GA4Guide;
