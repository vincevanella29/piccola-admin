// src/pages/whatsapp/settings/WhatsAppSettings.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Shield, CheckCircle2, XCircle, Eye, EyeOff, Copy, Check,
  Key, Server, Globe, Zap, MessageSquare, Save, Plus, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { toast } from 'react-toastify';

const WhatsAppSettings = ({ wa, appState }) => {
  const [form, setForm] = useState({
    access_token: '',
    phone_number_id: '',
    waba_id: '',
    webhook_verify_token: 'vanellix_whatsapp_verify',
    auto_reply: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);
  
  // Quick replies state
  const [qrList, setQrList] = useState([]);
  const [savingQr, setSavingQr] = useState(false);

  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;

  useEffect(() => {
    if (token) wa.fetchConfig();
  }, [token, wa.fetchConfig]);

  useEffect(() => {
    if (wa.config) {
      setForm(prev => ({
        ...prev,
        phone_number_id: wa.config.phone_number_id || '',
        waba_id: wa.config.waba_id || '',
        webhook_verify_token: wa.config.webhook_verify_token || 'vanellix_whatsapp_verify',
        auto_reply: wa.config.auto_reply || false,
      }));
      setQrList(wa.config.quick_replies || []);
    }
  }, [wa.config]);

  const handleSave = async () => {
    if (!form.access_token && !wa.config?.configured) {
      toast.error('Access Token es requerido');
      return;
    }
    if (!form.phone_number_id) {
      toast.error('Phone Number ID es requerido');
      return;
    }
    setSaving(true);
    try {
      const data = { ...form };
      if (!data.access_token && wa.config?.configured) {
        // Don't send empty token if already configured
        delete data.access_token;
      }
      await wa.saveConfig(data);
      toast.success('✅ Configuración WhatsApp guardada');
    } catch (e) {
      toast.error('Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuickReplies = async () => {
    setSavingQr(true);
    try {
      await wa.saveQuickReplies({ quick_replies: qrList });
      toast.success('✅ Quick Replies guardados');
    } catch (e) {
      toast.error('Error guardando quick replies');
    } finally {
      setSavingQr(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/whatsapp/webhook`
    : 'https://company.lapiccolaitalia.cl/api/whatsapp/webhook';

  return (
    <div className="space-y-6">
      {/* ─── Config Card ─── */}
      <div className="rounded-3xl border border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e] shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-green-500/10">
            <MessageSquare size={22} className="text-green-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-light-text-primary dark:text-white">Credenciales de Meta Cloud API</h3>
            <p className="text-xs text-light-text-secondary dark:text-gray-400">Configura tu conexión con WhatsApp Business Platform</p>
          </div>
          {wa.config?.configured && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">
              <CheckCircle2 size={14} /> Conectado
            </div>
          )}
        </div>

        {/* Access Token */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-light-text-primary dark:text-white flex items-center gap-2">
            <Key size={14} className="text-vanellix-cyan" /> Access Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.access_token}
              onChange={e => setForm(prev => ({ ...prev, access_token: e.target.value }))}
              placeholder={wa.config?.configured ? wa.config.access_token_masked : 'EAADTzGt2SZC0BR...'}
              className="w-full px-4 py-3 pr-20 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 text-sm text-light-text-primary dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-gray-400 hover:text-vanellix-cyan">
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Phone Number ID + WABA ID */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-light-text-primary dark:text-white flex items-center gap-2">
              <Server size={14} className="text-vanellix-cyan" /> Phone Number ID
            </label>
            <input
              type="text"
              value={form.phone_number_id}
              onChange={e => setForm(prev => ({ ...prev, phone_number_id: e.target.value }))}
              placeholder="104467182731767"
              className="w-full px-4 py-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 text-sm text-light-text-primary dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-light-text-primary dark:text-white flex items-center gap-2">
              <Shield size={14} className="text-vanellix-cyan" /> WABA ID
            </label>
            <input
              type="text"
              value={form.waba_id}
              onChange={e => setForm(prev => ({ ...prev, waba_id: e.target.value }))}
              placeholder="107752419063717"
              className="w-full px-4 py-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 text-sm text-light-text-primary dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-light-text-primary dark:text-white flex items-center gap-2">
            <Globe size={14} className="text-vanellix-cyan" /> Webhook URL
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 font-bold">Auto-generada</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-2xl bg-green-500/5 border border-green-500/10 text-sm font-mono text-light-text-primary dark:text-white truncate">
              {webhookUrl}
            </div>
            <button onClick={() => copyToClipboard(webhookUrl, 'webhook')} className="p-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 hover:bg-vanellix-cyan/10 transition-all">
              {copied === 'webhook' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-light-text-secondary" />}
            </button>
          </div>
        </div>

        {/* Verify Token */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-light-text-primary dark:text-white flex items-center gap-2">
            <Key size={14} className="text-vanellix-cyan" /> Verify Token
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 font-bold">Para webhook</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.webhook_verify_token}
              onChange={e => setForm(prev => ({ ...prev, webhook_verify_token: e.target.value }))}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 text-sm text-light-text-primary dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
            <button onClick={() => copyToClipboard(form.webhook_verify_token, 'verify')} className="p-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 hover:bg-vanellix-cyan/10 transition-all">
              {copied === 'verify' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-light-text-secondary" />}
            </button>
          </div>
        </div>

        {/* Auto Reply Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Zap size={18} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-light-text-primary dark:text-white">La Nonna Auto-Reply</p>
              <p className="text-xs text-light-text-secondary dark:text-gray-400">Responde automáticamente con IA a mensajes entrantes</p>
            </div>
          </div>
          <button onClick={() => setForm(prev => ({ ...prev, auto_reply: !prev.auto_reply }))} className="transition-all">
            {form.auto_reply
              ? <ToggleRight size={32} className="text-green-500" />
              : <ToggleLeft size={32} className="text-gray-400" />
            }
          </button>
        </div>

        {/* Save Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3.5 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2 font-bold text-base disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar Configuración WhatsApp'}
        </motion.button>
      </div>

      {/* ─── Quick Replies Card ─── */}
      <div className="rounded-3xl border border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e] shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10">
              <MessageSquare size={22} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-light-text-primary dark:text-white">Quick Replies</h3>
              <p className="text-xs text-light-text-secondary dark:text-gray-400">Respuestas automáticas por palabras clave</p>
            </div>
          </div>
          <button
            onClick={() => setQrList(prev => [...prev, { trigger: '', response: '', active: true }])}
            className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all"
          >
            <Plus size={18} />
          </button>
        </div>

        {qrList.length === 0 ? (
          <p className="text-sm text-center text-light-text-secondary dark:text-gray-400 py-6 italic">No hay quick replies configurados. Presiona + para agregar uno.</p>
        ) : (
          <div className="space-y-3">
            {qrList.map((qr, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-light-text-secondary dark:text-gray-400 uppercase tracking-wider">Reply #{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const n = [...qrList]; n[i].active = !n[i].active; setQrList(n); }}>
                      {qr.active ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-gray-400" />}
                    </button>
                    <button onClick={() => setQrList(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={qr.trigger}
                  onChange={e => { const n = [...qrList]; n[i].trigger = e.target.value; setQrList(n); }}
                  placeholder="Palabra clave (ej: horario, menu, delivery)"
                  className="w-full px-3 py-2 rounded-xl bg-white/50 dark:bg-black/30 border border-light-border/10 dark:border-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-light-text-primary dark:text-white"
                />
                <textarea
                  value={qr.response}
                  onChange={e => { const n = [...qrList]; n[i].response = e.target.value; setQrList(n); }}
                  placeholder="Respuesta automática..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white/50 dark:bg-black/30 border border-light-border/10 dark:border-white/5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-light-text-primary dark:text-white"
                />
              </div>
            ))}
          </div>
        )}

        {qrList.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveQuickReplies}
            disabled={savingQr}
            className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-50"
          >
            <Save size={16} />
            {savingQr ? 'Guardando...' : 'Guardar Quick Replies'}
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppSettings;
