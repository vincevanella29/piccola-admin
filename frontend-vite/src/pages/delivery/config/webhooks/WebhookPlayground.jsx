import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaPlay, FaSpinner, FaTimes, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { testOutgoingWebhook } from '../../../../utils/deliveryData';

const WebhookPlayground = ({ appState, webhook, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await testOutgoingWebhook({
        token: appState?.token,
        walletAddress: appState?.account,
        webhookId: webhook._id,
      });
      setResult(r);
      if (r.success) {
        toast.success(`✅ Éxito: ${r.status_code}`);
      } else {
        toast.error(`❌ Error: ${r.status_code || r.error}`);
      }
    } catch (e) {
      setResult({ success: false, error: e.message });
      toast.error('Error enviando test');
    }
    setLoading(false);
  };

  // Auto-run test when playground opens (just like python script)
  useEffect(() => {
    if (webhook) handleTest();
    // eslint-disable-next-line
  }, []);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-light-border/20 dark:border-dark-border/20 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
        
        {/* Terminal Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={onClose} />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <p className="text-xs font-mono text-white/70">Playground POS (Test Webhook)</p>
          </div>
          <button onClick={handleTest} disabled={loading} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-[10px] font-mono text-white flex items-center gap-2 transition-colors disabled:opacity-50">
            {loading ? <FaSpinner className="animate-spin" /> : <FaPlay />} Retry
          </button>
        </div>

        {/* Terminal Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-mono text-[11px] text-gray-300 custom-scrollbar">
          <div className="text-blue-400">
            ==================================================<br />
            🚀 ENVIANDO: ORDEN TEST ALUSA $0 (webhook: {webhook.name})<br />
            ==================================================
          </div>

          {loading && !result && (
            <div className="flex items-center gap-2 text-yellow-400">
              <FaSpinner className="animate-spin" /> Esperando respuesta del POS...
            </div>
          )}

          {result && (
            <>
              {/* Payload Render */}
              {result.payload_sent && (
                <div className="space-y-1">
                  <p className="text-gray-400">📦 Payload preparado:</p>
                  <pre className="p-3 bg-black/40 rounded-lg overflow-x-auto text-green-400 whitespace-pre-wrap">
                    {JSON.stringify(result.payload_sent, null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Render */}
              <div className="space-y-1 mt-4">
                {result.success ? (
                  <p className="text-green-500 font-bold flex items-center gap-2">
                    <FaCheckCircle /> ✅ ÉXITO! Status API: {result.status_code} ({result.elapsed_ms}ms)
                  </p>
                ) : (
                  <p className="text-red-500 font-bold flex items-center gap-2">
                    <FaExclamationCircle /> ❌ ERROR: Status {result.status_code || 'Network/Server'}
                    {result.elapsed_ms && ` (${result.elapsed_ms}ms)`}
                  </p>
                )}

                {(result.response_preview || result.error) && (
                  <>
                    <p className="text-gray-400 mt-2">📝 Respuesta API:</p>
                    <pre className="p-3 bg-black/40 rounded-lg overflow-x-auto whitespace-pre-wrap text-yellow-300">
                      {result.response_preview || result.error}
                    </pre>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default WebhookPlayground;
