import { buildRows, featuredTitle, novitaGroups, sortList, catalogCategories } from '../video-logic.js';
import { catalogView } from './ui.js';
export function browse(c,{page,category},state) {
  const d=c.data; let rows,pool,heading=({series:'Serie TV',film:'Film',anime:'Anime',new:'Novità',list:'La mia lista'})[page];
  if(page==='list')pool=sortList(d.titles,d.list);
  else pool=['anime','film','series'].includes(page)?d.titles.filter(t=>t.kind===page):d.titles;
  const categories=catalogCategories(pool,page);const picked=categories.find(g=>g.id===category);
  if(picked){pool=picked.entries;heading=picked.name;}
  if(page==='list'||picked){rows=[];for(let i=0;i<pool.length;i+=4)rows.push({id:`griglia-${i/4}`,title:i===0?heading:'',entries:pool.slice(i,i+4)});}
  else if(page==='new')rows=novitaGroups(pool).map((r,i)=>({id:`new-${i}`,title:r.label,entries:r.entries}));
  else rows=buildRows(d.titles,d.items,d.progress,d.list,{page,tv:true,ratings:d.ratings});
  return catalogView(c,{rows,featured:featuredTitle(pool),categories:picked?[]:categories,state,grid:page==='list'||!!picked,heading,actions:page!=='list'&&!picked,page});
}
