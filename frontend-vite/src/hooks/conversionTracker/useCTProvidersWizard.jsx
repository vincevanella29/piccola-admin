import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const emptyForm = {
  service: '',
  name: '',
  is_active: true,
  assigned_providers: '',
  analytics_settings: {
    ga4_property_id: '',
    enable_local_backup: false,
  },
  credentials: {},
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

export const useCTProvidersWizard = ({
  providers,
  onRefresh,
  onCreate,
  onUpdate,
  token,
  account,
  listServicesFn,
  getServiceRulesFn,
  uploadCredentialsJsonFn,
}) => {
  const { t } = useTranslation();

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const [serviceAccountFile, setServiceAccountFile] = useState(null);
  const [services, setServices] = useState([]);
  const [rules, setRules] = useState(null);
  const [originalCreds, setOriginalCreds] = useState(null);

  // Load available services
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
  }, [token, account, listServicesFn]);

  // Load rules when service changes
  useEffect(() => {
    const s = form.service;
    if (!s) { setRules(null); return; }
    const load = async () => {
      try {
        const r = await (getServiceRulesFn ? getServiceRulesFn(s) : Promise.resolve(null));
        setRules(r);
        const defaults = r?.defaults || {};
        setForm(prev => ({ ...prev, credentials: { ...(defaults.credentials || {}), ...(prev.credentials || {}) } }));
      } catch (e) {
        console.error('Failed to load service rules', e);
        setRules(null);
      }
    };
    load();
    setServiceAccountFile(null);
  }, [form.service, token, account, getServiceRulesFn]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0] || null;
    setServiceAccountFile(file);
  }, []);

  const handleCredChange = useCallback((key) => (e) => {
    const { value } = e.target;
    setForm(prev => ({ ...prev, credentials: { ...(prev.credentials || {}), [key]: value } }));
  }, []);

  const handleAnalyticsChange = useCallback((key) => (e) => {
    const { value, type, checked } = e.target;
    setForm(prev => ({ 
      ...prev, 
      analytics_settings: { ...(prev.analytics_settings || {}), [key]: type === 'checkbox' ? checked : value } 
    }));
  }, []);

  const buildCredentials = async () => {
    const out = {};
    Object.entries(form.credentials || {}).forEach(([k, v]) => {
      if (k.includes('.')) setNested(out, k, v);
      else out[k] = v;
    });
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
    if (editingId && !out.service_account && originalCreds?.service_account) {
      out.service_account = originalCreds.service_account;
    }
    if (form.service === 'firebase' && out.service_account) {
      if (!out.projectId) out.projectId = out.service_account.projectId || out.service_account.project_id;
    }
    return out;
  };

  const extractApiError = (err) => {
    try {
      const data = err?.response?.data;
      if (typeof data === 'string') return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data?.detail?.errors)) return data.detail.errors.join('\n');
        if (Array.isArray(data?.detail)) return JSON.stringify(data.detail);
        return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
      }
      return err?.message || String(err);
    } catch (_) {
      return err?.message || String(err);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const creds = await buildCredentials();
      const body = {
        service: form.service,
        name: form.name || undefined,
        is_active: !!form.is_active,
        assigned_providers: (form.assigned_providers || '').split(',').map(s => s.trim()).filter(Boolean),
        analytics_settings: form.analytics_settings,
        credentials: creds,
      };
      
      let providerId = editingId || null;
      if (editingId) {
        await onUpdate(editingId, body);
        providerId = editingId;
      } else {
        const created = await onCreate(body);
        providerId = created?.id || providerId;
      }

      const fileKeys = rules?.file_keys || [];
      if (serviceAccountFile && fileKeys.includes('service_account')) {
        if (!providerId) {
          await (onRefresh && onRefresh());
          const found = (providers || []).find(p => p.service === form.service && p.name === form.name);
          providerId = found?.id || providerId;
        }
        if (!providerId) throw new Error(t('conversion_tracker.errors.provider_id_missing'));
        await (uploadCredentialsJsonFn && uploadCredentialsJsonFn({ providerId, file: serviceAccountFile, key: 'service_account' }));
      }

      closeWizard();
      onRefresh && onRefresh();
    } catch (err) {
      const msg = extractApiError(err);
      console.error('Invalid credentials JSON or API error', msg);
      alert(msg || t('conversion_tracker.errors.credentials_invalid'));
    }
  };

  const startEdit = useCallback((p) => {
    setEditingId(p.id);
    setOriginalCreds(p.credentials || {});
    const flatCreds = flatten(p.credentials || {});
    setForm({
      service: p.service || '',
      name: p.name || '',
      is_active: !!p.is_active,
      assigned_providers: (p.assigned_providers || []).join(', '),
      analytics_settings: p.analytics_settings || emptyForm.analytics_settings,
      credentials: flatCreds,
    });
    setServiceAccountFile(null);
    setWizardStep(2); // Skip selection if editing
    setIsWizardOpen(true);
  }, []);

  const startCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setOriginalCreds(null);
    setServiceAccountFile(null);
    setWizardStep(1);
    setIsWizardOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false);
    setTimeout(() => {
      setEditingId(null);
      setForm(emptyForm);
    }, 300);
  }, []);

  const handleNext = useCallback(() => {
    if (wizardStep === 1 && !form.service) return;
    setWizardStep(prev => prev + 1);
  }, [wizardStep, form.service]);

  const handleBack = useCallback(() => setWizardStep(prev => prev - 1), []);

  const visibleRequiredKeys = useMemo(() => {
    const all = rules?.required || [];
    const hasServiceAccountFile = (rules?.file_keys || []).includes('service_account');
    if (!hasServiceAccountFile) return all;
    return all.filter(k => !String(k).startsWith('service_account.'));
  }, [rules]);

  return {
    form,
    setForm,
    services,
    rules,
    serviceAccountFile,
    originalCreds,
    isWizardOpen,
    wizardStep,
    visibleRequiredKeys,
    editingId,
    handlers: {
      handleChange,
      handleAnalyticsChange,
      handleCredChange,
      handleFile,
      submit,
      startCreate,
      startEdit,
      closeWizard,
      handleNext,
      handleBack,
    }
  };
};
