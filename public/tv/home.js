import { buildRows, featuredTitle, catalogCategories } from '../video-logic.js';
import { catalogView } from './ui.js';
export function home(c,params,state) { const d=c.data; return catalogView(c,{rows:buildRows(d.titles,d.items,d.progress,d.list,{tv:true,ratings:d.ratings}),categories:catalogCategories(d.titles),featured:featuredTitle(d.titles),state}); }
