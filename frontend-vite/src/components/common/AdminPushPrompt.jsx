import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bell, ShieldAlert, X, Sparkles } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import { toast } from 'react-toastify';

const AdminPushPrompt = ({ appState }) => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isIOSStandaloneWarning, setIsIOSStandaloneWarning] = useState(false);
    
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
        setMounted(true);
        // Only show if permission is default and user hasn't dismissed it
        if (notificationPermission !== 'default') return;
        if (localStorage.getItem('has_seen_admin_push_prompt')) return;
        
        // Ensure user is authenticated to tie the token to an identity
        if (!appState?.isAuthenticated) return;

        // Check iOS standalone mode
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isIOS && !isStandalone) {
            setIsIOSStandaloneWarning(true);
        }

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

    if (!mounted) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-6 md:right-6 z-[999999] w-auto md:w-[380px] p-5 md:p-6 rounded-[28px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl bg-white/85 dark:bg-[#1c1c1e]/85 border border-gray-200/50 dark:border-white/10 text-gray-900 dark:text-white font-sans overflow-hidden"
                >
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1.5 bg-gray-100/80 dark:bg-white/10 rounded-full text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                    
                    <div className="flex items-center gap-3.5 mb-2">
                        <div className="p-2.5 bg-gradient-to-tr from-vanellix-cyan to-cyan-400 rounded-2xl shadow-sm text-white">
                            <Bell size={20} strokeWidth={2.5} className="animate-wiggle" />
                        </div>
                        <h3 className="font-semibold text-[19px] tracking-tight leading-tight pr-6 text-gray-900 dark:text-white">
                            {t('admin.activate_notifications', 'Activar Alertas')}
                        </h3>
                    </div>
                    
                    <p className="text-[15px] text-gray-500 dark:text-gray-300 mb-5 leading-relaxed tracking-tight">
                        {isIOSStandaloneWarning 
                            ? "Para recibir notificaciones en iPhone, primero debes agregar esta página a tu Pantalla de Inicio (Compartir -> Agregar a Inicio)."
                            : t('admin.notifications_prompt_desc', 'Recibe notificaciones en tiempo real sobre nuevos pedidos, mensajes del equipo y actualizaciones críticas del sistema.')}
                    </p>

                    <button
                        onClick={handleActivate}
                        disabled={isLoading || isIOSStandaloneWarning}
                        className="w-full mt-1 py-3.5 px-4 bg-vanellix-cyan hover:bg-cyan-500 text-white rounded-[14px] text-[15px] font-semibold shadow-sm hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Sparkles size={16} />
                                {isIOSStandaloneWarning ? "Agrega a Inicio primero" : t('admin.activate_now', 'Habilitar Notificaciones')}
                            </>
                        )}
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AdminPushPrompt;
