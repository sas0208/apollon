import { buildTitles,continueEntries } from '../video-logic.js';
export const storage = {
  get(key, fallback = null) { try { const v = localStorage.getItem(`mediateca:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`mediateca:${key}`, JSON.stringify(value)); } catch {} }
};
export async function request(url, data, method = 'PUT') {
  const response = await fetch(url, data === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Non riesco a caricare i dati. Riprova.'); return value;
}
export class TVData {
  constructor() { this.items = []; this.titles = []; this.progress = {}; this.list = []; this.ratings = {}; this.profiles = []; this.profile = storage.get('profile'); }
  get person() { return this.profiles.find(p => p.id === this.profile); }
  async load() {
    const [boot, library] = await Promise.all([request('/api/bootstrap'), request('/api/library'), this.refreshRatings()]);
    this.boot = boot; this.profiles = boot.profiles; this.items = library.items.filter(i => i.root !== 'Musica' && i.kind !== 'audio' && i.kind !== 'image');
    if (!this.person) this.profile = null;
    if (this.profile) await this.selectProfile(this.profile); else this.rebuild();
  }
  rebuild() { this.titles = buildTitles(this.items, this.progress); }
  async selectProfile(id) {
    const [progress, list] = await Promise.all([request(`/api/progress?profile=${encodeURIComponent(id)}`), request(`/api/mylist?profile=${encodeURIComponent(id)}`)]);
    this.profile = id; this.progress = progress; this.list = list.items; storage.set('profile', id); this.rebuild();
  }
  async reloadLibrary() { const library=await request('/api/library');this.items=library.items.filter(i=>i.root!=='Musica'&&i.kind!=='audio'&&i.kind!=='image');this.rebuild(); }
  async refreshRatings() { this.ratings = await request('/api/ratings/summary').catch(()=>({})); }
  async refresh() { await this.refreshRatings();await this.reloadLibrary();if (this.profile) await this.selectProfile(this.profile); }
  async saveProgress(id, patch, profile = this.profile) {
    const value = await request('/api/progress', {profile,id,...patch});
    if (profile === this.profile) { this.progress[id] = value; this.rebuild(); } return value;
  }
  async listed(title) { const on = !this.list.some(i => i.key === title.key); this.list = (await request('/api/mylist',{profile:this.profile,key:title.key,on})).items; return on; }
  async watched(title, on = !title.watched) {
    const ids = (title.episodes || [title.item]).map(i => i.id);
    Object.assign(this.progress, await request('/api/progress/batch',{profile:this.profile,ids,watched:on})); this.rebuild();
  }
  async preference(patch) { const person = await request('/api/profiles/preferences',{profile:this.profile,...patch}); Object.assign(this.person, person); }
  preferenceValue(key, fallback) { return storage.get(`${key}:${this.profile}`, fallback); }
  setPreference(key,value) { storage.set(`${key}:${this.profile}`,value); }
  async primePreviews(current,next){
    const continuing=continueEntries(this.titles,this.items,this.progress).map(e=>e.item.id);
    const rest=this.items.filter(i=>!i.remoteDown).map(i=>i.id);
    const first={...(current?{current}:{}),...(next?{next}:{}),continuing,rest:rest.slice(0,350)};
    await request('/api/tv/trickplay',first,'POST').catch(()=>{});
    for(let n=350;n<rest.length;n+=350)await request('/api/tv/trickplay',{rest:rest.slice(n,n+350)},'POST').catch(()=>{});
  }
}
