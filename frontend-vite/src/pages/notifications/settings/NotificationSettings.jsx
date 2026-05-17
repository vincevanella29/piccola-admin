// src/pages/notifications/settings/NotificationSettings.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Settings, Shield, RefreshCw, Bell, CheckCircle2, XCircle, Eye, EyeOff,
  ExternalLink, Copy, Check, ChevronDown, ChevronUp, Upload, AlertTriangle,
  Smartphone, Monitor, Globe, Zap, FileJson, Key, Server, Info, ArrowRight,
  User, Mail, Phone, Save
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Reusable components ─────────────────────────────────────
const SetupStep = ({ number, title, description, completed, active, children, onToggle }) => (
  <div className={`rounded-3xl border transition-all ${completed ? 'border-matrix-green/20 bg-matrix-green/5' : active ? 'border-vanellix-cyan/20 bg-vanellix-cyan/5' : 'border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e]'} shadow-sm`}>
    <button onClick={onToggle} className="w-full p-5 flex items-center gap-4 text-left">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${completed ? 'bg-matrix-green text-white' : active ? 'bg-vanellix-cyan text-white' : 'bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-gray-400'}`}>
        {completed ? <CheckCircle2 size={20} /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-bold tracking-tight ${completed ? 'text-matrix-green' : 'text-light-text-primary dark:text-white'}`}>{title}</h3>
        <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      {active ? <ChevronUp size={18} className="text-light-text-secondary" /> : <ChevronDown size={18} className="text-light-text-secondary" />}
    </button>
    <AnimatePresence>
      {active && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
          <div className="px-5 pb-5 border-t border-light-border/10 dark:border-white/5">
            <div className="pt-4">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const CopyBlock = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-1">
      {label && <p className="text-[11px] font-semibold text-light-text-secondary dark:text-gray-400 uppercase tracking-wider">{label}</p>}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-xs text-light-text-primary dark:text-white">
        <code className="flex-1 truncate">{text}</code>
        <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          {copied ? <Check size={14} className="text-matrix-green" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};

const LinkBtn = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-vanellix-cyan/10 text-vanellix-cyan hover:bg-vanellix-cyan/20 transition-colors">
    {children} <ExternalLink size={12} />
  </a>
);

