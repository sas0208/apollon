export function previewQueue({ current, next, continuing = [], rest = [] } = {}) { return [...new Set([current, next, ...continuing, ...rest].filter(Boolean))]; }
export function previewFrame(index, position) {
  if (!index?.frames || !(index.interval > 0)) return null;
  const n = Math.max(0, Math.min(index.frames - 1, Math.floor((position || 0) / index.interval)));
  const size = index.columns * index.rows, offset = n % size;
  return { sheet: Math.floor(n / size), x: offset % index.columns * index.width, y: Math.floor(offset / index.columns) * index.height, width: index.width, height: index.height };
}
