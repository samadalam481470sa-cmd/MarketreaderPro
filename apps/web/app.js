const $=s=>document.querySelector(s);const el=(t,text)=>{const x=document.createElement(t);x.textContent=String(text);return x};async function req(path,opt){const r=await fetch(path,opt);const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j}async function markets(){$('#market-status').textContent='Fetching live public endpoints…';try{const d=await req('/api/markets');for(const k of ['kalshi','polymarket']){const node=$('#'+k);node.replaceChildren();if(!d[k]?.length)node.append(el('p','Feed unavailable or empty.'));for(const m of d[k]||[]){const item=el('div',m.title||'Untitled market');item.append(el('small',k==='kalshi'?' · Yes ask: '+(m.yesPrice??'N/A'):' · Outcome prices: '+(m.prices??'N/A')));node.append(item)}}$('#market-status').textContent='As of '+new Date(d.asOf).toLocaleString()+' · Kalshi: '+d.availability.kalshi+' · Polymarket: '+d.availability.polymarket}catch(e){$('#market-status').textContent=e.message}}$('#refresh').addEventListener('click',markets);markets();req('/api/disclosures').then(d=>{for(const s of d.sources){const card=el('article','');const a=el('a',s.name+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a,el('p',s.kind));$('#sources').append(card)}}).catch(()=>{$('#sources').textContent='Sources unavailable'});$('#ask').addEventListener('submit',async e=>{e.preventDefault();const out=$('#answer');out.hidden=false;out.textContent='Researching…';try{const d=await req('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:$('#question').value})});out.replaceChildren(el('h3','Educational research'),el('p',d.answer),el('p',d.checklist.join(' · ')),el('small',d.limitations))}catch(err){out.textContent=err.message}});$('#portfolio').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const positions=['a','b','c'].map((n,i)=>({symbol:['ETF-A','ETF-B','ASSET-C'][i],value:Number(f.get(n))}));const out=$('#risk-result');out.hidden=false;try{const d=await req('/api/risk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({positions})});out.textContent='Portfolio: $'+d.total.toLocaleString()+'\nLargest allocation: '+(d.largestWeight*100).toFixed(1)+'%\nConcentration index: '+d.herfindahl.toFixed(3)+'\n'+d.note}catch(err){out.textContent=err.message}});
// Database status and persisted public-market history (no private financial accounts).
req('/api/db/status').then(d=>{$('#db-state').textContent='Connected · '+d.observations+' observations'}).catch(()=>{$('#db-state').textContent='Database not configured'});
$('#history-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const output=$('#history-result');output.hidden=false;output.textContent='Loading saved snapshots…';
 const form=new FormData(event.currentTarget);
 const q=new URLSearchParams({source:String(form.get('source')),id:String(form.get('id')),limit:'50'});
 try{
  const d=await req('/api/history?'+q.toString());
  if(!d.history.length){output.textContent='No snapshots saved for this market ID yet. Run the ingestion job after applying migrations.';return}
  const h=el('h3',d.history.length+' recorded observations');
  const list=el('div','');list.className='observations';
  for(const item of d.history){
   const date=Number.isFinite(Date.parse(item.observed_at))?new Date(item.observed_at).toLocaleString():'Unknown time';
   const v=item.probability===null?'Not normalized':(Number(item.probability)*100).toFixed(2)+'%';
   list.append(el('p',date+' · '+v+' · '+item.title));
  }
  output.replaceChildren(h,list);
 }catch(e){output.textContent=e.message}
});
