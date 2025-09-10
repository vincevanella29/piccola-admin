// Very small event queue. Stores events until flush is called.
export default function createEventQueue() {
  const q = [];
  return {
    push: (evt) => q.push(evt),
    flush: async (dispatch) => {
      while (q.length) {
        const item = q.shift();
        try { await dispatch(item); } catch (_) { /* drop on error */ }
      }
    },
    size: () => q.length,
    clear: () => { q.length = 0; },
  };
}
