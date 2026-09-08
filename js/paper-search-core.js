(function(root){
'use strict';
function normalize(s){return String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function searchable(p){return normalize([p.title,p.titleZh,...p.authors,p.venue,p.year,p.type,...p.topics,p.summary||'',...(p.keywords||[])].join(' '));}
function select(papers,state){
const terms=normalize(state.q).split(/\s+/).filter(Boolean);
return papers.filter(p=>(!state.year||String(p.year)===state.year)&&(!state.venue||p.venue===state.venue)&&(!state.type||p.type===state.type)&&(!state.collection||(p.collection||'手动收录')===state.collection)&&(!state.topic||p.topics.includes(state.topic))&&terms.every(t=>searchable(p).includes(t))).sort((a,b)=>{
if(state.sort==='year-asc')return a.year-b.year||a.title.localeCompare(b.title);
if(state.sort==='title')return a.title.localeCompare(b.title);
if(state.sort==='added')return b.addedAt.localeCompare(a.addedAt)||b.year-a.year||a.title.localeCompare(b.title);
return b.year-a.year||a.title.localeCompare(b.title);
});
}
const api={normalize,select}; if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PaperSearch=api;
})(typeof window==='undefined'?globalThis:window);

