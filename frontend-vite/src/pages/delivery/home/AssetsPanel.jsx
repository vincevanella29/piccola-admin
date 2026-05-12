// src/pages/delivery/home/AssetsPanel.jsx
// Panel for managing template assets
import React from 'react';
import { FaSpinner, FaCloudUploadAlt, FaBox } from 'react-icons/fa';

const AssetsPanel = ({ templates = [], uploadingTemplates, onUploadAll, apiBaseUrl }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
        Assets ({templates.length})
      </h2>
      <button onClick={onUploadAll} disabled={uploadingTemplates}
        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-1 shadow-sm">
        {uploadingTemplates ? <FaSpinner size={7} className="animate-spin" /> : <FaCloudUploadAlt size={8} />}
        Subir a R2
      </button>
    </div>
    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
      Templates bundled con el admin. Súbelos a R2 para usarlos en banners y promos.
    </p>
    <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide pr-1">
      {templates.map((tpl) => (
        <div key={tpl.filename}
          className="rounded-xl overflow-hidden bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
          <img
            src={`${apiBaseUrl}${tpl.preview_url}`}
            alt={tpl.filename}
            className="w-full h-20 object-cover"
          />
          <div className="p-1.5">
            <p className="text-[8px] font-mono text-light-text-secondary dark:text-dark-text-secondary truncate">{tpl.filename}</p>
          </div>
        </div>
      ))}
    </div>
    {templates.length === 0 && (
      <div className="text-center py-8 border border-dashed border-matrix-green/20 rounded-2xl">
        <FaBox className="mx-auto text-matrix-green/30 mb-2" size={24} />
        <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Sin templates</p>
      </div>
    )}
  </div>
);

export default AssetsPanel;
