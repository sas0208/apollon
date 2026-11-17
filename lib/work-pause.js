import os from 'node:os';
import { readFile } from 'node:fs/promises';

export const ffmpegThreadCount = value => Number.isInteger(value) && value > 0 ? value : null;

// Un lock abbandonato non ferma il lavoro: deve esserci ancora il processo che lo ha scritto.
export async function workPaused(config, { freemem = os.freemem, kill = process.kill } = {}) {
  if (Number.isFinite(config.minFreeMB) && config.minFreeMB > 0 && freemem() < config.minFreeMB * 1024 ** 2) return true;
  if (!config.pauseLockFile) return false;
  // Accetta anche il lucchetto del preflight di Windows: BOM iniziale, PID in «owner», scadenza started + maxMin.
  let lock;
  try { lock = JSON.parse((await readFile(config.pauseLockFile, 'utf8')).replace(/^﻿/, '')); } catch { return false; }
  const pid = lock?.pid ?? lock?.owner;
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  const scade = Date.parse(lock.started) + Number(lock.maxMin) * 60000;
  if (Number.isFinite(scade) && Date.now() > scade) return false;
  try { kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}

export class WorkPause {
  constructor(config) { this.config = config; this.closed = false; }
  async wait() {
    while (!this.closed && await workPaused(this.config)) {
      if (this.closed) break;
      await new Promise(resolve => {
        this.wake = () => { clearTimeout(this.timer); this.wake = null; resolve(); };
        this.timer = setTimeout(this.wake, 30000);
      });
    }
  }
  close() { this.closed = true; this.wake?.(); }
}
