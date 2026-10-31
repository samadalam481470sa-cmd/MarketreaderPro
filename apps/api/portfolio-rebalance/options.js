/**
 * Historical multi-asset allocation research. No brokerage connectivity.
 * Reuse the existing portfolio risk validator for aligned, positive closes.
 */
export class RebalanceInputError extends Error {
  constructor(message){super(message);this.name='RebalanceInputError';this.status=422}
}
const fail=message=>{throw new RebalanceInputError(message)};
const number=(value,name,min,max,fallback)=>{
  const v=value===undefined?fallback:value;
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(name+' must be a finite number from '+min+' to '+max);
  return v;
};
const integer=(value,name,min,max,fallback)=>{
  const v=number(value,name,min,max,fallback);
  if(!Number.isSafeInteger(v))fail(name+' must be a whole number');
  return v;
};
export function validateRebalanceOptions(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Execution options must be an object');
 return Object.freeze({
   initialCash:number(raw.initialCash,'Initial cash',100,10000000,10000),
   feeBps:number(raw.feeBps,'Trading fee basis points',0,100,10),
   slippageBps:number(raw.slippageBps,'Slippage basis points',0,250,5),
   fixedFee:number(raw.fixedFee,'Flat per-order fee',0,50,0),
   rebalanceEvery:integer(raw.rebalanceEvery,'Rebalancing interval',1,252,21),
   driftThreshold:number(raw.driftThreshold,'Drift threshold',0,0.5,0.03),
   fractionalShares:raw.fractionalShares!==false,
   includeBaseline:raw.includeBaseline!==false,
   keepTrades:integer(raw.keepTrades,'Saved trade count',10,400,100),
   chartPoints:integer(raw.chartPoints,'Chart points',30,200,120)
 });
}
export function validateRunRequest(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('A portfolio allocation is required');
 if(payload.scenarios!==undefined)fail('Stress scenarios belong to the separate Portfolio Risk Lab');
 return validateRebalanceOptions(payload.execution);
}
