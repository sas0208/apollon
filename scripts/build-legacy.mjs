// Versione per TV con Chromium 76: bundle JS abbassato, CSS abbassato e, per le cose che esbuild non sa
// tradurre (gap nei flex, aspect-ratio, min/max/clamp, dvh), un foglio tv-legacy.css generato qui.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'legacy');
export const TARGET = 'chrome76';
export const ESBUILD = process.env.ESBUILD_PATH || 'esbuild';
export const esbuild = createRequire(import.meta.url)(ESBUILD);

// ---- CSS ----
const splitTop = (s, sep) => { // divide al livello più esterno (fuori da parentesi e virgolette)
  const out = []; let depth = 0, quote = '', cur = '';
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = ''; cur += ch; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim()); return out;
};
function parse(css) { // [{sel, decls:[[prop,val]]} | {at, children} | {raw}]
  let i = 0;
  const block = () => {
    const nodes = [];
    while (i < css.length) {
      const ws = css.slice(i).match(/^\s+/); if (ws) { i += ws[0].length; continue; }
      if (css[i] === '}') { i++; return nodes; }
      if (css.startsWith('/*', i)) { i = css.indexOf('*/', i) + 2; continue; }
      let j = i, depth = 0, quote = '';
      for (; j < css.length; j++) { const ch = css[j]; if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '(') depth++; else if (ch === ')') depth--; else if (depth === 0 && (ch === '{' || ch === ';')) break; }
      const head = css.slice(i, j).trim(); i = j + 1;
      if (css[j] === ';') { nodes.push({ raw: head + ';' }); continue; }
      if (/^@(media|supports|layer|container)/.test(head)) { nodes.push({ at: head, children: block() }); continue; }
      let d = 1; const s = i;
      while (d && i < css.length) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
      if (head.startsWith('@')) { nodes.push({ raw: head + '{' + css.slice(s, i) }); continue; }
      nodes.push({ sel: head, decls: splitTop(css.slice(s, i - 1), ';').map(x => { const k = x.indexOf(':'); return [x.slice(0, k).trim(), x.slice(k + 1).trim()]; }) });
    }
    return nodes;
  };
  return block();
}
const print = nodes => nodes.map(n => n.raw ? n.raw : n.at ? `${n.at}{${print(n.children)}}` : `${n.sel}{${n.decls.map(([k, v]) => `${k}:${v}`).join(';')}}`).join('\n');