const FieldMap = ({ firebaseLabel, fieldName, emoji }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5">
    <span className="text-lg">{emoji}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-light-text-secondary dark:text-gray-400">Lo que ves en Firebase:</p>
      <p className="text-sm font-semibold text-light-text-primary dark:text-white">{firebaseLabel}</p>
    </div>
    <ArrowRight size={14} className="text-vanellix-cyan shrink-0" />
    <div className="text-right">
      <p className="text-xs text-light-text-secondary dark:text-gray-400">Va en el campo:</p>
      <p className="text-sm font-bold text-vanellix-cyan">{fieldName}</p>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const NotificationSettings = ({ appState, apiConfigs, fetchApiConfigs, saveNotificationToken, uploadServiceAccount, notificationPermission, isLoading, ecosystemProviders = [], resyncEcosystemProvider }) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [configForm, setConfigForm] = useState({ 
    service: 'firebase', api_key: '', project_id: '', vapid_key: '', web_config: '',
    prompt_config: { enabled: true, prompt_title: '¡No te pierdas nada!', prompt_message: 'Recibe alertas de tus pedidos y promociones exclusivas.', collect_name: true, collect_email: true, collect_phone: false, theme: 'glassmorphism-dark', trigger_type: 'delay', trigger_value: 30 }
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedProject, setUploadedProject] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const hasConfig = apiConfigs && (Array.isArray(apiConfigs) ? apiConfigs.length > 0 : Object.keys(apiConfigs).length > 0);
  const permissionGranted = notificationPermission === 'granted';
  const storedVapidKey = (Array.isArray(apiConfigs) ? apiConfigs[0]?.vapid_key : apiConfigs?.vapid_key) || null;
  const currentVapidKey = appState?.vapidKey || appState?.providers?.firebase?.public_config?.vapidKey || storedVapidKey;
  const configObj = Array.isArray(apiConfigs) ? apiConfigs[0] : apiConfigs;
  const hasServiceAccount = uploadedProject || (hasConfig && configObj?.has_service_account);
  const isFirebaseReady = hasConfig && configObj?.firebase_initialized;

  React.useEffect(() => {
    if (hasConfig) {
      const config = Array.isArray(apiConfigs) ? apiConfigs[0] : apiConfigs;
      setConfigForm(prev => ({
        ...prev,
        vapid_key: config.vapid_key || prev.vapid_key,
        web_config: config.web_config ? JSON.stringify(config.web_config, null, 2) : prev.web_config,
        prompt_config: config.prompt_config || prev.prompt_config
      }));
    }
  }, [apiConfigs, hasConfig]);

  const step1Done = !!hasServiceAccount && isFirebaseReady && hasConfig && !!storedVapidKey;
  const step2Done = true; // Prompt config is always "done" conceptually
  const step3Done = permissionGranted;
  const step4Done = true; // Sincronización a satélites
  const progress = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;

  const toggleStep = (n) => setActiveStep(activeStep === n ? null : n);
  
  const [syncingId, setSyncingId] = useState(null);

  const handleResync = async (id) => {
    try {
      setSyncingId(id);
      await resyncEcosystemProvider(id);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    let parsedWebConfig = null;
    if (!configForm.web_config) { toast.error('Web Config es requerida'); setSaving(false); return; }
    
    const text = configForm.web_config.trim();
    try {
      parsedWebConfig = JSON.parse(text);
    } catch {
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsedWebConfig = new Function("return " + match[0])();
      } catch {
        toast.error('La Web Config no tiene un formato válido (JSON o JS Object)');
        setSaving(false);
        return;
      }
    }
    
    if (!parsedWebConfig || typeof parsedWebConfig !== 'object' || !parsedWebConfig.projectId) {
      toast.error('La Web Config es inválida o le falta el projectId');
      setSaving(false);
      return;
    }

    try {
      // Si hay un archivo seleccionado, subirlo primero
      if (selectedFile) {
        setUploading(true);
        const res = await uploadServiceAccount(selectedFile);
        setUploadedProject(res.project_id);
        setUploading(false);
      }

      // Guardar la configuración web
      const dataToSave = { 
          service: 'firebase',
          project_id: parsedWebConfig.projectId,
          api_key: parsedWebConfig.apiKey || '',
          vapid_key: configForm.vapid_key,
          web_config: parsedWebConfig,
          prompt_config: configForm.prompt_config
      };
      await appState.useNotifications.createApiConfig(dataToSave);
      await fetchApiConfigs();
      toast.success('¡Configuración Integral de Firebase guardada con éxito!');
      setSelectedFile(null); // Limpiar el archivo seleccionado
    } catch (err) { 
      toast.error(err.message || 'Error al guardar configuración'); 
      setUploading(false);
    }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Progress */}
      <div className="p-6 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-light-text-primary dark:text-white flex items-center gap-2">
              <Settings size={20} className="text-vanellix-cyan" /> Setup & Configuration
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-gray-400 mt-1">Completa estos pasos para habilitar push notifications en celulares y PCs</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-light-text-primary dark:text-white">{progress}/4</span>
            <p className="text-xs text-light-text-secondary dark:text-gray-400">pasos listos</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(progress / 4) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan" transition={{ duration: 0.6 }} />
        </div>
        {progress === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 rounded-2xl bg-matrix-green/10 text-matrix-green text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 size={18} /> ¡Todo listo! Push notifications configuradas y funcionando.
          </motion.div>
        )}
      </div>

      {/* ─── Step 1: Configuración Integral de Firebase ─── */}
      <SetupStep number={1} title="Configuración Integral de Firebase" description="Subida del JSON de servidor y credenciales públicas para el cliente" completed={step1Done} active={activeStep === 1} onToggle={() => toggleStep(1)}>
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-bold text-light-text-primary dark:text-white flex items-center gap-2"><Server size={14} className="text-vanellix-cyan" /> 1. Service Account (Llave de Servidor)</p>
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 space-y-3">
              <label className="w-full cursor-pointer">
                <div className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-dashed transition-all ${
                  (hasServiceAccount || selectedFile) ? 'border-matrix-green/30 bg-matrix-green/5' : 'border-vanellix-cyan/30 bg-vanellix-cyan/5 hover:border-vanellix-cyan/60'
                }`}>
                  {uploading ? (
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-vanellix-cyan" />
                  ) : selectedFile ? (
                    <><CheckCircle2 size={20} className="text-matrix-green" /><span className="text-sm font-semibold text-matrix-green">Archivo seleccionado: {selectedFile.name}</span></>
                  ) : hasServiceAccount && isFirebaseReady ? (
                    <><CheckCircle2 size={20} className="text-matrix-green" /><span className="text-sm font-semibold text-matrix-green">Service Account guardado y verificado ({uploadedProject || configObj?.project_id})</span></>
                  ) : hasServiceAccount && !isFirebaseReady ? (
                    <><AlertTriangle size={20} className="text-yellow-500" /><span className="text-sm font-semibold text-yellow-500">JSON guardado, pero falló la inicialización. Resúbelo.</span></>
                  ) : (
                    <><Upload size={20} className="text-vanellix-cyan" /><span className="text-sm font-semibold text-light-text-primary dark:text-white">Arrastra o haz clic para seleccionar el JSON</span></>
                  )}
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
              </label>
              <div className="p-3 rounded-xl bg-matrix-green/5 border border-matrix-green/10 text-xs text-light-text-secondary dark:text-gray-400 flex items-start gap-2">
                <Shield size={14} className="shrink-0 mt-0.5 text-matrix-green" />
                <span>El JSON se guardará <strong>encriptado en MongoDB</strong>. Nunca se expone al cliente.</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-light-border/10 dark:border-white/5">
            <p className="text-sm font-bold text-light-text-primary dark:text-white flex items-center gap-2"><Globe size={14} className="text-vanellix-cyan" /> 2. Credenciales Web (Llaves Públicas)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 flex justify-between">
                  <span>Firebase Web Config</span>
                  <LinkBtn href={`https://console.firebase.google.com/project/${configObj?.project_id || '_'}/settings/general`}>Obtener de Firebase</LinkBtn>
                </label>
                <textarea
                  value={configForm.web_config}
                  onChange={(e) => setConfigForm({ ...configForm, web_config: e.target.value })}
                  className="w-full h-32 px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono text-light-text-primary dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 resize-none"
                  placeholder="const firebaseConfig = {&#10;  apiKey: '...',&#10;  authDomain: '...',&#10;  projectId: '...'&#10;};"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 flex justify-between">
                  <span>VAPID Key (Web Push)</span>
                  <LinkBtn href={`https://console.firebase.google.com/project/${configObj?.project_id || '_'}/settings/cloudmessaging`}>Generar Key Pair</LinkBtn>
                </label>
                <textarea
                  value={configForm.vapid_key}
                  onChange={(e) => setConfigForm({ ...configForm, vapid_key: e.target.value })}
                  className="w-full h-32 px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono text-light-text-primary dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 resize-none break-all"
                  placeholder="BPxM_..."
                />
              </div>
            </div>
            
            <button
              onClick={handleSaveConfig}
              disabled={saving || uploading}
              className="w-full mt-2 py-3.5 rounded-full bg-gradient-to-r from-vanellix-cyan to-matrix-green text-black font-bold text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(saving || uploading) ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" /> : <Save size={16} />}
              Guardar Configuración Completa
            </button>
          </div>
        </div>
      </SetupStep>

      {/* ─── Step 2: Prompt UX ─── */}
      <SetupStep number={2} title="Configuración del Pop-up" description="Personaliza el mensaje que ven los usuarios para pedirles permisos" completed={step2Done} active={activeStep === 2} onToggle={() => toggleStep(2)}>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl transition-all border ${configForm.prompt_config.enabled ? 'bg-white/50 dark:bg-black/20 border-light-border/10 dark:border-white/5' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-75'} space-y-4`}>
              
              <div className="flex items-center justify-between pb-3 border-b border-light-border/10 dark:border-white/5">
                <div>
                  <h4 className="text-sm font-bold text-light-text-primary dark:text-white flex items-center gap-2">
                    <Bell size={16} className={configForm.prompt_config.enabled ? 'text-vanellix-cyan' : 'text-gray-400'} /> Pop-up Activo
                  </h4>
                  <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-0.5">Mostrar en satélites</p>
                </div>
                <button 
                  onClick={() => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, enabled: !p.prompt_config.enabled } }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${configForm.prompt_config.enabled ? 'bg-vanellix-cyan' : 'bg-black/20 dark:bg-white/20'}`}
                >
                  <motion.div animate={{ x: configForm.prompt_config.enabled ? 24 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" />
                </button>
              </div>

              {configForm.prompt_config.enabled && (
                <>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-light-text-secondary dark:text-gray-300">Título del Pop-up</label>
                    <input value={configForm.prompt_config.prompt_title} onChange={(e) => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, prompt_title: e.target.value } }))} placeholder="¡No te pierdas nada!" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-sm text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-light-text-secondary dark:text-gray-300">Mensaje del Pop-up</label>
                    <textarea value={configForm.prompt_config.prompt_message} onChange={(e) => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, prompt_message: e.target.value } }))} placeholder="Recibe alertas de tus pedidos..." className="w-full h-20 px-4 py-2.5 rounded-xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-sm text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 resize-none" />
                  </div>

                  <div className="pt-2">
                    <label className="text-xs font-semibold text-light-text-secondary dark:text-gray-300 mb-2 block">¿Qué datos pedirle al Lead?</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <input type="checkbox" checked={configForm.prompt_config.collect_name} onChange={(e) => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, collect_name: e.target.checked } }))} className="w-4 h-4 rounded text-vanellix-cyan bg-white dark:bg-black/40 border-gray-300 dark:border-gray-600 focus:ring-vanellix-cyan" />
                        <User size={16} className={configForm.prompt_config.collect_name ? "text-vanellix-cyan" : "text-gray-400"} />
                        <span className={`text-sm font-semibold ${configForm.prompt_config.collect_name ? 'text-light-text-primary dark:text-white' : 'text-gray-400'}`}>Solicitar Nombre</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <input type="checkbox" checked={configForm.prompt_config.collect_email} onChange={(e) => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, collect_email: e.target.checked } }))} className="w-4 h-4 rounded text-vanellix-cyan bg-white dark:bg-black/40 border-gray-300 dark:border-gray-600 focus:ring-vanellix-cyan" />
                        <Mail size={16} className={configForm.prompt_config.collect_email ? "text-vanellix-cyan" : "text-gray-400"} />
                        <span className={`text-sm font-semibold ${configForm.prompt_config.collect_email ? 'text-light-text-primary dark:text-white' : 'text-gray-400'}`}>Solicitar Email (Sugerido)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <input type="checkbox" checked={configForm.prompt_config.collect_phone} onChange={(e) => setConfigForm(p => ({ ...p, prompt_config: { ...p.prompt_config, collect_phone: e.target.checked } }))} className="w-4 h-4 rounded text-vanellix-cyan bg-white dark:bg-black/40 border-gray-300 dark:border-gray-600 focus:ring-vanellix-cyan" />
                        <Phone size={16} className={configForm.prompt_config.collect_phone ? "text-vanellix-cyan" : "text-gray-400"} />
                        <span className={`text-sm font-semibold ${configForm.prompt_config.collect_phone ? 'text-light-text-primary dark:text-white' : 'text-gray-400'}`}>Solicitar Teléfono</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className={!configForm.prompt_config.enabled ? 'opacity-50 pointer-events-none grayscale transition-all' : 'transition-all'}>
            <div className="sticky top-4">
              <p className="text-xs font-bold text-light-text-secondary dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Eye size={14}/> Previsualización (Satélite)</p>
              <div className="relative w-full aspect-[9/16] max-w-[320px] mx-auto bg-gray-100 dark:bg-neutral-900 rounded-[2.5rem] border-[8px] border-black/10 dark:border-white/5 overflow-hidden shadow-2xl flex flex-col justify-end">
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-black/20 pointer-events-none" />
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 m-4 p-5 rounded-3xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl space-y-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight flex items-center gap-2">
                      <Bell size={16} className="text-vanellix-cyan" /> {configForm.prompt_config.prompt_title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">{configForm.prompt_config.prompt_message}</p>
                  </div>
                  <button disabled className="w-full py-2.5 rounded-full bg-vanellix-cyan text-white text-xs font-bold shadow-lg shadow-vanellix-cyan/20">Activar Alertas</button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </SetupStep>

      {/* ─── Step 3: Solicitar Permisos Push ─── */}
      <SetupStep number={3} title="Solicitar Permisos Push" description="Activa las notificaciones en este navegador para que funcione la consola" completed={step3Done} active={activeStep === 3} onToggle={() => toggleStep(3)}>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5">
            <div className={`p-3 rounded-2xl ${permissionGranted ? 'bg-matrix-green/10 text-matrix-green' : notificationPermission === 'denied' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
              {permissionGranted ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-light-text-primary dark:text-white">
                Status: <span className="uppercase">{notificationPermission}</span>
              </p>
              <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-0.5">
                {permissionGranted ? 'Push notifications activas en este dispositivo.' : notificationPermission === 'denied' ? 'Bloqueadas — abre la config del browser para re-habilitarlas.' : 'Haz clic abajo para solicitar permiso.'}
              </p>
            </div>
          </div>

          {notificationPermission === 'denied' && (
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-2">
              <p className="text-sm font-semibold text-red-500 flex items-center gap-2"><AlertTriangle size={14} /> Permiso Bloqueado</p>
              <ol className="text-xs text-light-text-secondary dark:text-gray-400 space-y-1 pl-4 list-decimal">
                <li>Haz clic en el ícono 🔒 en la barra de direcciones</li>
                <li>Busca "Notificaciones" y cámbialo a "Permitir"</li>
                <li>Recarga esta página</li>
              </ol>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: Monitor, label: 'Desktop', desc: 'Chrome, Firefox, Edge' },
              { icon: Smartphone, label: 'Celular Web', desc: 'Android Chrome, iOS 16.4+' },
              { icon: Globe, label: 'PWA', desc: 'Agregar a pantalla inicio' },
            ].map(d => (
              <div key={d.label} className="p-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 text-center">
                <d.icon size={20} className="mx-auto mb-2 text-vanellix-cyan" />
                <p className="text-xs font-semibold text-light-text-primary dark:text-white">{d.label}</p>
                <p className="text-[10px] text-light-text-secondary dark:text-gray-400">{d.desc}</p>
              </div>
            ))}
          </div>

          <button onClick={saveNotificationToken} disabled={isLoading || permissionGranted} className="w-full px-6 py-3.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 font-bold text-base disabled:opacity-50">
            <Bell size={18} />
            {permissionGranted ? '✓ Notificaciones Habilitadas' : 'Habilitar Push Notifications'}
          </button>
        </div>
      </SetupStep>

      {/* ─── Step 4: Sincronización a Satélites ─── */}
      <SetupStep number={4} title="Sincronización a Satélites (Hub & Spoke)" description="Obliga a los satélites (Delivery/Carta) a descargar tu configuración actual" completed={step4Done} active={activeStep === 4} onToggle={() => toggleStep(4)}>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-vanellix-cyan/5 border border-vanellix-cyan/10">
            <p className="text-sm font-bold text-light-text-primary dark:text-white flex items-center gap-2"><Zap size={14} className="text-vanellix-cyan" /> Dilithium Sync</p>
            <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-1">
              Al presionar <strong>Force Resync</strong>, el Admin Hub firmará de manera post-cuántica tu configuración de Firebase (incluyendo el diseño del pop-up) y la inyectará en tiempo real en los satélites activos.
            </p>
          </div>

          <div className="grid gap-4">
            {ecosystemProviders.length === 0 ? (
              <p className="text-sm text-center text-light-text-secondary dark:text-gray-400 py-4 italic">No hay satélites registrados en el ecosistema.</p>
            ) : (
              ecosystemProviders.map(provider => (
                <div key={provider._id || provider.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                      <Server className="text-vanellix-cyan" size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-light-text-primary dark:text-white">{provider.name}</h4>
                      <p className="text-xs text-light-text-secondary dark:text-gray-400 font-mono mt-0.5">{provider.slug} • <span className={provider.status === 'active' ? 'text-matrix-green' : 'text-red-500'}>{provider.status}</span></p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResync(provider._id || provider.id)}
                    disabled={syncingId === (provider._id || provider.id)}
                    className="px-4 py-2 text-xs font-bold rounded-full bg-black/5 dark:bg-white/5 hover:bg-vanellix-cyan hover:text-white transition-colors border border-black/10 dark:border-white/10 hover:border-vanellix-cyan flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={syncingId === (provider._id || provider.id) ? "animate-spin" : ""} />
                    {syncingId === (provider._id || provider.id) ? 'Sincronizando...' : 'Force Resync'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </SetupStep>
    </div>
  );
};

export default NotificationSettings;
