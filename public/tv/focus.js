export const acceptRepeat = (key, now, last, repeat) => !repeat || !last || last.key !== key || now - last.at >= (key === 'up' || key === 'down' ? 160 : 110);

// Il DOM non decide la navigazione: ogni contenitore dichiara id e scelte.
export class FocusModel {
  constructor(rows = []) { this.rows = []; this.memory = {}; this.row = ''; this.setRows(rows); }
  setRows(rows) { this.rows = rows.filter(r => r.items.length); if (!this.rows.some(r => r.id === this.row)) this.row = this.rows[0]?.id || ''; return this; }
  get current() {
    const r = Math.max(0, this.rows.findIndex(row => row.id === this.row)); const row = this.rows[r];
    if (!row) return { row: '', item: '', r: 0, c: 0 };
    const c = Math.max(0, row.items.indexOf(this.memory[row.id]));
    return { row: row.id, item: row.items[c], r, c };
  }
  select(row, item) { if (this.rows.some(r => r.id === row)) { this.row = row; if (item !== undefined) this.memory[row] = item; } return this.current; }
  move(direction) {
    const { r, c } = this.current; const row = this.rows[r]; if (!row) return;
    if (direction === 'left' && c === 0) return 'rail';
    if (direction === 'left' || direction === 'right') this.memory[row.id] = row.items[Math.max(0, Math.min(row.items.length - 1, c + (direction === 'right' ? 1 : -1)))];
    else this.row = this.rows[Math.max(0, Math.min(this.rows.length - 1, r + (direction === 'down' ? 1 : -1)))].id;
    return this.current;
  }
  snapshot() { return { row: this.row, memory: { ...this.memory } }; }
  restore(state) { if (state) { this.memory = { ...state.memory }; if (this.rows.some(r => r.id === state.row)) this.row = state.row; } return this.current; }
}
