// MailSettings.jsx — Email provider configuration with Dilithium encryption
// Props from hook: loadMailSettings, saveMailSettings, testMailSettings, deleteMailSettings
import React, { useState, useEffect } from 'react';
import { FaSave, FaPaperPlane, FaTrash, FaEye, FaEyeSlash, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaShieldAlt, FaServer } from 'react-icons/fa';

const PROVIDERS = [
  { value: 'direct', label: '🚀 Vanellix', desc: 'Envío directo desde tu servidor (MX)' },
  { value: 'smtp', label: '📧 SMTP', desc: 'Servidor SMTP externo' },
  { value: 'ses', label: '☁️ AWS SES', desc: 'Amazon SES (SMTP relay)' },
  { value: 'gmail', label: '📬 Gmail', desc: 'Google con app password' },
];

// Defined OUTSIDE component to prevent re-creation on every render (focus loss fix)
const InputField = ({ label, value, onChange, type = 'text', placeholder, icon, hint }) => (
  <div>
    <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">{label}</label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-2.5 text-light-text-tertiary text-xs">{icon}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full ${icon ? 'pl-8' : 'px-3'} pr-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary`} />
    </div>
    {hint && <p className="text-[9px] text-light-text-tertiary mt-0.5">{hint}</p>}
  </div>
);

const MailSettings = ({ loadMailSettings, saveMailSettings, testMailSettings, deleteMailSettings }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Form state
  const [provider, setProvider] = useState('direct');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('La Piccola Italia');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [tls, setTls] = useState(true);
  const [ssl, setSsl] = useState(false);
  const [sesRegion, setSesRegion] = useState('us-east-1');
  const [sesAccessKey, setSesAccessKey] = useState('');
  const [sesSecretKey, setSesSecretKey] = useState('');
  // Direct rate limits
  const [ratePerHour, setRatePerHour] = useState(50);
  const [ratePerDay, setRatePerDay] = useState(500);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await loadMailSettings();
    setConfig(r);
    if (r?.configured) {
      setProvider(r.provider || 'direct');
      setFromEmail(r.from_email || '');
      setFromName(r.from_name || 'La Piccola Italia');
      setHost(r.host || '');
      setPort(r.port || 587);
      setUser(r.user || '');
      setTls(r.tls ?? true);
      setSsl(r.ssl ?? false);
      setSesRegion(r.ses_region || 'us-east-1');
      setRatePerHour(r.rate_per_hour || 50);
      setRatePerDay(r.rate_per_day || 500);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { provider, from_email: fromEmail, from_name: fromName };
      if (provider === 'direct') {
        Object.assign(data, { rate_per_hour: ratePerHour, rate_per_day: ratePerDay });
      } else if (provider === 'smtp') {
        Object.assign(data, { host, port, user, password: password || undefined, tls, ssl });
      } else if (provider === 'gmail') {
        Object.assign(data, { user, password: password || undefined });
      } else if (provider === 'ses') {
        Object.assign(data, { ses_region: sesRegion, ses_access_key: sesAccessKey || undefined, ses_secret_key: sesSecretKey || undefined });
      }
      await saveMailSettings(data);
      await load();
      setPassword(''); setSesAccessKey(''); setSesSecretKey('');
    } catch {}
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    try { await testMailSettings(testEmail.trim()); }
    catch {}
    setTesting(false);
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar configuración? Se usarán las variables de entorno.')) return;
    await deleteMailSettings();
    await load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20"><FaSpinner className="animate-spin text-matrix-green" size={20} /></div>
  );


  const providerLabel = PROVIDERS.find(p => p.value === (config?.provider))?.label || config?.provider?.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Status badge */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config?.configured ? 'bg-matrix-green/5 border-matrix-green/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {config?.configured ? <FaCheckCircle className="text-matrix-green" size={16} /> : <FaExclamationTriangle className="text-amber-500" size={16} />}
        <div>
          <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
            {config?.configured ? `✅ Configurado — ${providerLabel}` : '⚠️ Sin configurar'}
          </p>
          <p className="text-[10px] text-light-text-tertiary">
            {config?.configured
              ? config.provider === 'direct'
                ? `${config.from_email} · Envío directo MX · ${config.rate_per_hour}/h · ${config.rate_per_day}/día`
                : `${config.from_email} · ${config.host || 'auto'}`
              : 'Los emails se enviarán con las variables de entorno SMTP_*'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-light-text-tertiary">
          <FaShieldAlt size={9} className="text-matrix-green" /> Encriptado con Dilithium
        </div>
      </div>

      {/* Provider selector */}
      <div className="grid grid-cols-4 gap-2">
        {PROVIDERS.map(p => (
          <button key={p.value} onClick={() => setProvider(p.value)}
            className={`px-2 py-3 rounded-xl border transition-all text-center ${provider === p.value ? 'bg-matrix-green/10 border-matrix-green/30 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 text-light-text-secondary hover:border-matrix-green/20'}`}>
            <span className="text-base block">{p.label.split(' ')[0]}</span>
            <span className="text-[10px] font-bold block mt-0.5">{p.label.split(' ').slice(1).join(' ')}</span>
            <span className="text-[8px] text-light-text-tertiary block leading-tight">{p.desc}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Email remitente" value={fromEmail} onChange={setFromEmail} placeholder="info@lapiccolaitalia.cl" icon="📧" />
          <InputField label="Nombre remitente" value={fromName} onChange={setFromName} placeholder="La Piccola Italia" icon="👤" />
        </div>

        {/* Direct — Vanellix self-hosted */}
        {provider === 'direct' && (
          <>
            <div className="px-3 py-2.5 bg-blue-500/5 border border-blue-500/15 rounded-xl text-[11px] text-blue-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><FaServer size={10} /> Envío directo desde tu servidor</p>
              <p className="text-light-text-tertiary dark:text-dark-text-tertiary">Tu backend envía directo al servidor de correo del destinatario (MX lookup). Sin relay externo.</p>
              <p className="text-amber-400 text-[10px]">⚠️ Requiere registros DNS: SPF, DKIM, DMARC en tu dominio para que no caiga en spam.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Límite por hora" value={ratePerHour} onChange={v => setRatePerHour(parseInt(v) || 50)} type="number" icon="⏱"
                hint="Máx emails/hora (recomendado: 50)" />
              <InputField label="Límite por día" value={ratePerDay} onChange={v => setRatePerDay(parseInt(v) || 500)} type="number" icon="📊"
                hint="Máx emails/día (recomendado: 500)" />
            </div>
          </>
        )}

        {/* SMTP */}
        {provider === 'smtp' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><InputField label="Host SMTP" value={host} onChange={setHost} placeholder="smtp.zoho.com" icon="🖥" /></div>
              <InputField label="Puerto" value={port} onChange={v => setPort(parseInt(v) || 587)} type="number" placeholder="587" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Usuario" value={user} onChange={setUser} placeholder="usuario@dominio.com" />
              <div>
                <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">Contraseña</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={config?.password_masked || '••••••••'}
                    className="w-full px-3 pr-9 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" />
                  <button onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-2.5 text-light-text-tertiary hover:text-light-text-primary">
                    {showPass ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-light-text-secondary cursor-pointer">
                <input type="checkbox" checked={tls} onChange={e => { setTls(e.target.checked); if (e.target.checked) setSsl(false); }} className="rounded" /> STARTTLS
              </label>
              <label className="flex items-center gap-2 text-xs text-light-text-secondary cursor-pointer">
                <input type="checkbox" checked={ssl} onChange={e => { setSsl(e.target.checked); if (e.target.checked) setTls(false); }} className="rounded" /> SSL/TLS
              </label>
            </div>
          </>
        )}

        {/* Gmail */}
        {provider === 'gmail' && (
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Gmail / Google Workspace" value={user} onChange={setUser} placeholder="tu@gmail.com" icon="📬" />
            <div>
              <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">App Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={config?.password_masked || 'xxxx xxxx xxxx xxxx'}
                  className="w-full px-3 pr-9 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-2.5 text-light-text-tertiary"><FaEye size={12} /></button>
              </div>
              <p className="text-[9px] text-light-text-tertiary mt-1">Genera en myaccount.google.com/apppasswords</p>
            </div>
          </div>
        )}

        {/* AWS SES */}
        {provider === 'ses' && (
          <>
            <InputField label="Región AWS" value={sesRegion} onChange={setSesRegion} placeholder="us-east-1" icon="🌎" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="SMTP Username (Access Key)" value={sesAccessKey} onChange={setSesAccessKey} placeholder={config?.ses_access_key_masked || 'AKIA...'} />
              <div>
                <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">SMTP Password (Secret Key)</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={sesSecretKey} onChange={e => setSesSecretKey(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 pr-9 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" />
                  <button onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-2.5 text-light-text-tertiary"><FaEye size={12} /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={handleSave} disabled={saving || !fromEmail.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-matrix-green text-black rounded-xl hover:bg-matrix-green/80 disabled:opacity-50 transition-colors">
          {saving ? <FaSpinner className="animate-spin" size={11} /> : <FaSave size={11} />} {saving ? 'Guardando...' : 'Guardar'}
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@email.com"
            className="px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary w-48" />
          <button onClick={handleTest} disabled={testing || !testEmail.trim() || !config?.configured}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 disabled:opacity-50 transition-colors border border-blue-500/20">
            {testing ? <FaSpinner className="animate-spin" size={11} /> : <FaPaperPlane size={11} />} Enviar test
          </button>
        </div>

        {config?.configured && (
          <button onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <FaTrash size={10} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
};

export default MailSettings;
