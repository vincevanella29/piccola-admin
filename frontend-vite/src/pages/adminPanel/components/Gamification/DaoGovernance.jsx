// src/pages/adminPanel/components/Gamification/DaoGovernance.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, CheckCircle2, XCircle, PlayCircle, Info, ChevronDown, Code, FileCode, Copy } from 'lucide-react';

import useDaoMeritocracy from '../../../../hooks/useDaoMeritocracy.jsx';

// --- Componente: Tarjeta de Propuesta Individual ---
const ProposalCard = ({ proposal, isExpanded, onToggle, onVote, onExecute, appState }) => {
  const { t } = useTranslation();
  const [isDecoded, setIsDecoded] = useState(true);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      toast.success(t('common.copied') || 'Copiado al portapapeles');
    } catch (e) {
      toast.error(e?.message || 'No se pudo copiar');
    }
  };

  const statusInfo = proposal.executed
    ? { text: t('dao.executed') || 'Ejecutado', color: 'bg-matrix-green', icon: <CheckCircle2 size={14} /> }
    : { text: t('dao.pending') || 'Pendiente', color: 'bg-yellow-500', icon: <Info size={14} /> };

  return (
    <div className="border border-dark-border/20 rounded-xl overflow-hidden transition-all duration-300 ease-in-out bg-light-surface dark:bg-dark-surface-secondary/40 hover:border-matrix-green/50">
      {/* Encabezado visible de la tarjeta */}
      <header
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase px-3 py-1 rounded-full text-white ${statusInfo.color}`}>
            {statusInfo.icon}
            <span>{statusInfo.text}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {proposal.decoded?.function || t('dao.unknown_function') || 'Función Desconocida'}
            </span>
            <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">
              ID: {proposal.id}
            </span>
          </div>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
          <ChevronDown size={20} className="text-light-text-secondary dark:text-dark-text-secondary" />
        </motion.div>
      </header>

      {/* Contenido expandible con animación */}
      <AnimatePresence>
        {isExpanded && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-dark-border/20">
              {/* Detalles de la propuesta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 text-sm">
                <DetailItem label={t('dao.target') || 'Target'} value={proposal.target} onCopy={copyToClipboard} isMono />
                <DetailItem label={t('dao.tx_hash') || 'Tx Hash'} value={proposal.transactionHash} onCopy={copyToClipboard} isMono isLink={`${appState?.blockExplorer}/tx/0x${proposal.transactionHash}`} />
                <DetailItem label={t('dao.block') || 'Block #'} value={proposal.blockNumber} isMono />
              </div>

              {/* Sección de CallData (la magia está aquí) */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-base text-light-text-primary dark:text-dark-text-primary">
                    {t('dao.call_data') || 'Call Data'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyToClipboard(proposal.callData)} className="p-1.5 rounded-md hover:bg-dark-border/20 transition-colors" title={t('dao.copy_raw') || 'Copiar Raw Data'}>
                      <Copy size={16} />
                    </button>
                    <div className="bg-light-surface-secondary dark:bg-dark-surface p-1 rounded-md flex">
                      <button onClick={() => setIsDecoded(true)} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDecoded ? 'bg-matrix-green text-white shadow' : 'hover:bg-dark-border/20'}`}><FileCode size={14} /> {t('dao.decoded') || 'Decodificado'}</button>
                      <button onClick={() => setIsDecoded(false)} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${!isDecoded ? 'bg-matrix-green text-white shadow' : 'hover:bg-dark-border/20'}`}><Code size={14} /> {t('dao.raw') || 'Raw'}</button>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-light-surface-secondary dark:bg-dark-surface rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {isDecoded ? (
                    proposal.decoded ? (
                      <>
                        <div className="text-matrix-green">
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('dao.function') || 'function'} </span>
                          {proposal.decoded.function}
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">()</span>
                        </div>
                        <div className="mt-2 pl-2 border-l-2 border-dark-border/20">
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('dao.args') || 'args'}:</span>
                          <pre className="mt-1">{JSON.stringify(proposal.decoded.args, null, 2)}</pre>
                        </div>
                      </>
                    ) : (
                      <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('dao.no_decoded_data') || 'Datos no decodificados disponibles.'}</span>
                    )
                  ) : (
                    proposal.callData || '-'
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <footer className="flex flex-wrap items-center justify-end gap-3 mt-6">
                <button onClick={() => onVote(proposal.id, true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-matrix-green rounded-lg hover:opacity-90 transition-opacity"><CheckCircle2 size={16} /> {t('dao.yes') || 'Sí'}</button>
                <button onClick={() => onVote(proposal.id, false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:opacity-90 transition-opacity"><XCircle size={16} /> {t('dao.no') || 'No'}</button>
                <button onClick={() => onExecute(proposal.id)} disabled={proposal.executed} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed hover:opacity-90"><PlayCircle size={16} /> {t('dao.execute') || 'Ejecutar'}</button>
              </footer>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Componente Auxiliar para mostrar detalles y evitar repetición ---
const DetailItem = ({ label, value, onCopy, isMono, isLink }) => {
  if (!value || value === '-') return null;
  const { t } = useTranslation();
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">{label}</div>
      <div className={`flex items-center gap-2 mt-1 text-light-text-primary dark:text-dark-text-primary ${isMono ? 'font-mono' : ''}`}>
        {isLink ? (
          <a href={isLink} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-400 hover:underline">{value}</a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {onCopy && (
          <button onClick={() => onCopy(value)} className="p-1 rounded-md hover:bg-dark-border/20 transition-colors" title={t('common.copy') || 'Copiar'}>
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Componente Principal: DaoGovernance ---
const DaoGovernance = ({ appState }) => {
  const { t } = useTranslation();
  const dao = useDaoMeritocracy(appState, t);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null); // Controla qué tarjeta está abierta

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dao.listDaoProposals();
      setProposals(res?.proposals || []);
    } catch (e) {
      toast.error(e?.message || 'Error listando propuestas');
    } finally {
      setLoading(false);
    }
  }, [dao]);

  useEffect(() => {
    const hasAuth = !!(appState?.walletAddress || appState?.account) && !!appState?.token;
    if (hasAuth) {
      refresh().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState?.walletAddress, appState?.account, appState?.token]);
  
  const onVote = async (id, support) => {
    try {
      const result = await dao.voteProposal({ proposalId: id, support });
      if (result?.hash) {
        toast.success(`${t('dao.vote_sent') || 'Voto enviado con éxito'}. Hash: ${result.hash.slice(0, 10)}...` );
      }
      setTimeout(() => refresh().catch(console.error), 5000);
    } catch (e) {
      toast.error(e?.message || 'Error al votar');
    }
  };

  const onExecute = async (id) => {
    try {
      const result = await dao.executeProposal({ proposalId: id });
      if (result?.hash) {
        toast.success(`${t('dao.execute_sent') || 'Ejecución enviada con éxito'}. Hash: ${result.hash.slice(0, 10)}...` );
      }
      setTimeout(() => refresh().catch(console.error), 7000);
    } catch (e) {
      toast.error(e?.message || 'Error al ejecutar');
    }
  };

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{t('dao.title') || 'Gobernanza DAO'}</h2>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface dark:hover:bg-dark-surface border border-dark-border/20 transition-all"
          disabled={loading}
        >
          <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: 'linear' }}>
            <RefreshCcw size={16} />
          </motion.div>
          {loading ? (t('common.loading') || 'Cargando...') : (t('common.refresh') || 'Refrescar')}
        </button>
      </div>

      <div className="space-y-3">
        {proposals.length > 0 ? (
          proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              isExpanded={expandedId === p.id}
              onToggle={() => handleToggle(p.id)}
              onVote={onVote}
              onExecute={onExecute}
              appState={appState}
            />
          ))
        ) : (
          <div className="text-center py-12 px-6 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary/40 border border-dashed border-dark-border/20">
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              {loading ? (t('dao.loading_proposals') || 'Cargando propuestas...') : (t('dao.no_proposals') || 'No se encontraron propuestas')}
            </h3>
            <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {loading ? (t('dao.please_wait') || 'Por favor espera un momento.') : (t('dao.try_refresh') || 'Intenta refrescar o revisa más tarde.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DaoGovernance;