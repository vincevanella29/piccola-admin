// Normalize backend public_config into SDK-ready shapes per provider

export function normalizeFirebaseConfig(publicConfig = {}) {
  const cfg = {
    apiKey: publicConfig.apiKey,
    authDomain: publicConfig.authDomain,
    projectId: publicConfig.projectId,
    storageBucket: publicConfig.storageBucket,
    messagingSenderId: publicConfig.messagingSenderId,
    appId: publicConfig.appId,
  };
  // Clean undefined
  Object.keys(cfg).forEach((k) => cfg[k] == null && delete cfg[k]);
  return {
    appConfig: cfg,
    vapidKey: publicConfig.vapidKey,
  };
}

export function normalizeGAConfig(publicConfig = {}) {
  return {
    measurementId: publicConfig.measurementId,
  };
}
