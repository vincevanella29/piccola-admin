// src/pages/notifications/send/NotificationSend.jsx
// Playground with macOS-style terminal + Manual send
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Play, Terminal, Bell, Send, Users, Clock, AlertTriangle, Smartphone, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

const NotificationSend = ({ appState, notificationTypes = [], sendNotification, audience = [], fetchAudience, fetchUsersWithTokens, saveNotificationToken, notificationPermission, isLoading }) => {
  const { t } = useTranslation();
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (audience.length === 0 && fetchAudience) fetchAudience();
  }, []);

  const handleRegisterDevice = async () => {
    setRegistering(true);
    try {
      await saveNotificationToken();
      await fetchUsersWithTokens();
      if (fetchAudience) await fetchAudience();
      toast.success('✅ Dispositivo registrado correctamente!');
    } catch (err) {
      toast.error('Error al registrar dispositivo. Verifica la VAPID Key en Settings.');
    } finally {
      setRegistering(false);
    }
  };

  // --- Test mode ---
  const [testType, setTestType] = useState('');
  const [testData, setTestData] = useState('{}');
  const [testResponse, setTestResponse] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // --- Manual mode ---
  const [manualForm, setManualForm] = useState({
    notification_type_id: '',
    target_token: '',
    data: '{}',
    schedule_time: '',
  });

  const handleTestSend = async () => {
    if (!testType) return;
    setTestLoading(true);
    setTestResponse(null);
    try {
      const data = JSON.parse(testData || '{}');
      const res = await sendNotification({
        notification_type_id: testType,
        data,
      });
      setTestResponse({ status: 'success', data: res });
      toast.success(t('notifications.test_send_success') || 'Test sent!');
    } catch (err) {
      setTestResponse({ status: 'error', data: err.message || err });
      toast.error(t('notifications.error_sending_notification') || 'Error sending test');
    } finally {
      setTestLoading(false);
    }
  };

  const handleManualSend = async () => {
    if (!manualForm.notification_type_id || !manualForm.target_token) return;
    try {
      const data = JSON.parse(manualForm.data || '{}');
      await sendNotification({
        ...manualForm,
        data,
      });
      toast.success(t('notifications.notification_sent') || 'Notification sent!');
      setManualForm({ notification_type_id: '', target_token: '', data: '{}', schedule_time: '' });
    } catch (err) {
      toast.error(t('notifications.error_sending_notification') || 'Error sending notification');
    }
  };

  const selectedTestType = notificationTypes.find(nt => nt.id === testType);

  return (
    <div className="space-y-8 pb-10">
      
      {/* ─── Apple-Style Header for Section ─── */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('notifications.playground') || 'Push Playground'}
        </h2>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {t('notifications.playground_desc') || 'Select a template, configure your payload, and instantly dispatch a test notification.'}
        </p>
      </div>

      {/* ─── No Devices Banner (Apple Style Warning) ─── */}
      <AnimatePresence>
        {audience.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 rounded-[2rem] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-700/30 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0 shadow-sm">
                  <Smartphone size={24} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-amber-900 dark:text-amber-300">No hay dispositivos registrados</h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1 max-w-lg leading-relaxed">
                    Para enviar notificaciones push necesitas registrar al menos un dispositivo. Haz clic para habilitar el registro en este navegador.
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRegisterDevice}
                disabled={registering}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-50"
              >
                {registering ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <ShieldCheck size={18} />}
                {notificationPermission === 'granted' ? 'Vincular Dispositivo' : 'Habilitar Permisos'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* ─── Config Panel (Left) ─── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-6 md:p-8 rounded-[2rem] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 shadow-xl shadow-gray-200/20 dark:shadow-black/40 flex flex-col gap-6">
            
            {/* Select Template */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Bell size={16} className="text-vanellix-cyan" /> 
                {t('notifications.select_template') || 'Template'}
              </label>
              <div className="relative group">
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none transition-all font-medium text-sm hover:border-vanellix-cyan/30"
                >
                  <option value="">-- {t('notifications.select_notification_type') || 'Select template'} --</option>
                  {notificationTypes.map(nt => (
                    <option key={nt.id} value={nt.id}>{nt.event_name} ({nt.target_type})</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-colors">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Template Preview */}
            <AnimatePresence>
              {selectedTestType && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                  animate={{ opacity: 1, height: 'auto', marginTop: -8 }} 
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-2xl bg-vanellix-cyan/5 dark:bg-vanellix-cyan/10 border border-vanellix-cyan/10 text-sm flex flex-col gap-1.5">
                    <p className="font-semibold text-gray-900 dark:text-white leading-tight">{selectedTestType.title_template}</p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-xs">{selectedTestType.body_template}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* JSON Data Input */}
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('notifications.data') || 'Payload Data (JSON)'}
              </label>
              <textarea
                rows={4}
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder='{
  "order_id": "1042",
  "user_name": "Juan",
  "icon_url": "https://example.com/icon.png",
  "link_url": "/app/orders"
}'
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 font-mono text-[13px] resize-none transition-all hover:border-vanellix-cyan/30"
              />
            </div>

            {/* Audience Meta */}
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
              <span className="flex items-center gap-1.5">
                <Users size={14} /> {audience.length} {t('notifications.devices_registered') || 'device(s) ready'}
              </span>
              <button onClick={fetchAudience} className="text-vanellix-cyan hover:text-matrix-green transition-colors">
                {t('common.refresh') || 'Refresh list'}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleTestSend}
            disabled={!testType || testLoading}
            className="w-full p-4 rounded-[1.5rem] bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-xl shadow-matrix-green/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale-[0.5] font-bold text-base transition-all"
          >
            {testLoading ? (
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            ) : (
              <Play size={20} fill="currentColor" />
            )}
            {t('notifications.send_test_button') || 'Dispatch Test Push'}
          </motion.button>
        </div>

        {/* ─── Terminal Response (Right) ─── */}
        <div className="lg:col-span-7 flex flex-col h-[550px] lg:h-auto min-h-[450px] border border-gray-200/60 dark:border-white/10 rounded-[2rem] overflow-hidden bg-white/80 dark:bg-[#0c0c0c]/80 backdrop-blur-3xl shadow-2xl shadow-black/5 dark:shadow-black/50">
          
          {/* macOS Titlebar */}
          <div className="flex items-center px-5 py-3.5 bg-gray-50/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/5">
            <div className="flex gap-2 mr-4">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm border border-black/10"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm border border-black/10"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm border border-black/10"></div>
            </div>
            <div className="flex-1 flex justify-center text-[13px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide font-sans">
              Push Console
              {selectedTestType && <span className="ml-2 font-normal opacity-70">— {selectedTestType.event_name}</span>}
            </div>
            <div className="w-16 flex justify-end">
              <AnimatePresence>
                {testResponse && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      testResponse.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}
                  >
                    {testResponse.status}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto font-mono text-[13px] leading-relaxed bg-[#f8f9fa]/50 dark:bg-transparent text-gray-800 dark:text-gray-300">
            {testLoading ? (
              <div className="animate-pulse flex gap-2 h-full p-4 items-start">
                <div className="h-3 w-3 bg-vanellix-cyan rounded-full"></div>
                <div className="h-3 w-3 bg-vanellix-cyan/70 rounded-full"></div>
                <div className="h-3 w-3 bg-vanellix-cyan/40 rounded-full"></div>
              </div>
            ) : testResponse ? (
              <motion.pre 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-pre-wrap font-mono leading-loose"
              >
                {JSON.stringify(testResponse.data, null, 2)}
              </motion.pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 flex-col gap-4">
                <div className="p-4 rounded-full bg-gray-100 dark:bg-white/5">
                  <Terminal size={32} strokeWidth={1.5} />
                </div>
                <span className="font-sans text-sm font-medium">{t('notifications.playground_idle') || 'Select a template and dispatch a test to view results.'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-white/5 my-4" />

      {/* ─── Manual Send Advanced ─── */}
      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Left: Manual Send Form */}
        <div className="p-6 md:p-8 rounded-[2rem] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 shadow-xl shadow-gray-200/20 dark:shadow-black/40 flex flex-col gap-6">
          <div className="flex flex-col gap-1 mb-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Send size={20} className="text-vanellix-cyan" />
              {t('notifications.send_manual_notification') || 'Advanced Dispatch'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Target specific users, override payloads, or schedule pushes for the future.</p>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('notifications.notification_type') || 'Template'}</label>
              <div className="relative group">
                <select
                  value={manualForm.notification_type_id}
                  onChange={(e) => setManualForm(prev => ({ ...prev, notification_type_id: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none font-medium text-sm hover:border-vanellix-cyan/30 transition-all"
                >
                  <option value="">{t('notifications.select_notification_type') || 'Select template'}</option>
                  {notificationTypes.map(nt => (
                    <option key={nt.id} value={nt.id}>{nt.event_name} ({nt.target_type})</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-colors">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('notifications.target_user') || 'Target Override'}</label>
              <div className="relative group">
                <select
                  value={manualForm.target_token}
                  onChange={(e) => setManualForm(prev => ({ ...prev, target_token: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none font-medium text-sm hover:border-vanellix-cyan/30 transition-all"
                >
                  <option value="">{t('notifications.select_user') || 'Select specific device'}</option>
                  {audience.map((u, i) => (
                    <option key={u.token || i} value={u.token}>
                      {u.name || u.email || u.wallet || u.privy_id || 'Anonymous'} ({u.segment})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-colors">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('notifications.data') || 'Payload Overlay (JSON)'}</label>
              <textarea
                rows={2}
                value={manualForm.data}
                onChange={(e) => setManualForm(prev => ({ ...prev, data: e.target.value }))}
                placeholder='{"discount_code": "VANELLIX20", "icon_url": "https://..."}'
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 font-mono text-[13px] resize-none hover:border-vanellix-cyan/30 transition-all"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Clock size={16} className="text-matrix-green" /> {t('notifications.schedule_time') || 'Schedule Push'} 
                <span className="text-xs font-normal opacity-50 px-2 py-0.5 rounded-md bg-gray-200 dark:bg-white/10">Optional</span>
              </label>
              <input
                type="datetime-local"
                value={manualForm.schedule_time}
                onChange={(e) => setManualForm(prev => ({ ...prev, schedule_time: e.target.value }))}
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-matrix-green/50 hover:border-matrix-green/30 transition-all font-medium text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-gray-100 dark:border-white/5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleManualSend}
              disabled={isLoading || !manualForm.notification_type_id || !manualForm.target_token}
              className="px-8 py-3.5 rounded-2xl bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 dark:text-black text-white shadow-xl shadow-gray-900/10 dark:shadow-white/10 flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none font-bold text-sm transition-all"
            >
              <Send size={18} /> {t('notifications.send_button') || 'Dispatch Notification'}
            </motion.button>
          </div>
        </div>

        {/* Right: Registered Devices List */}
        <div className="p-6 md:p-8 rounded-[2rem] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 shadow-xl shadow-gray-200/20 dark:shadow-black/40 flex flex-col h-[650px]">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-vanellix-cyan" />
                {t('notifications.users_with_tokens') || 'Registered Audience'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Linked devices available for push.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-vanellix-cyan bg-vanellix-cyan/10 px-3 py-1 rounded-full">
                {audience.length}
              </span>
              <button
                onClick={fetchAudience}
                disabled={isLoading}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-50"
              >
                <motion.div animate={{ rotate: isLoading ? 360 : 0 }} transition={{ repeat: isLoading ? Infinity : 0, duration: 1, ease: "linear" }}>
                  <Clock size={16} />
                </motion.div>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 custom-scrollbar">
            {audience.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                  <Users size={28} />
                </div>
                <p className="text-base font-medium">{t('notifications.no_users_with_tokens') || 'No audience found'}</p>
              </div>
            ) : (
              audience.map((u, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={u.token || i} 
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center shrink-0">
                      <Smartphone size={18} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px] group-hover:text-vanellix-cyan transition-colors">
                        {u.name || u.email || u.wallet || u.privy_id || 'Anonymous'}
                      </span>
                      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">{u.segment}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-vanellix-cyan/10 text-vanellix-cyan border border-vanellix-cyan/20">
                    {u.device_type}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSend;

