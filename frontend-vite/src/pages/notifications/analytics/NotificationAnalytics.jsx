import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { FiBarChart2, FiCheckCircle, FiXCircle, FiSend, FiEye } from 'react-icons/fi';

const StatCard = ({ title, value, icon, gradient, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="relative overflow-hidden bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/40 dark:border-dark-border/40 p-6 group"
  >
    <div className={`absolute -inset-1 ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-xl`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
          {title}
        </p>
        <h3 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
          {value}
        </h3>
      </div>
      <div className={`p-3 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-2xl`}>
        {icon}
      </div>
    </div>
  </motion.div>
);

const NotificationAnalytics = ({
  analyticsData,
  fetchAnalytics,
  isLoading
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const kpis = analyticsData?.kpis || { total_success: 0, success_rate: 0, total_errors: 0, error_rate: 0, total_opened: 0 };
  const timeseries = analyticsData?.timeseries || [];
  const campaigns = analyticsData?.campaigns || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-3 rounded-lg shadow-xl">
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs mb-2 font-medium">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-light-text-primary dark:text-dark-text-primary capitalize">{entry.name}:</span>
              <span className="text-light-text-primary dark:text-dark-text-primary">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
          <FiBarChart2 size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
            {t('notifications.analytics')}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {t('notifications.analytics_desc')}
          </p>
        </div>
      </div>

      {isLoading && !analyticsData ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title={t('notifications.kpi_total_sent')}
              value={kpis.total_success.toLocaleString()}
              icon={<FiSend className="text-blue-500" />}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              delay={0.1}
            />
            <StatCard
              title={t('notifications.kpi_delivery_rate')}
              value={`${kpis.success_rate}%`}
              icon={<FiCheckCircle className="text-green-500" />}
              gradient="bg-gradient-to-br from-green-500 to-emerald-500"
              delay={0.2}
            />
            <StatCard
              title={t('notifications.kpi_failed')}
              value={kpis.total_errors.toLocaleString()}
              icon={<FiXCircle className="text-red-500" />}
              gradient="bg-gradient-to-br from-red-500 to-rose-500"
              delay={0.3}
            />
            <StatCard
              title={t('notifications.kpi_open_rate')}
              value={`${kpis.total_success > 0 ? Math.round((kpis.total_opened / kpis.total_success) * 100) : 0}%`}
              icon={<FiEye className="text-purple-500" />}
              gradient="bg-gradient-to-br from-purple-500 to-fuchsia-500"
              delay={0.4}
            />
          </div>

          {/* Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/40 dark:border-dark-border/40 p-6"
          >
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-6">
              {t('notifications.delivery_timeline')}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-light-border dark:text-dark-border opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dy={10}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth()+1}`;
                    }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="success" 
                    name={t('notifications.success')}
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSuccess)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="error" 
                    name={t('notifications.error')}
                    stroke="#ef4444" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorError)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Campaigns Log Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden"
          >
            <div className="p-6 border-b border-light-border/40 dark:border-dark-border/40">
              <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                {t('notifications.campaign_log')}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {t('notifications.campaign_log_desc')}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary/50 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-lg">{t('notifications.date')}</th>
                    <th className="px-6 py-4">{t('notifications.event_name')} / Title</th>
                    <th className="px-6 py-4">{t('notifications.target')}</th>
                    <th className="px-6 py-4 text-center">{t('notifications.success')}</th>
                    <th className="px-6 py-4 text-center">{t('notifications.kpi_open_rate')}</th>
                    <th className="px-6 py-4 text-center">{t('notifications.error')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/40">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                        {t('notifications.no_campaigns')}
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((camp, idx) => (
                      <tr key={`${camp._id || camp.id || 'camp'}-${idx}`} className="hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                          {new Date(camp.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-light-text-primary dark:text-dark-text-primary">{camp.title}</div>
                          <div className="text-xs truncate max-w-xs">{camp.body}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded text-xs font-semibold uppercase">
                            {camp.target_type}
                          </span>
                          {camp.target_type !== 'all' && (
                            <div className="text-xs mt-1 truncate max-w-[120px]" title={camp.target_value}>
                              {camp.target_value}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-semibold text-green-500">{camp.success_count}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-semibold text-purple-500">{camp.opened_count || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-semibold ${camp.error_count > 0 ? 'text-red-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                            {camp.error_count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default NotificationAnalytics;
