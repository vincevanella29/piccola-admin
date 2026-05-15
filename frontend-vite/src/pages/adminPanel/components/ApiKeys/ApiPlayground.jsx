import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Terminal, KeyRound, AlertCircle } from 'lucide-react';
import api from '../../../../utils/api';

const ApiPlayground = ({ appState, endpoints, apiKeys }) => {
  const t = appState?.t || ((k) => k);

  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [queryParams, setQueryParams] = useState({});
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const ep = endpoints.find(e => e.slug === selectedEndpoint);

  const handleParamChange = (key, value) => {
    setQueryParams(prev => ({ ...prev, [key]: value }));
  };

  const executeRequest = async () => {
    if (!ep || !selectedKey) return;
    setLoading(true);
    setResponse(null);
    try {
      // Build query string
      const searchParams = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== '') searchParams.append(k, v);
      });
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

      const res = await api({
        method: 'GET',
        endpoint: `/data/${ep.slug}${qs}`,
        headers: {
          'X-API-Key': selectedKey
        }
      });
      setResponse({ status: 200, data: res });
    } catch (err) {
      setResponse({ status: 'Error', data: err.message || err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between border-b border-light-border/10 dark:border-white/10 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-md shadow-matrix-green/20">
            <Terminal size={20} className="text-white" />
          </div>
          {t('apikeys.playground') || 'API Playground'}
        </h2>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Col: Config */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-4 bg-light-surface/50 dark:bg-[#1c1c1e] p-6 rounded-3xl border border-light-border/10 dark:border-white/5 shadow-sm">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                <KeyRound size={16} className="text-vanellix-cyan" /> {t('apikeys.select_key') || 'Select API Key'}
              </label>
              <select
                value={selectedKey.split('.')[0]}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none transition-all shadow-sm"
              >
                <option value="">-- {t('apikeys.select_key') || 'Select API Key'} --</option>
                {apiKeys?.map(k => {
                  const id = k.id || k._id;
                  return (
                    <option key={id} value={id}>{k.name || id} (Note: you need the full secret)</option>
                  );
                })}
              </select>
              <div className="text-xs text-light-text-secondary/70 dark:text-gray-500 mt-1 pl-1">
                * In this playground you must paste your FULL api key (id.secret) if not auto-populated.
              </div>
              {selectedKey && !selectedKey.includes('.') && (
                <input
                   type="text"
                   placeholder="Paste your full API key (id.secret) here"
                   value={selectedKey}
                   onChange={e => setSelectedKey(e.target.value)}
                   className="mt-2 w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 shadow-sm"
                />
              )}
            </div>

            <div className="grid gap-2 pt-2 border-t border-light-border/10 dark:border-white/5">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                <Play size={16} className="text-vanellix-cyan" /> {t('apikeys.select_endpoint') || 'Select Endpoint'}
              </label>
              <select
                value={selectedEndpoint}
                onChange={(e) => {
                  setSelectedEndpoint(e.target.value);
                  setQueryParams({});
                }}
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none transition-all shadow-sm"
              >
                <option value="">-- {t('apikeys.select_endpoint') || 'Select Endpoint'} --</option>
                {endpoints.map(e => (
                  <option key={e.slug} value={e.slug}>{e.name} (/api/v1/data/{e.slug})</option>
                ))}
              </select>
            </div>
          </div>

          {ep && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-6 rounded-3xl border border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e] shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-light-text-secondary dark:text-gray-400">Query Parameters</h3>
              
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-sm font-mono text-light-text-secondary dark:text-gray-300 col-span-1">page</span>
                  <input type="number" placeholder="1" onChange={e => handleParamChange('page', e.target.value)} className="col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50" />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-sm font-mono text-light-text-secondary dark:text-gray-300 col-span-1">page_size</span>
                  <input type="number" placeholder="50" onChange={e => handleParamChange('page_size', e.target.value)} className="col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50" />
                </div>

                {ep.allowed_filters?.map(f => (
                  <div key={f} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm font-mono text-light-text-secondary dark:text-gray-300 col-span-1 truncate" title={f}>{f}</span>
                    <input type="text" placeholder={`Filter by ${f}`} onChange={e => handleParamChange(f, e.target.value)} className="col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="flex gap-3">
            <button
              onClick={executeRequest}
              disabled={!ep || !selectedKey || loading}
              className="flex-1 px-4 py-4 rounded-2xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none font-bold text-base"
            >
              {loading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <Play size={20} fill="currentColor" />}
              {t('apikeys.execute') || 'Execute Request'}
            </button>
            {ep && (
              <a
                href={`${window.env?.VITE_API_URL || import.meta.env.VITE_API_URL || 'https://api.vanellix.com'}/api/v1/data/${ep.slug}/download/zip`}
                className="px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-light-text-primary dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-center font-semibold text-sm whitespace-nowrap"
                download
              >
                {t('apikeys.download_zip') || 'Download ZIP'}
              </a>
            )}
          </div>
        </div>

        {/* Right Col: macOS Terminal Response */}
        <div className="lg:col-span-7 flex flex-col h-[600px] lg:h-auto min-h-[500px] border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden bg-white dark:bg-[#0c0c0c] shadow-2xl">
          {/* macOS Titlebar */}
          <div className="flex items-center px-4 py-3 bg-gray-100 dark:bg-[#1a1a1a] border-b border-black/5 dark:border-white/5">
            <div className="flex gap-2 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-inner"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-inner"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-inner"></div>
            </div>
            <div className="flex-1 flex justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 font-sans tracking-wide">
              API Console — {ep ? ep.slug : 'Idle'}
            </div>
            <div className="w-16 flex justify-end">
              {response && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${response.status === 200 ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>Status: {response.status}</span>}
            </div>
          </div>
          
          <div className="flex-1 p-5 overflow-auto font-mono text-[13px] leading-relaxed bg-[#fafafa] dark:bg-transparent text-gray-800 dark:text-gray-300">
            {loading ? (
              <div className="animate-pulse flex gap-2 h-full p-4"><div className="h-3 w-3 bg-vanellix-cyan rounded-full"></div><div className="h-3 w-3 bg-vanellix-cyan/70 rounded-full"></div><div className="h-3 w-3 bg-vanellix-cyan/40 rounded-full"></div></div>
            ) : response ? (
              <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(response.data, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 flex-col gap-3">
                <Terminal size={32} strokeWidth={1} />
                <span className="font-sans text-sm font-medium">Select an endpoint and execute to see results.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPlayground;
