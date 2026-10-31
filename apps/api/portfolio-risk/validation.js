/**
 * Portfolio risk calculations require caller-supplied, consistently adjusted
 * historical close prices. No equity-market API is assumed to be connected.
 */
export class PortfolioRiskError extends Error {
  constructor(message) {
    super(message);
    this.name='PortfolioRiskError';
    this.status=422;
  }
}
const invalid=message=>{throw new PortfolioRiskError(message)};
function timestamp(value) {
  if(typeof value!=='string')invalid('All asset dates must be ISO strings');
  const normalized=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00Z':value;
  const parsed=Date.parse(normalized);
  if(!Number.isFinite(parsed))invalid('Invalid asset date');
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(parsed).toISOString().slice(0,10)!==value)
    invalid('Invalid calendar date');
  return parsed;
}
export function validatePortfolio(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))invalid('A portfolio object is required');
  const {assets}=payload;
  if(!Array.isArray(assets)||assets.length<2||assets.length>12)
    invalid('Portfolio must contain 2–12 assets');
  const symbols=new Set();
  let dates=null;
  let sum=0;
  const normalized=[];
  for(const item of assets){
    if(!item||typeof item!=='object'||typeof item.symbol!=='string'||
       !/^[A-Z0-9._-]{1,20}$/.test(item.symbol))
      invalid('Symbols must be uppercase and contain only letters, numbers, dots, underscores or hyphens');
    if(symbols.has(item.symbol))invalid('Duplicate symbol '+item.symbol);
    symbols.add(item.symbol);
    if(typeof item.weight!=='number'||!Number.isFinite(item.weight)||
       item.weight<=0||item.weight>1)
      invalid('Asset weights must be positive, finite fractions');
    sum+=item.weight;
    if(!Array.isArray(item.prices)||item.prices.length<35||item.prices.length>500)
      invalid('Each asset needs 35–500 historical close observations');
    if(dates&&item.prices.length!==dates.length)
      invalid('All assets must have an identical date set');
    const prices=[];
    const currentDates=[];
    let previous=-Infinity;
    for(const value of item.prices){
      if(!value||typeof value!=='object')invalid('Price observation must be an object');
      const t=timestamp(value.date);
      if(t<=previous)invalid('Each asset must be ordered by unique ascending dates');
      previous=t;
      if(typeof value.close!=='number'||!Number.isFinite(value.close)||
         value.close<=0||value.close>1e9)
        invalid('Historical closing prices must be finite and strictly positive');
      currentDates.push(t);prices.push(value.close);
    }
    if(!dates)dates=currentDates;
    else if(!currentDates.every((date,i)=>date===dates[i]))
      invalid('Asset dates must match exactly; no implicit forward filling');
    normalized.push({symbol:item.symbol,weight:item.weight,prices});
  }
  if(Math.abs(sum-1)>1e-6)invalid('Asset weights must sum to 1.0');
  const periodsPerYear=payload.periodsPerYear??252;
  if(!Number.isSafeInteger(periodsPerYear)||periodsPerYear<1||periodsPerYear>365000)
    invalid('Annualization periods must be a positive integer');
  const confidence=payload.confidence??0.95;
  if(typeof confidence!=='number'||!Number.isFinite(confidence)||
     confidence<0.8||confidence>0.99)
    invalid('Historical risk confidence must be between 0.80 and 0.99');
  return {
    assets:normalized,
    dates:dates.map(x=>new Date(x).toISOString()),
    weights:normalized.map(x=>x.weight),
    periodsPerYear,
    confidence
  };
}
export function validateStressScenarios(value,assets) {
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>10)invalid('At most 10 user-supplied stress scenarios');
  const allowed=new Set(assets.map(x=>x.symbol));
  return value.map((item,i)=>{
    if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||
       !item.shocks||typeof item.shocks!=='object'||Array.isArray(item.shocks))
      invalid('Stress scenario '+(i+1)+' must have a name and shock values');
    const shocks={};
    for(const [symbol,shock] of Object.entries(item.shocks)){
      if(!allowed.has(symbol))invalid('Stress scenario refers to unknown symbol '+symbol);
      if(typeof shock!=='number'||!Number.isFinite(shock)||shock< -1||shock>5)
        invalid('Stress shocks must be between -100% and +500%');
      shocks[symbol]=shock;
    }
    return {name:item.name.trim(),shocks};
  });
}
