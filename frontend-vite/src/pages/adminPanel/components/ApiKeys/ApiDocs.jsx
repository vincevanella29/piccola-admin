import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code, Shield, Layers } from 'lucide-react';

const ApiDocs = ({ appState, endpoints }) => {
  const t = appState?.t || ((k) => k);

  const getBaseUrl = () => {
    let url = window.env?.VITE_API_URL || import.meta.env.VITE_API_URL || 'https://api.vanellix.com';
    return url;
  };

  const sampleEndpoint = endpoints[0]?.slug || 'your-endpoint-slug';

  return (
    <div className="space-y-12 max-w-4xl mx-auto px-4 sm:px-8 py-6 font-sans">
      <div className="flex flex-col gap-4 border-b border-light-border/10 dark:border-white/10 pb-8">
        <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-lg shadow-matrix-green/20">
          <BookOpen size={24} className="text-white" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-light-text-primary dark:text-white">
          {t('apikeys.docs_title') || 'API Connection Guide'}
        </h2>
        <p className="text-lg text-light-text-secondary dark:text-gray-400">
          Learn how to authenticate and query data from your dynamic endpoints securely.
        </p>
      </div>

      {/* Authentication */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 dark:text-white">
          <Shield size={20} className="text-matrix-green" /> Authentication
        </h3>
        <p className="text-base text-light-text-secondary dark:text-gray-300 leading-relaxed">
          All API requests must include your API Key in the <code className="bg-light-surface dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-sm border dark:border-white/10">X-API-Key</code> HTTP header.
          Your API key consists of an ID and a Secret, separated by a dot (e.g. <code className="font-mono text-sm">id.secret</code>).
        </p>
        <div className="p-5 bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl border border-light-border/20 dark:border-white/5 overflow-x-auto shadow-sm">
          <pre className="text-sm text-gray-800 dark:text-gray-300 font-mono">
            {`X-API-Key: YOUR_API_KEY_HERE`}
          </pre>
        </div>
      </section>

      {/* Request Format */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 dark:text-white">
          <Layers size={20} className="text-matrix-green" /> Querying Endpoints
        </h3>
        <p className="text-base text-light-text-secondary dark:text-gray-300 leading-relaxed">
          Once you have created an endpoint in the <strong>Endpoints</strong> tab, you can query data from it.
          The base URL is <code className="font-mono text-sm dark:text-vanellix-cyan">{getBaseUrl()}</code>.
        </p>
        <div className="bg-light-surface/50 dark:bg-white/5 border border-light-border/10 dark:border-white/10 rounded-2xl p-6 space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-light-text-secondary dark:text-gray-400">Query Parameters</h4>
          <ul className="space-y-3">
            <li className="flex flex-col sm:flex-row sm:items-baseline gap-2">
              <code className="bg-light-surface dark:bg-white/10 px-2 py-1 rounded font-mono text-sm font-semibold w-fit">page</code>
              <span className="text-light-text-secondary dark:text-gray-300 text-sm">Page number (default: 1)</span>
            </li>
            <li className="flex flex-col sm:flex-row sm:items-baseline gap-2">
              <code className="bg-light-surface dark:bg-white/10 px-2 py-1 rounded font-mono text-sm font-semibold w-fit">page_size</code>
              <span className="text-light-text-secondary dark:text-gray-300 text-sm">Results per page (default: 50)</span>
            </li>
            <li className="flex flex-col sm:flex-row sm:items-baseline gap-2">
              <code className="bg-light-surface dark:bg-white/10 px-2 py-1 rounded font-mono text-sm font-semibold w-fit">[filter_name]</code>
              <span className="text-light-text-secondary dark:text-gray-300 text-sm">Filter by allowed fields configured in your endpoint</span>
            </li>
            <li className="flex flex-col sm:flex-row sm:items-baseline gap-2 pt-2 border-t border-light-border/10 dark:border-white/10">
              <code className="bg-light-surface dark:bg-white/10 px-2 py-1 rounded font-mono text-sm font-semibold text-vanellix-cyan w-fit">format=zip</code>
              <span className="text-light-text-secondary dark:text-gray-300 text-sm">OR use the <code className="text-vanellix-cyan">/download/zip</code> endpoint to download the entire dataset as a compressed JSON.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Code Examples */}
      <section className="space-y-6">
        <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 dark:text-white">
          <Code size={20} className="text-matrix-green" /> Code Examples
        </h3>

        <div className="space-y-3">
          <h4 className="text-base font-medium dark:text-white">cURL</h4>
          <div className="p-5 bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl border border-light-border/20 dark:border-white/5 overflow-x-auto shadow-sm group relative">
            <pre className="text-sm text-gray-800 dark:text-gray-300 font-mono leading-relaxed">
{`curl -X GET "${getBaseUrl()}/api/v1/data/${sampleEndpoint}?page=1&page_size=10" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"`}
            </pre>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-medium dark:text-white">JavaScript (Fetch)</h4>
          <div className="p-5 bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl border border-light-border/20 dark:border-white/5 overflow-x-auto shadow-sm">
            <pre className="text-sm text-gray-800 dark:text-gray-300 font-mono leading-relaxed">
{`fetch('${getBaseUrl()}/api/v1/data/${sampleEndpoint}?page=1&page_size=10', {
  method: 'GET',
  headers: {
    'X-API-Key': 'YOUR_API_KEY_HERE'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
            </pre>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-base font-medium dark:text-white">Download ZIP Example</h4>
          <div className="p-5 bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl border border-light-border/20 dark:border-white/5 overflow-x-auto shadow-sm">
            <pre className="text-sm text-gray-800 dark:text-gray-300 font-mono leading-relaxed">
{`curl -X GET "${getBaseUrl()}/api/v1/data/${sampleEndpoint}/download/zip" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  --output data.zip`}
            </pre>
          </div>
        </div>
      </section>
      
      {/* Batch Processing Notice */}
      <section className="mt-12 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20">
        <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-500 mb-2">Handling Large Datasets</h3>
        <p className="text-base text-amber-800/80 dark:text-amber-500/80 leading-relaxed">
          If your collection exceeds 10,000 documents, the API will prevent deep pagination to protect performance.
          In these cases, you should apply tighter filters or use the <code className="font-mono font-bold">/download/zip</code> endpoint to quickly pull the data down compressed.
        </p>
      </section>

    </div>
  );
};

export default ApiDocs;
