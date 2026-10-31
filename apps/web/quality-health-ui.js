const sourcePanel=document.querySelector('#quality-health-results');
function make(tag,value){
 const node=document.createElement(tag);
 node.textContent=String(value);
 return node;
}
async function refreshHealth(){
 if(!sourcePanel)return;
 sourcePanel.replaceChildren(make('p','Checking persisted collection history…'));
 try{
  const response=await fetch('/api/data-health',{headers:{Accept:'application/json'}});
  const report=await response.json();
  if(!response.ok)throw Error(report.error||'Source health could not be loaded');
  sourcePanel.replaceChildren();
  const headline=make('p','Overall health: '+report.overall);
  headline.className='health-'+report.overall;
  sourcePanel.append(headline);
  if(!report.sources?.length)sourcePanel.append(
   make('p','Run the intelligence collector with PostgreSQL configured to record source health.'));
  for(const source of report.sources){
   const row=make('div');row.className='health-row';
   const text=make('div');
   text.append(make('strong',source.name),
    make('small','Last check: '+(source.lastAttemptAt?
      new Date(source.lastAttemptAt).toLocaleString():'never')+
      ' · Items: '+source.lastItemCount));
   const status=make('strong',source.state);
   status.className='health-'+source.state;
   row.append(text,status);
   sourcePanel.append(row);
  }
  for(const warning of report.warnings||[]){
   const note=make('p',warning);note.className='muted';sourcePanel.append(note);
  }
 }catch(e){sourcePanel.replaceChildren(make('p','Source health unavailable: '+e.message))}
}
refreshHealth();
document.querySelector('#dashboard-refresh')?.addEventListener('click',refreshHealth);
