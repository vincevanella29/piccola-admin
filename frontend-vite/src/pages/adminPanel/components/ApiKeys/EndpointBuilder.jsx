import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, ArrowLeft, Database, Search } from 'lucide-react';

const EndpointBuilder = ({ appState, isLoading, collections, onSave, onCancel, initialData }) => {
  const t = appState?.t || ((k) => k);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    collection_name: '',
    fields: [],
    allowed_filters: [],
    sort_by: '',
    sort_order: 1,
    max_page_size: 500,
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (group, value) => {
    setFormData((prev) => {
      const current = prev[group];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [group]: updated };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(formData);
  };

  const selectedCollection = collections.find((c) => c.name === formData.collection_name);

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-light-border/10 dark:border-white/10">
        <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-md shadow-matrix-green/20">
            <Settings size={20} className="text-white" />
          </div>
          {initialData ? t('apikeys.edit_endpoint') || 'Edit Endpoint' : t('apikeys.create_endpoint') || 'Create Endpoint'}
        </h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold rounded-full bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <ArrowLeft size={16} /> {t('common.cancel') || 'Cancel'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8">
        <div className="grid gap-6 sm:grid-cols-2 p-6 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.ep_name') || 'Endpoint Name'}</label>
            <input
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Menu Export"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.ep_slug') || 'Slug (URL Path)'}</label>
            <div className="flex items-stretch shadow-sm rounded-2xl overflow-hidden border border-light-border/20 dark:border-white/10 focus-within:ring-2 focus-within:ring-vanellix-cyan/50 transition-all">
              <span className="flex items-center px-4 bg-gray-100 dark:bg-white/5 text-light-text-secondary dark:text-gray-400 text-sm font-mono border-r border-light-border/20 dark:border-white/10">
                /api/v1/data/
              </span>
              <input
                required
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="menu-export"
                className="w-full px-4 py-3 bg-white dark:bg-black/20 text-light-text-primary dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:col-span-2 pt-4 border-t border-light-border/10 dark:border-white/5">
            <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
              <Database size={16} className="text-vanellix-cyan" /> {t('apikeys.ep_collection') || 'Data Source (Collection)'}
            </label>
            <select
              required
              name="collection_name"
              value={formData.collection_name}
              onChange={(e) => {
                handleChange(e);
                setFormData((prev) => ({ ...prev, fields: [], allowed_filters: [] }));
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none transition-all shadow-sm"
            >
              <option value="">{t('apikeys.ep_select_col') || 'Select a collection...'}</option>
              {collections.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.estimated_docs || 0} docs) - {c.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCollection && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-8 p-6 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm">
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center justify-between">
                <span>{t('apikeys.ep_fields') || 'Select Fields to Expose'}</span>
                <span className="text-xs font-normal opacity-70 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">{formData.fields.length} selected</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedCollection.fields.map((field) => {
                  const isChecked = formData.fields.includes(field);
                  return (
                    <label key={field} className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all border ${isChecked ? 'bg-vanellix-cyan/10 border-vanellix-cyan/30 text-vanellix-cyan' : 'bg-white dark:bg-black/20 border-light-border/20 dark:border-white/10 text-light-text-secondary dark:text-gray-400 hover:border-vanellix-cyan/50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange('fields', field)}
                        className="hidden"
                      />
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-vanellix-cyan bg-vanellix-cyan' : 'border-gray-400'}`}>
                        {isChecked && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <span className="text-sm font-medium">{field}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 pt-6 border-t border-light-border/10 dark:border-white/5">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-2"><Search size={16} className="text-matrix-green" /> {t('apikeys.ep_filters') || 'Allowed Query Filters'}</span>
                <span className="text-xs font-normal opacity-70 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">{formData.allowed_filters.length} selected</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedCollection.fields.map((field) => {
                  const isChecked = formData.allowed_filters.includes(field);
                  return (
                    <label key={`filter_${field}`} className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all border ${isChecked ? 'bg-matrix-green/10 border-matrix-green/30 text-matrix-green' : 'bg-white dark:bg-black/20 border-light-border/20 dark:border-white/10 text-light-text-secondary dark:text-gray-400 hover:border-matrix-green/50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange('allowed_filters', field)}
                        className="hidden"
                      />
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isChecked ? 'border-matrix-green bg-matrix-green' : 'border-gray-400'}`}>
                        {isChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-sm font-medium">{field}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3 pt-6 border-t border-light-border/10 dark:border-white/5">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.ep_sortby') || 'Default Sort By'}</label>
                <select
                  name="sort_by"
                  value={formData.sort_by}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none shadow-sm"
                >
                  <option value="">{t('common.none') || 'None'}</option>
                  {selectedCollection.fields.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.ep_sortorder') || 'Sort Order'}</label>
                <select
                  name="sort_order"
                  value={formData.sort_order}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none shadow-sm"
                >
                  <option value={1}>{t('apikeys.sort_asc') || 'Ascending (1)'}</option>
                  <option value={-1}>{t('apikeys.sort_desc') || 'Descending (-1)'}</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.ep_max_page') || 'Max Page Size'}</label>
                <input
                  type="number"
                  name="max_page_size"
                  value={formData.max_page_size}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_page_size: Number(e.target.value) }))}
                  max={1000}
                  min={1}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 shadow-sm"
                />
              </div>
            </div>

            {selectedCollection.estimated_docs > 10000 && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-sm font-medium flex gap-3 items-start mt-4">
                <span className="text-xl">⚠️</span>
                <span>{t('apikeys.large_dataset_warning') || 'This collection is very large. Queries without tight filters will be directed to batch mode.'}</span>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex gap-4 justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading || !formData.name || !formData.slug || !formData.collection_name}
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none font-bold text-base"
          >
            <Save size={18} /> {t('common.save') || 'Save Endpoint'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EndpointBuilder;
