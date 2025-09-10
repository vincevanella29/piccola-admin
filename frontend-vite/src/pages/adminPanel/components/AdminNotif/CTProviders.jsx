import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const emptyForm = {
  service: '',
  name: '',
  is_active: true,
  credentials: {},
};

const CTProviders = ({
  loading, error,
  providers,
  onRefresh, onCreate, onUpdate,
  token, account,
  listServices: listServicesFn,
  getServiceRules: getServiceRulesFn,
  uploadCredentialsJson: uploadCredentialsJsonFn,
}) => {
  const { t } = useTranslation();
  const extractApiError = (err) => {
    try {
      const data = err?.response?.data;
      if (typeof data === 'string') return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data?.detail?.errors)) {
          return data.detail.errors.join('\n');
        }
        return data.detail || data.message || data.error || JSON.stringify(data);
      }
      return err?.message || String(err);
    } catch (_) {
      return err?.message || String(err);
    }
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [serviceAccountFile, setServiceAccountFile] = useState(null);
  const [services, setServices] = useState([]);
  const [rules, setRules] = useState(null);
  const [originalCreds, setOriginalCreds] = useState(null);

  useEffect(() => { onRefresh && onRefresh(); }, [onRefresh]);

  // Load available services for selector
  useEffect(() => {
    const load = async () => {
      try {
        const res = await (listServicesFn ? listServicesFn() : Promise.resolve([]));
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        setServices(list);
      } catch (e) {
        console.error('Failed to load services', e);
      }
    };
    load();
  }, [token, account]);

  // Load rules when service changes
  useEffect(() => {
    const s = form.service;
    if (!s) { setRules(null); return; }
    const load = async () => {
      try {
        const r = await (getServiceRulesFn ? getServiceRulesFn(s) : Promise.resolve(null));
        setRules(r);
        // Initialize credentials with defaults/public keys if provided
        const defaults = r?.defaults || {};
        setForm(prev => ({ ...prev, credentials: { ...(defaults.credentials || {}), ...(prev.credentials || {}) } }));
      } catch (e) {
        console.error('Failed to load service rules', e);
        setRules(null);
      }
    };
    load();
    // reset file on service change
    setServiceAccountFile(null);
  }, [form.service, token, account]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    setServiceAccountFile(file);
  };

  const handleCredChange = (key) => (e) => {
    const { value } = e.target;
    setForm(prev => ({ ...prev, credentials: { ...(prev.credentials || {}), [key]: value } }));
  };

  const setNested = (obj, dotted, value) => {
    const parts = String(dotted).split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  };

  const flatten = (obj, prefix = '', out = {}) => {
    if (!obj || typeof obj !== 'object') return out;
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = v;
    });
    return out;
  };

  const buildCredentials = async () => {
    // Start from current flat credentials
    const out = {};
    Object.entries(form.credentials || {}).forEach(([k, v]) => {
      if (k.includes('.')) setNested(out, k, v);
      else out[k] = v;
    });
    // If a service account file is present and supported, read and include it
    const fileKeys = rules?.file_keys || [];
    if (serviceAccountFile && fileKeys.includes('service_account')) {
      try {
        const text = await serviceAccountFile.text();
        const json = JSON.parse(text);
        out.service_account = json;
      } catch (e) {
        throw new Error(t('conversion_tracker.errors.credentials_invalid'));
      }
    }
    // Preserve existing service_account on edit if no new file was provided
    if (editingId && !out.service_account && originalCreds?.service_account) {
      out.service_account = originalCreds.service_account;
    }
    // Service-specific normalizations
    if (form.service === 'firebase' && out.service_account) {
      // Map project_id from service account to projectId if not already set
      if (!out.projectId) {
        out.projectId = out.service_account.projectId || out.service_account.project_id;
      }
    }
    return out;
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const creds = await buildCredentials();
      const body = {
        service: form.service,
        name: form.name || undefined,
        is_active: !!form.is_active,
        credentials: creds,
      };
      let providerId = editingId || null;
      if (editingId) {
        const updated = await onUpdate(editingId, body);
        providerId = editingId;
      } else {
        const created = await onCreate(body);
        // Prefer returned id; fallback to later refresh
        providerId = created?.id || providerId;
      }

      // If service has file_keys and a JSON file is provided, upload it immediately
      const fileKeys = rules?.file_keys || [];
      // If we already inlined JSON in credentials, we can skip upload; keep upload for cases where backend needs it separately
      if (serviceAccountFile && fileKeys.includes('service_account') && !creds.service_account) {
        if (!providerId) {
          // Try to find provider by service/name after refresh if id not returned
          await (onRefresh && onRefresh());
          const found = (providers || []).find(p => p.service === form.service && p.name === form.name);
          providerId = found?.id || providerId;
        }
        if (!providerId) throw new Error(t('conversion_tracker.errors.provider_id_missing'));
        await (uploadCredentialsJsonFn && uploadCredentialsJsonFn({ providerId, file: serviceAccountFile, key: 'service_account' }));
      }

      setForm(emptyForm);
      setEditingId(null);
      setServiceAccountFile(null);
      onRefresh && onRefresh();
    } catch (err) {
      const msg = extractApiError(err);
      console.error('Invalid credentials JSON or API error', msg);
      alert(msg || t('conversion_tracker.errors.credentials_invalid'));
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setOriginalCreds(p.credentials || {});
    const flatCreds = flatten(p.credentials || {});
    setForm({
      service: p.service || '',
      name: p.name || '',
      is_active: !!p.is_active,
      credentials: flatCreds,
    });
    setServiceAccountFile(null);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setOriginalCreds(null); };

  // Compute visible required fields (hide service_account.* when file upload is available)
  const visibleRequiredKeys = useMemo(() => {
    const all = rules?.required || [];
    const hasServiceAccountFile = (rules?.file_keys || []).includes('service_account');
    if (!hasServiceAccountFile) return all;
    return all.filter(k => !String(k).startsWith('service_account.'));
  }, [rules]);

  return (
    <div className="space-y-8">
      {/* Error banner */}
      <AnimatePresence>
        {!!error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={18} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base whitespace-pre-line">{String(error)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <div className="rounded-2xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/30 dark:border-dark-border/30 p-4 sm:p-6">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{t('conversion_tracker.form.service.label')}</label>
            <select
              name="service"
              value={form.service}
              onChange={handleChange}
              className="w-full rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 px-3 py-2 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              required
            >
              <option value="" disabled>{t('conversion_tracker.form.service.placeholder')}</option>
              {services.map((s) => {
                const val = typeof s === 'string' ? s : (s?.service || s?.key || '');
                const label = typeof s === 'string' ? s : (s?.label || s?.service || val);
                return (
                  <option key={val} value={val}>{label}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{t('conversion_tracker.form.name.label')}</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={t('conversion_tracker.form.name.placeholder')}
              className="w-full rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 px-3 py-2 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="is_active" type="checkbox" name="is_active" checked={!!form.is_active} onChange={handleChange} />
            <label htmlFor="is_active" className="text-sm font-medium">{t('conversion_tracker.form.active.label')}</label>
          </div>
          {rules && (
            <>
              {visibleRequiredKeys.map((key) => (
                <div key={key} className="sm:col-span-1">
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{rules?.labels?.[key] || rules?.field_labels?.[key] || key}</label>
                  <input
                    name={`cred_${key}`}
                    value={form.credentials?.[key] || ''}
                    onChange={handleCredChange(key)}
                    placeholder={t('conversion_tracker.form.required_placeholder', { field: (rules?.labels?.[key] || rules?.field_labels?.[key] || key) })}
                    className="w-full rounded-xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 px-3 py-2 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                    required
                  />
                </div>
              ))}
              {(rules.file_keys || []).includes('service_account') && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{t('conversion_tracker.form.file.service_account.label')}</label>
                  <input type="file" accept="application/json" onChange={handleFile} className="w-full" />
                  {Boolean(form.credentials?.service_account_path || originalCreds?.service_account_path) && (
                    <p className="text-xs opacity-70 mt-1">
                      Current: <span className="font-mono break-all">{form.credentials?.service_account_path || originalCreds?.service_account_path}</span>
                    </p>
                  )}
                  <p className="text-xs opacity-70 mt-1">{t('conversion_tracker.form.file.service_account.help')} — leaving empty keeps the existing JSON.</p>
                </div>
              )}
            </>
          )}
          <div className="sm:col-span-2 flex gap-3">
            <motion.button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold shadow-neon disabled:opacity-60"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {editingId ? t('conversion_tracker.actions.update') : t('conversion_tracker.actions.create')}
            </motion.button>
            {editingId && (
              <motion.button type="button" onClick={cancelEdit} className="px-5 py-2.5 rounded-xl border" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {t('conversion_tracker.actions.cancel')}
              </motion.button>
            )}
          </div>
        </form>
      </div>

      {/* Providers list */}
      <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60">
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">{t('conversion_tracker.list.title')}</h3>
          <motion.button
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/40 dark:border-dark-border/40 text-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            {t('notifications.update_types')}
          </motion.button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40">
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.id')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.service')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.name')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.active')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.created')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.updated')}</th>
                <th className="py-3 px-4 text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm whitespace-nowrap">{t('conversion_tracker.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(providers || []).filter(Boolean).map((p, idx) => (
                <tr key={p.id || `prov-${idx}`} className="border-t border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40">
                  <td className="py-3 px-4 font-mono text-[11px] sm:text-xs">{p.id || '-'}</td>
                  <td className="py-3 px-4">{p.service || '-'}</td>
                  <td className="py-3 px-4">{p.name || '-'}</td>
                  <td className="py-3 px-4">{p.is_active ? t('conversion_tracker.status.yes') : t('conversion_tracker.status.no')}</td>
                  <td className="py-3 px-4">{p.created_at || '-'}</td>
                  <td className="py-3 px-4">{p.updated_at || '-'}</td>
                  <td className="py-3 px-4">
                    <motion.button className="text-xs underline" onClick={() => startEdit(p)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                      {t('conversion_tracker.table.edit')}
                    </motion.button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CTProviders;
