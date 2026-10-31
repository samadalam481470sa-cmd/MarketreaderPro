import {parseOhlcvCsv} from './csv.js';

const get = selector => document.querySelector(selector);
const element = (tag, content = '') => {
  const node = document.createElement(tag);
  node.textContent = String(content);
  return node;
};
function asPercent(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? (value * 100).toFixed(2) + '%' : 'N/A';
}
function money(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value)
    : 'N/A';
}
function metric(label,value) {
  const card = element('div');
  card.className='backtest-metric';
  card.append(element('small',label),element('strong',value));
  return card;
}
function drawEquity(data, benchmark) {
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 720 240');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Strategy equity compared to buy-and-hold benchmark in dollars');
  svg.classList.add('backtest-chart');
  const series=[data,benchmark].filter(arr=>arr.length>0);
  const values=series.flatMap(arr=>arr.map(x=>x.equity));
  const lo=Math.min(...values),hi=Math.max(...values);
  const range=Math.max(hi-lo,1e-10);
  for(const [index,arr] of series.entries()){
    const points=arr.map((row,i)=>{
      const x=20+680*(row.index/(Math.max(data.at(-1)?.index,benchmark.at(-1)?.index,1)));
      const y=218-192*(row.equity-lo)/range;
      return x.toFixed(2)+','+y.toFixed(2);
    }).join(' ');
    const line=document.createElementNS(NS,'polyline');
    line.setAttribute('points',points);
    line.setAttribute('fill','none');
    line.setAttribute('stroke',index===0?'#73e6c7':'#879dfa');
    line.setAttribute('stroke-width','3');
    line.setAttribute('stroke-linejoin','round');
    svg.append(line);
  }
  return svg;
}
function render(output,report){
  output.replaceChildren();
  const head=element('h3','Historical strategy report');
  const note=element('p',report.disclaimer);
  note.className='muted';
  output.append(head,note);
  const grid=element('div');grid.className='backtest-metrics';
  const active=report.strategyResult.equitySummary;
  const passive=report.benchmark.equitySummary;
  grid.append(
    metric('Strategy ending equity',money(active.finalEquity)),
    metric('Strategy total return',asPercent(active.totalReturn)),
    metric('Buy and hold return',asPercent(passive.totalReturn)),
    metric('Largest drawdown',asPercent(active.maxDrawdown)),
    metric('Maximum exposure',asPercent(report.strategyResult.diagnostic.exposureFraction)),
    metric('Paid simulation fees',money(report.strategyResult.tradeSummary.fees)),
    metric('Completed trades',report.strategyResult.tradeSummary.orders),
    metric('Sharpe estimate',active.sharpe===null?'N/A':active.sharpe.toFixed(2))
  );
  output.append(grid,drawEquity(report.strategyResult.equityCurve,report.benchmark.equityCurve));
  const legend=element('p','Green: strategy · Blue: next-open buy-and-hold');
  legend.className='muted';output.append(legend);
  if(report.stress){
    const stress=element('article');
    stress.append(element('h4','Historical resampling stress test'),
      element('p','5th–95th percentile of resampled returns: '+
        asPercent(report.stress.simulatedReturnQuantiles.p05)+' to '+
        asPercent(report.stress.simulatedReturnQuantiles.p95)),
      element('small',report.stress.caution));
    output.append(stress);
  }
  output.append(element('p','Orders fill at the NEXT bar open. All data was supplied by the user, not authenticated by this application.'));
}
get('#backtest-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const output=get('#backtest-result');
  const run=get('#backtest-run');
  output.replaceChildren(element('p','Validating and calculating historical results…'));
  run.disabled=true;
  try{
    const form=new FormData(event.currentTarget);
    const file=form.get('file');
    if(!(file instanceof File)||file.size<10||file.size>160000)throw Error('Select a historical CSV under 160 KB');
    const bars=parseOhlcvCsv(await file.text());
    const values={};
    for(const key of ['initialCash','feeBps','slippageBps','fastPeriod','slowPeriod','periodsPerYear'])
      values[key]=Number(form.get(key));
    values.strategy=form.get('strategy');
    values.trailingStopPct=Number(form.get('trailingStopPercent'))/100;
    const response=await fetch('/api/backtest',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({bars,options:values,stress:form.get('stress')==='on'})
    });
    const report=await response.json();
    if(!response.ok)throw Error(report.error||'Simulation could not be completed');
    render(output,report);
  }catch(error){
    output.replaceChildren(element('p',error.message));
  }finally{
    run.disabled=false;
  }
});
