import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bell, ShieldAlert, X, Sparkles } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import { toast } from 'react-toastify';

const AdminPushPrompt = ({ appState }) => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    
    // We instantiate useNotifications to access the permission status and save token function
    const { 
        notificationPermission, 
        saveNotificationToken, 
        isLoading 
    } = useNotifications({
        accessToken: appState?.token,
        account: appState?.account,
        setError: (err) => toast.error(err),
        setSuccess: (msg) => toast.success(msg),
        appState: appState
    });

    useEffect(() => {
        // Only show if permission is default and user hasn't dismissed it
        if (notificationPermission !== 'default') return;
        if (localStorage.getItem('has_seen_admin_push_prompt')) return;
        
        // Ensure user is authenticated to tie the token to an identity
        if (!appState?.isAuthenticated) return;

        // Delay prompt for 5 seconds after app load
        const timeoutId = setTimeout(() => {
            setIsVisible(true);
        }, 5000);

        return () => clearTimeout(timeoutId);
    }, [notificationPermission, appState?.isAuthenticated]);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('has_seen_admin_push_prompt', 'true');
    };

    const handleActivate = async () => {
        try {
            await saveNotificationToken();
            handleClose();
        } catch (error) {
            console.error('Error activating notifications:', error);
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-6 right-6 w-80 z-[100] p-5 rounded-3xl bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-vanellix-cyan/20 dark:border-vanellix-cyan/20 shadow-neon-glow"
                >
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-full bg-vanellix-cyan/20 text-vanellix-cyan">
                            <Bell size={20} className="animate-wiggle" />
                        </div>
                        <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                            {t('admin.activate_notifications', 'Activar Alertas')}
                        </h3>
                    </div>
                    
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4 leading-relaxed">
                        {t('admin.notifications_prompt_desc', 'Recibe notificaciones en tiempo real sobre nuevos pedidos, mensajes del equipo y actualizaciones críticas del sistema.')}
                    </p>

                    <button
                        onClick={handleActivate}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 bg-vanellix-cyan hover:bg-cyan-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-vanellix-cyan/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">{t('admin.activating', 'Activando...')}</span>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                {t('admin.activate_now', 'Habilitar Notificaciones')}
                            </>
                        )}
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AdminPushPrompt;
