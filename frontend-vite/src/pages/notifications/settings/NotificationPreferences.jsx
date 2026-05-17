import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, MessageSquare, Zap, Target, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../utils/api'; // Assuming standard api util

const NOTIFICATION_TOPICS = [
  {
    id: 'community_announcement',
    title: 'Anuncios de Comunidad (@all)',
    description: 'Notificaciones push cuando un administrador envía un anuncio global en el chat.',
    icon: MessageSquare,
    color: 'text-vanellix-cyan',
    bg: 'bg-vanellix-cyan/10'
  },
  {
    id: 'customer_registered',
    title: 'Nuevos Registros de Clientes',
    description: 'Recibe alertas inmediatas cuando un nuevo cliente crea una cuenta en el portal de delivery.',
    icon: Target,
    color: 'text-matrix-green',
    bg: 'bg-matrix-green/10'
  },
  {
    id: 'order_status_change',
    title: 'Cambios de Estado de Orden',
    description: 'Notificaciones sobre pedidos que cambian de estado (preparando, entregado, etc).',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10'
  }
];

const NotificationPreferences = ({ appState }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await api({
        method: 'GET',
        endpoint: '/notifications/preferences',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res?.success) {
        setPreferences(res.preferences || {});
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = (topicId) => {
    // If undefined, default is true. So toggling undefined means turning it off (false).
    const currentValue = preferences[topicId] !== false; 
    setPreferences(prev => ({
      ...prev,
      [topicId]: !currentValue
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api({
        method: 'POST',
        endpoint: '/notifications/preferences',
        data: preferences,
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save preferences', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-vanellix-cyan" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-2">
            <Bell className="text-vanellix-cyan" />
            Preferencias de Notificaciones
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-gray-400 mt-1">
            Personaliza qué alertas y mensajes automatizados quieres recibir en tu dispositivo.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : showSaved ? <CheckCircle2 size={18} /> : null}
          {showSaved ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid gap-4">
        {NOTIFICATION_TOPICS.map((topic) => {
          const isEnabled = preferences[topic.id] !== false;
          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => togglePreference(topic.id)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${isEnabled ? 'bg-light-surface/80 dark:bg-black/40 border-vanellix-cyan/30 shadow-md' : 'bg-light-surface/30 dark:bg-[#1c1c1e] border-light-border/10 dark:border-white/5 opacity-75 grayscale'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${topic.bg}`}>
                  <topic.icon className={`w-6 h-6 ${topic.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-light-text-primary dark:text-white text-lg">{topic.title}</h3>
                  <p className="text-sm text-light-text-secondary dark:text-gray-400 leading-snug max-w-md">
                    {topic.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 relative w-14 h-8 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shadow-inner flex items-center px-1">
                <motion.div
                  initial={false}
                  animate={{ 
                    x: isEnabled ? 24 : 0,
                    backgroundColor: isEnabled ? '#00e5ff' : '#6b7280' // vanellix-cyan or gray
                  }}
                  className="w-6 h-6 rounded-full bg-vanellix-cyan shadow-sm"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationPreferences;
