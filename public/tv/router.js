const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
export class Router {
  constructor() { this.stack = []; }
  get current() { return this.stack[this.stack.length - 1] || null; }
  push(name, params = {}, returnState) { if (this.current && returnState) this.current.state = copy(returnState); const entry = { name, params: copy(params), state: null }; this.stack.push(entry); return entry; }
  replace(name, params = {}) { this.stack = []; return this.push(name, params); }
  back() { if (this.stack.length < 2) return null; this.stack.pop(); return this.current; }
}
