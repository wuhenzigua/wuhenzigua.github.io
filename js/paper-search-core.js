(function(root){
'use strict';
function formatTitle(value){
 const sub={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','k':'ₖ','p':'ₚ','i':'ᵢ','n':'ₙ','j':'ⱼ','a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','+':'₊','-':'₋'};
 const sup={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','i':'ⁱ','+':'⁺','-':'⁻'};
 const symbols={ell:'ℓ',mu:'μ',alpha:'α',beta:'β',gamma:'γ',epsilon:'ε',varepsilon:'ε',lambda:'λ',sigma:'σ',theta:'θ',sqrt:'√',times:'×',infty:'∞',leq:'≤',geq:'≥'};
 return String(value||'').replace(/\$([^$]+)\$/g,(_,math)=>math.replace(/\\([a-zA-Z]+)/g,(whole,name)=>symbols[name]||whole).replace(/([_^])(?:\{([^}]+)\}|([a-zA-Z0-9+-]))/g,(whole,mark,group,single)=>{const text=group||single,map=mark==='_'?sub:sup;return [...text].every(c=>map[c])?[...text].map(c=>map[c]).join(''):mark+text;}));
}
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
const api={normalize,select,formatTitle}; if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PaperSearch=api;
})(typeof window==='undefined'?globalThis:window);