// min()/max()/clamp() arrivano in Chrome 79: li calcoliamo per una TV Full HD (1920x1080, rem 21px come con html.tv).
const UNITS = { px: 1, rem: 21, em: 21, vw: 19.2, vh: 10.8, vmin: 10.8, vmax: 19.2 };
function evalLen(expr) {
  let s = expr.replace(/env\([^()]*(\([^()]*\))?[^()]*\)/g, '0px').replace(/\bcalc\(/g, '(');
  if (/var\(|%|attr\(/.test(s)) return null;
  s = s.replace(/(-?\d*\.?\d+)(px|rem|em|vw|vh|vmin|vmax)\b/g, (_, n, u) => `(${n}*${UNITS[u]})`);
  if (!/^[\d\s.+\-*/()]+$/.test(s)) return null;
  try { const v = Function(`return (${s})`)(); return Number.isFinite(v) ? v : null; } catch { return null; }
}
function resolveMath(value) {
  const re = /\b(min|max|clamp)\(/g; let out = '', last = 0, m;
  while ((m = re.exec(value))) {
    let d = 1, j = re.lastIndex; while (d && j < value.length) { if (value[j] === '(') d++; else if (value[j] === ')') d--; j++; }
    const args = splitTop(value.slice(re.lastIndex, j - 1), ',').map(a => resolveMath(a));
    const nums = args.map(evalLen); const ok = nums.filter(n => n !== null);
    let result = null;
    if (ok.length) {
      if (m[1] === 'clamp') result = nums.length === 3 && nums.every(n => n !== null) ? Math.min(Math.max(nums[1], nums[0]), nums[2]) : (nums[1] ?? ok[0]);
      else result = m[1] === 'min' ? Math.min(...ok) : Math.max(...ok);
    }
    out += value.slice(last, m.index) + (result === null ? value.slice(m.index, j) : `${+result.toFixed(2)}px`);
    last = j; re.lastIndex = j;
  }
  return out + value.slice(last);
}
const pieces = sel => splitTop(sel, ',');
const isPseudoEl = p => /::|:(before|after|first-line|first-letter)\b/.test(p);
const norm = p => p.replace(/\s+/g, ' ');

function lowerSheets(sheets) { // sheets: [{name, css}] già passati da esbuild
  const trees = sheets.map(s => parse(s.css));
  const info = new Map(); // selettore -> {display, column, wrap}
  const walk = (nodes, f) => nodes.forEach(n => n.children ? walk(n.children, f) : n.decls && f(n));
  trees.forEach(t => walk(t, n => {
    const get = k => n.decls.findLast(d => d[0] === k)?.[1];
    for (const p of pieces(n.sel)) {
      const e = info.get(norm(p)) || {};
      if (get('display')) e.display = get('display');
      if (get('flex-direction')) e.column = /column/.test(get('flex-direction'));
      if (get('flex-wrap')) e.wrap = get('flex-wrap') !== 'nowrap';
      if (get('flex-flow')) { e.column = /column/.test(get('flex-flow')); e.wrap = /\bwrap/.test(get('flex-flow')); }
      info.set(norm(p), e);
    }
  }));
  const stats = { gap: 0, aspect: 0, math: 0, auto: 0 };
  const lowerTree = nodes => {
    const fall = [];
    for (const n of nodes) {
      if (n.children) { const inner = lowerTree(n.children); if (inner.length) fall.push({ at: n.at, children: inner }); continue; }
      if (!n.decls) continue;
      const rules = [];
      n.decls = n.decls.map(([k, v]) => {
        let nv = v.replace(/\b(\d*\.?\d+)(dvh|svh|lvh)\b/g, '$1vh').replace(/\b(\d*\.?\d+)(dvw|svw|lvw)\b/g, '$1vw');
        if (/\b(min|max|clamp)\(/.test(nv)) { nv = resolveMath(nv); stats.math++; }
        return [k, nv];
      });
      const get = k => n.decls.findLast(d => d[0] === k)?.[1];
      const ps = pieces(n.sel).filter(p => !isPseudoEl(p));
      const dispOf = p => get('display') || (info.get(norm(p)) || {}).display || '';
      const flexOf = p => /flex/.test(dispOf(p));
      const colOf = p => get('flex-direction') ? /column/.test(get('flex-direction')) : (info.get(norm(p)) || {}).column;
      const wrapOf = p => get('flex-wrap') ? get('flex-wrap') !== 'nowrap' : (info.get(norm(p)) || {}).wrap;
      // gap nei flex -> margini sui figli
      const gap = get('gap');
      if (gap && gap !== 'normal') {
        const [r, c = r] = splitTop(gap, ' ');
        const flexPieces = ps.filter(flexOf);
        for (const p of flexPieces) {
          stats.gap++;
          const sib = p + '>:not([hidden])~:not([hidden])', left = evalLen(c) !== 0; // gap 0: non toccare i margini dei figli
          if (wrapOf(p)) { if (left) rules.push({ sel: sib, decls: [['margin-left', c]] }); if ((evalLen(r) ?? 99) <= 16 && evalLen(r) !== 0) rules.push({ sel: p + '>*', decls: [['margin-bottom', r]] }); } // righe a capo: solo spazio piccolo fra righe
          else if (colOf(p)) { if (evalLen(r) !== 0) rules.push({ sel: sib, decls: [['margin-top', r]] }); }
          else if (left) rules.push({ sel: sib, decls: [['margin-left', c]] });
        }
        if (flexPieces.length === pieces(n.sel).length) n.decls = n.decls.filter(d => d[0] !== 'gap');
      }
      // aspect-ratio -> trucco del padding-top (o larghezza dall'altezza)
      const ar = get('aspect-ratio');
      if (ar) {
        const m = ar.match(/^(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?$/);
        for (const p of ps) {
          if (/(^|[\s>+~])(img|video|canvas|svg)$/.test(p) || /\.now-cover$/.test(p)) continue;
          stats.aspect++;
          if (!m) { if (ar === 'auto') rules.push({ sel: `${p}::before`, decls: [['display', 'none']] }); continue; }
          const ratio = +m[1] / +(m[2] || 1); const h = get('height'), w = get('width');
          if (h && h !== 'auto') rules.push({ sel: p, decls: [['width', `calc(${h} * ${+ratio.toFixed(4)})`]] });
          else if (/grid/.test(dispOf(p))) { if (w && w !== 'auto' && ratio === 1) rules.push({ sel: p, decls: [['height', w]] }); }
          else rules.push({ sel: `${p}::before`, decls: [['content', '""'], ['display', 'block'], ['width', flexOf(p) ? '0' : 'auto'], ['padding-top', `${+(100 / ratio).toFixed(3)}%`]] });
        }
      }
      // margin auto: i ripieghi dei gap (selettore piu' specifico) non devono cancellarlo
      for (const prop of ['margin-left', 'margin-top']) if (get(prop) === 'auto') for (const p of ps) { stats.auto++; rules.push({ sel: `${p}:not(#z)`, decls: [[prop, 'auto']] }); }
      fall.push(...rules);
    }
    return fall;
  };
  const fallback = trees.map(t => lowerTree(t));
  return { css: trees.map(print), fallback: fallback.map(print).join('\n'), stats };
}

const HAND = `/* tv-legacy.css: solo per Chromium 76 (TV). Parte scritta a mano, poi i ripieghi generati da scripts/build-legacy.mjs. */
.tp-hero,.bb-frame,.t-art,.c-art,.ep-art{overflow:hidden}
`;

export async function build() {
  await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
  const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
  const common = { target: TARGET, logLevel: 'warning' };
  // JS: bundle unico non-modulo, polyfill in testa. Gli import dinamici diventano parte del bundle.
  const app = await esbuild.build({ ...common, stdin: { contents: "import './legacy-polyfill.js';\nimport './app.js';", resolveDir: PUBLIC, loader: 'js' }, bundle: true, format: 'iife', write: false });
  await writeFile(path.join(OUT, 'app.js'), app.outputFiles[0].text);
  const sw = await esbuild.build({ ...common, entryPoints: [path.join(PUBLIC, 'sw.js')], bundle: true, format: 'iife', write: false });
  await writeFile(path.join(OUT, 'sw.js'), sw.outputFiles[0].text);
  // CSS
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/([^"]+)"/g)].map(m => m[1]);
  const sheets = [];
  for (const href of hrefs) {
    const src = await readFile(path.join(PUBLIC, href), 'utf8');
    const out = await esbuild.transform(src, { ...common, loader: 'css' });
    sheets.push({ name: href, css: out.code });
  }
  const { css, fallback, stats } = lowerSheets(sheets);
  for (let i = 0; i < sheets.length; i++) await writeFile(path.join(OUT, sheets[i].name), css[i] + '\n');
  await writeFile(path.join(OUT, 'tv-legacy.css'), (HAND + fallback).trimEnd() + '\n');
  // App telecomando autonoma: non importa il guscio desktop o la vecchia tv-nav.
  await mkdir(path.join(OUT, 'tv'), { recursive: true });
  const tv = await esbuild.build({ ...common, stdin: { contents: "import './legacy-polyfill.js';\nimport './tv/app.js';", resolveDir: PUBLIC, loader: 'js' }, bundle: true, format: 'iife', write: false });
  await writeFile(path.join(OUT, 'tv', 'app.js'), tv.outputFiles[0].text);
  const tvCSS = await esbuild.transform(await readFile(path.join(PUBLIC, 'tv', 'tv.css'), 'utf8'), { ...common, loader: 'css' });
  await writeFile(path.join(OUT, 'tv', 'tv.css'), tvCSS.code);
  return { hrefs, stats };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await build(); console.log('legacy pronto:', r.hrefs.join(', '), JSON.stringify(r.stats));
}
