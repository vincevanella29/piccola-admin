// src/utils/trackingBus.js
const listeners = new Set();

export function onTrackingEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitTrackingEvent(type, payload) {
  for (const fn of listeners) {
    try {
      fn({ type, payload });
    } catch (e) {
      // noop
    }
  }
}

// Sugar for wallet created
export function emitWalletCreated(payload) {
  emitTrackingEvent('wallet_created', payload); // payload: { address, chainId, provider, source? }
}
