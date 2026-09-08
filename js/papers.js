(()=>{
'use strict';
const papers=JSON.parse(document.getElementById('paper-data').textContent);
const cards=new Map([...document.querySelectorAll('[data-paper-id]')].map(el=>[el.dataset.paperId,el]));
const list=document.getElementById('paper-list'),q=document.getElementById('paper-search'),year=document.getElementById('filter-year'),venue=document.getElementById('filter-venue'),type=document.getElementById('filter-type'),collection=document.getElementById('filter-collection'),sort=document.getElementById('paper-sort'),more=document.getElementById('load-more');
let limit=24;
function state(){return{q:q.value,year:year.value,venue:venue.value,type:type.value,collection:collection.value,sort:sort.value,topic:document.querySelector('input[name="topic"]:checked').value};}
function readUrl(){const p=new URLSearchParams(location.search);q.value=p.get('q')||'';for(const [name,el] of [['year',year],['venue',venue],['type',type],['collection',collection],['sort',sort]]){const value=p.get(name);el.value=[...el.options].some(o=>o.value===value)?value:(name==='sort'?'year-desc':'');}for(const el of document.querySelectorAll('input[name="topic"]'))el.checked=el.value===(p.get('topic')||'');if(!document.querySelector('input[name="topic"]:checked'))document.querySelector('input[name="topic"]').checked=true;}
function render(updateUrl=true){const s=state(),found=PaperSearch.select(papers,s);for(const card of cards.values())card.hidden=true;const frag=document.createDocumentFragment();for(const p of found.slice(0,limit)){const el=cards.get(p.id);el.hidden=false;frag.appendChild(el);}list.prepend(frag);document.getElementById('results-status').textContent='找到 '+found.length+' 篇文献'+(found.length>limit?' · 已显示 '+limit+' 篇':'');document.getElementById('paper-empty').hidden=found.length>0;more.hidden=found.length<=limit;more.textContent='显示更多文献（剩余 '+Math.max(0,found.length-limit)+' 篇）';if(updateUrl){const params=new URLSearchParams();Object.entries(s).forEach(([k,v])=>{if(v&&!(k==='sort'&&v==='year-desc'))params.set(k,v)});history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}}
function reset(){q.value='';year.value='';venue.value='';type.value='';collection.value='';sort.value='year-desc';document.querySelector('input[name="topic"]').checked=true;limit=24;render();}
document.getElementById('paper-search-form').addEventListener('submit',e=>{e.preventDefault();limit=24;render();});
let timer;q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{limit=24;render();},100);});
for(const el of [year,venue,type,collection,sort,...document.querySelectorAll('input[name="topic"]')])el.addEventListener('change',()=>{limit=24;render();});
document.getElementById('clear-filters').addEventListener('click',reset);document.getElementById('empty-reset').addEventListener('click',reset);
document.querySelectorAll('[data-topic]').forEach(el=>el.addEventListener('click',()=>{for(const radio of document.querySelectorAll('input[name="topic"]'))radio.checked=radio.value===el.dataset.topic;limit=24;render();}));
more.addEventListener('click',()=>{limit+=24;render();});
addEventListener('popstate',()=>{readUrl();limit=24;render(false)});
readUrl();render(false);
})();

