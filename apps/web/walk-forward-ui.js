import {parsePortfolioCsv,applyWeights} from './portfolio-csv.js';
const query=x=>document.querySelector(x);
const element=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node};
const percent=n=>typeof n==='number'&&Number.isFinite(n)?(n*100).toFixed(2)+'%':'N/A';
const metric=(name,value)=>{
 const box=element('div');box.className='walk-forward-metric';
 box.append(element('small',name),element('strong',value));
 return box;
};
function resultTable(report){
 const table=element('table');table.className='walk-forward-table';
 const header=element('tr');
 for(const text of ['Training method','Mean held-out return','Mean drawdown','Positive folds','Better than passive']){
  header.append(element('th',text));
 }
 table.append(header);
 for(const name of report.methods){
  const row=element('tr'),m=report.metrics[name];
  for(const text of [name,percent(m.averageOutOfSampleReturn),
    percent(m.averageOutOfSampleDrawdown),percent(m.positiveFoldShare),
    percent(m.outperformingPassiveShare)])row.append(element('td',text));
  table.append(row);
 }
 return table;
}
export function renderWalkForward(output,report){
 output.replaceChildren(element('h3','Historical walk-forward evaluation'));
 const stats=element('div');stats.className='walk-forward-stats';
 stats.append(
  metric('Out-of-sample folds',report.folds.length),
  metric('Training observations / fold',report.configuration.trainingBars),
  metric('Test observations / fold',report.configuration.testingBars)
 );
 output.append(stats,resultTable(report),element('h4','Chronological held-out windows'));
 const holdout=report.holdout;
 if(holdout?.status==='evaluated'){
  const holdoutResult=element('article');
  holdoutResult.append(element('h4','Independent final-fold selection'),
   element('p','Selected on earlier folds: '+holdout.selectedMethod),
   element('p','Untouched final fold: '+holdout.holdoutStart.slice(0,10)+
    ' to '+holdout.holdoutEnd.slice(0,10)),
   element('p','Final-fold historical return: '+percent(holdout.finalHoldout.totalReturn)+
    ' · Excess vs passive: '+percent(holdout.finalHoldout.excessReturn)));
  output.append(holdoutResult);
 }else output.append(element('p','Independent final holdout unavailable: at least 2 folds are required.'));
 if(report.costSensitivity){
  const article=element('article');article.append(element('h4','Simulated transaction-cost sensitivity'));
  for(const scenario of report.costSensitivity.scenarios){
   article.append(element('p',scenario.label+': '+report.methods.map(m=>
    m+' '+percent(scenario.methods[m].averageOutOfSampleReturn)).join(' · ')));
  }
  output.append(article);
 }
 for(const fold of report.folds){
  const title=element('h4','Fold '+fold.fold+': '+fold.trainStart.slice(0,10)+' to '+fold.trainEnd.slice(0,10));
  const note=element('p','Test begins '+fold.firstTestObservation.slice(0,10)+
    ' and ends '+fold.testEnd.slice(0,10)+
    ' · Purged bars: '+fold.purgedBars);
  output.append(title,note);
  const table=element('table');table.className='walk-forward-table';
  const head=element('tr');
  for(const label of ['Method','Asset weights (training only)','Held-out return','Transaction drag']){
   head.append(element('th',label));
  }
  table.append(head);
  for(const method of report.methods){
   const row=element('tr'),evaluation=fold.evaluations[method];
   const weights=evaluation.weights.map(w=>w.symbol+': '+percent(w.weight)).join(' · ');
   for(const text of [method,weights,percent(evaluation.totalReturn),
     '$'+evaluation.transactionDrag.toFixed(2)])row.append(element('td',text));
   table.append(row);
  }
  output.append(table);
 }
 const foot=element('p',report.interpretation);foot.className='muted';output.append(foot);
 for(const warning of report.warnings){
  const note=element('p',warning);note.className='muted';output.append(note);
 }
}
query('#walk-forward-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const output=query('#walk-forward-result'),button=query('#walk-forward-run');
 button.disabled=true;output.replaceChildren(element('p','Validating historical train/test boundaries…'));
 try{
  const form=new FormData(event.currentTarget),file=form.get('file');
  if(!(file instanceof File)||file.size<10||file.size>160000)
   throw Error('Upload a historical CSV under 160 KB.');
  const assets=applyWeights(parsePortfolioCsv(await file.text()));
  const walkForward={};
  for(const key of ['trainingBars','testingBars','stepBars','purgeGapBars'])
   walkForward[key]=Number(form.get(key));
  walkForward.includeCostStress=form.get('includeCostStress')==='on';
  const execution={feeBps:Number(form.get('feeBps')),slippageBps:Number(form.get('slippageBps'))};
  const response=await fetch('/api/walk-forward',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({assets,walkForward,execution})
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Walk-forward evaluation failed');
  renderWalkForward(output,result);
 }catch(e){output.replaceChildren(element('p',e.message))}
 finally{button.disabled=false}
});
