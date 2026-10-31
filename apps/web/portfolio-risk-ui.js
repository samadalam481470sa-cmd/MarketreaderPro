import {parsePortfolioCsv,applyWeights} from './portfolio-csv.js';
const el=(tag,text='')=>{const x=document.createElement(tag);x.textContent=String(text);return x};
const get=selector=>document.querySelector(selector);
const pct=x=>typeof x==='number'&&Number.isFinite(x)?(x*100).toFixed(2)+'%':'N/A';
function card(name,value){const x=el('div');x.className='risk-lab-metric';x.append(el('small',name),el('strong',value));return x}
function buildCorrelation(data) {
  const table=el('table');table.className='correlation-table';
  const head=el('tr');head.append(el('th','Asset'));
  data.symbols.forEach(s=>head.append(el('th',s)));
  table.append(head);
  for(let i=0;i<data.symbols.length;i++){
    const row=el('tr');row.append(el('th',data.symbols[i]));
    for(let j=0;j<data.symbols.length;j++){
      const value=data.returns.correlation[i][j];
      row.append(el('td',value===null?'N/A':value.toFixed(2)));
    }
    table.append(row);
  }
  return table;
}
function display(node,result) {
  node.replaceChildren(el('h3','Portfolio risk assessment'));
  const m=el('div');m.className='portfolio-lab-metrics';
  const history=result.historical;
  m.append(
    card('Assets',result.exposure.numberOfAssets),
    card('Effective asset count',result.exposure.effectiveNumberOfAssets.toFixed(2)),
    card('Annualized volatility',pct(result.returns.annualizedPortfolioVolatility)),
    card('Max observed drawdown',pct(history.maxDrawdown)),
    card('Empirical one-bar VaR',pct(history.tailRisk.lossVarFraction)),
    card('Empirical expected shortfall',pct(history.tailRisk.expectedShortfallFraction))
  );
  node.append(m,el('h4','Historical correlation matrix'),buildCorrelation(result));
  const risk=el('article');risk.append(el('h4','Share of modeled portfolio variance'));
  for(const value of result.returns.varianceContributions){
    risk.append(el('p',value.symbol+': '+pct(value.fractionOfTotalVariance)));
  }
  node.append(risk);
  const stress=el('article');stress.append(el('h4','Hypothetical shock scenarios'));
  for(const x of result.stressScenarios){
    stress.append(el('p',x.name+': '+pct(x.assumedPortfolioReturn)+' portfolio return'));
  }
  node.append(stress);
  for(const message of result.disclaimers){
    const warning=el('p',message);warning.className='muted';node.append(warning);
  }
}
get('#portfolio-risk-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const output=get('#portfolio-risk-result'),button=get('#portfolio-risk-run');
  button.disabled=true;output.replaceChildren(el('p','Checking historical data alignment…'));
  try{
    const f=new FormData(event.currentTarget),file=f.get('file');
    if(!(file instanceof File)||file.size<10||file.size>500000)throw Error('Provide a CSV under 500 KB');
    const assets=applyWeights(parsePortfolioCsv(await file.text()),String(f.get('weights')||''));
    const body={assets,confidence:Number(f.get('confidence')),
      periodsPerYear:Number(f.get('periodsPerYear'))};
    const response=await fetch('/api/portfolio-risk',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Unable to analyze portfolio');
    display(output,result);
  }catch(e){output.replaceChildren(el('p',e.message))}
  finally{button.disabled=false}
});
