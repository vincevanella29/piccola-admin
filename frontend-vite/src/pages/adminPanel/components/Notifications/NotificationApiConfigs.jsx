import React from 'react';
import { useTranslation } from 'react-i18next';

const NotificationApiConfigs = ({ apiConfigs, isLoading, fetchApiConfigs }) => {
  const { t } = useTranslation();

  return (
    <div>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('notifications.api_configs_list')}
        </h2>
        <button
          onClick={fetchApiConfigs}
          className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base"
          disabled={isLoading}
        >
          {isLoading ? t('common.loading') : t('notifications.update_api_configs')}
        </button>
        {!apiConfigs || Object.keys(apiConfigs).length === 0 ? (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            {t('notifications.no_api_configs')}
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-4xl">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary">
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.setting')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize">
                    {t('notifications.value')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(apiConfigs).map(([key, value]) => (
                  <tr key={key} className="border-b border-light-border/40 dark:border-dark-border/40 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40">
                    <td className="py-3 px-4 text-light-text-primary dark:text-dark-text-primary text-xs sm:text-sm font-medium whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm break-all">
                      {key.toLowerCase().includes('key') ? '••••••••••••••••••••••••' : (value || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationApiConfigs;