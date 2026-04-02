// src/hooks/useGamificationAdmin.jsx
// Wrapper para mantener compatibilidad: compone useGamification + useDaoMeritocracy

import { useGamification } from './useGamification.jsx';
import { useDaoMeritocracy } from './useDaoMeritocracy.jsx';

export function useGamificationAdmin(appState, t) {
  // Hooks separados
  const g = useGamification(appState, t);
  const dm = useDaoMeritocracy(appState, t);

  // Merge de estado principal
  const isLoading = g.isLoading || dm.isLoading;

  // Mantener compatibilidad de nombres que usa la UI existente
  return {
    // Estado
    isLoading,
    rules: g.rules,
    catalogs: g.catalogs,
    segments: dm.segments,
    fastMinters: dm.fastMinters,
    meritResults: g.meritResults,

    // Acciones Gamification
    defineRule: g.defineRule,
    listRuleTemplates: g.listRuleTemplates,
    defineRuleFromTemplate: g.defineRuleFromTemplate,
    updateRuleFromTemplate: g.updateRuleFromTemplate,
    listMeritRules: g.listMeritRules,
    listRules: g.listRules,
    computePreview: g.computePreview,
    listCatalogs: g.listCatalogs,
    listMeritPeriods: g.listMeritPeriods,
    listMeritResults: g.listMeritResults,

    // Acciones DAO + Meritocracy
    createSegment: dm.createSegment,
    createSegmentViaBackend: dm.createSegmentViaBackend,
    listSegments: dm.listSegments,
    allowDaoInSegment: dm.allowDaoInSegment,
    allowDaoInSegmentViaBackend: dm.allowDaoInSegmentViaBackend,
    listAllowedDaosForSegment: dm.listAllowedDaosForSegment,
    fetchUserSpecialProfileAction: dm.fetchUserSpecialProfileAction,
    bootstrapSpecialBuild: dm.bootstrapSpecialBuild,
    authorizeCompanyAllBuild: dm.authorizeCompanyAllBuild,
    bootstrapSpecialExecute: dm.bootstrapSpecialExecute,
    planBatch: dm.planBatch,
    buildBatch: dm.buildBatch,
    listDaoProposals: dm.listDaoProposals,
    listFastMinters: dm.listFastMinters,
    setFastMinter: dm.setFastMinter,
  };
}

export default useGamificationAdmin;