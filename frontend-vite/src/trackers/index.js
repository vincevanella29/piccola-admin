import createFirebaseTracker from './firebaseTracker';
import createGATracker from './gaTracker';
import { normalizeFirebaseConfig, normalizeGAConfig } from './utils/normalizeConfig';
import { getProviderEventMap } from './utils/eventMap';

export function buildAdapter(provider) {
  const service = provider.service;
  if (service === 'firebase') {
    return {
      adapter: createFirebaseTracker({ provider }),
      normalize: normalizeFirebaseConfig,
      map: getProviderEventMap('firebase'),
    };
  }
  if (service === 'analytics') {
    return {
      adapter: createGATracker({ provider }),
      normalize: normalizeGAConfig,
      map: getProviderEventMap('analytics'),
    };
  }
  return null;
}
