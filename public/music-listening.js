const running = new Map();
export function flushListening(storage, key, send) {
  if (running.has(key)) return running.get(key);
  const task = (async () => {
    for (;;) {
      const pending = storage.get(key, {}); const [id, event] = Object.entries(pending)[0] || [];
      if (!id) return;
      try { await send(event); } catch (error) { if (![400, 404].includes(error.status)) return; }
      const latest = storage.get(key, {}); if ((latest[id]?.seconds || 0) <= event.seconds) delete latest[id]; storage.set(key, latest);
    }
  })(); running.set(key, task); return task.finally(() => running.delete(key));
}
