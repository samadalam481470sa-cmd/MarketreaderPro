import {parsePortfolioCsv,applyWeights} from './portfolio-csv.js';
const $=selector=>document.querySelector(selector);
const node=(tag,content='')=>{const element=document.createElement(tag);element.textContent=String(content);return element};
const percent=value=>Number.isFinite(value)?(100*value).toFixed(2)+'%':'N/A';
const amount=value=>Number.isFinite(value)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value):'N/A';
function metric(name,value){
 const container=node('div');container.className='rebalance-metric';
 container.append(node('small',name),node('strong',value));return container;
}
function plotCurves(series){
 const NS='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(NS,'svg');
 svg.classList.add('rebalance-chart');
 svg.setAttribute('viewBox','0 0 860 290');
 svg.setAttribute('role','img');
 svg.setAttribute('aria-label','Historical simulated equity of rebalanced allocation compared with buy-and-hold benchmark');
 const curves=[series.strategy,series.benchmark];
 const combined=curves.flatMap(x=>x.map(p=>p.equity));
 const low=Math.min(...combined),high=Math.max(...combined);
 const span=Math.max(1e-6,high-low);
 const lastIndex=Math.max(1,...curves.flatMap(x=>x.map(p=>p.index)));
 for(const [i,points] of curves.entries()){
  const polyline=document.createElementNS(NS,'polyline');
  polyline.setAttribute('points',points.map(p=>{
   const x=20+820*p.index/lastIndex;
   const y=260-225*(p.equity-low)/span;
   return x.toFixed(2)+','+y.toFixed(2);
  }).join(' '));
  polyline.setAttribute('fill','none');
  polyline.setAttribute('stroke',i===0?'#66e5c2':'#879ef4');
  polyline.setAttribute('stroke-width','3');
  polyline.setAttribute('stroke-linejoin','round');
  svg.append(polyline);
 }
 return svg;
}
function allocationsTable(allocation){
 const table=node('table');table.className='rebalance-table';
 const header=node('tr');
 for(const heading of ['Asset','Target','Final weight','Value'])header.append(node('th',heading));
 table.append(header);
 for(const item of allocation.allocations){
  const row=node('tr');
  for(const value of [item.symbol,percent(item.targetWeight),percent(item.actualWeight),amount(item.value)])
   row.append(node('td',value));
  table.append(row);
 }
 return table;
}
function tradesTable(trades){
 const table=node('table');table.className='rebalance-table';
 const header=node('tr');
 for(const heading of ['Symbol','Side','Quantity','Fill','Fee'])header.append(node('th',heading));
 table.append(header);
 for(const item of trades.slice(-18).reverse()){
  const row=node('tr');
  for(const value of [item.symbol,item.side,item.quantity,amount(item.fillPrice),amount(item.fee)])
   row.append(node('td',value));
  table.append(row);
 }
 return table;
}
export function renderRebalance(output,report){
 output.replaceChildren();
 const heading=node('h3','Historical allocation results');
 output.append(heading);
 const metrics=node('div');metrics.className='rebalance-metrics';
 const active=report.performance.strategy,baseline=report.performance.baseline;
 metrics.append(
  metric('Rebalanced final equity',amount(active.finalEquity)),
  metric('Rebalanced total return',percent(active.totalReturn)),
  metric('Buy-and-hold total return',percent(baseline.totalReturn)),
  metric('Excess historical return',percent(report.performance.excessTotalReturn)),
  metric('Largest portfolio drawdown',percent(active.maxDrawdown)),
  metric('Rebalances executed',report.simulation.rebalanceExecutions),
  metric('Turnover multiple',report.costs.rebalance.turnoverMultiple.toFixed(2)+'×'),
  metric('Fees + slippage',amount(report.costs.rebalance.totalTransactionDrag))
 );
 output.append(metrics,plotCurves(report.performance.chart));
 const legend=node('p','Mint = scheduled rebalancing · Blue = passive buy-and-hold');
 legend.className='muted';output.append(legend);
 const distribution=node('article');
 distribution.append(node('h4','Final simulated asset allocation'),
  allocationsTable(report.simulation.finalHoldings),
  node('p','Uninvested cash: '+amount(report.simulation.finalCash)));
 output.append(distribution);
 const fills=node('article');fills.append(node('h4','Recent simulated transactions'));
 if(report.recentTrades.length)fills.append(tradesTable(report.recentTrades));
 else fills.append(node('p','No transaction fills recorded.'));
 output.append(fills);
 for(const warning of report.warnings){
  const element=node('p',warning);element.className='muted';output.append(element);
 }
}
$('#portfolio-rebalance-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const output=$('#portfolio-rebalance-output');
 const submit=$('#portfolio-rebalance-run');
 output.replaceChildren(node('p','Reading and validating aligned historical closes…'));
 submit.disabled=true;
 try{
  const form=new FormData(event.currentTarget);
  const file=form.get('file');
  if(!(file instanceof File)||file.size<10||file.size>500000)
   throw Error('Upload a historical CSV between 10 bytes and 500 KB');
  const assets=applyWeights(parsePortfolioCsv(await file.text()),String(form.get('weights')??''));
  const execution={};
  for(const key of ['initialCash','rebalanceEvery','feeBps','slippageBps','fixedFee'])
   execution[key]=Number(form.get(key));
  execution.driftThreshold=Number(form.get('driftThresholdPct'))/100;
  execution.fractionalShares=form.get('fractionalShares')==='on';
  const body={
   assets,execution,periodsPerYear:Number(form.get('periodsPerYear'))
  };
  const response=await fetch('/api/portfolio-rebalance',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Could not run portfolio allocation simulation');
  renderRebalance(output,result);
 }catch(error){output.replaceChildren(node('p',error.message))}
 finally{submit.disabled=false}
});
