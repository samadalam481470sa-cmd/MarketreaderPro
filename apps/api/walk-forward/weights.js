import {WalkForwardError} from './options.js';
const normalize=raw=>{
 if(raw.some(x=>!Number.isFinite(x)||x<0))throw new WalkForwardError('Nonfinite candidate weights');
 const sum=raw.reduce((a,b)=>a+b,0);
 if(sum<=0)throw new WalkForwardError('All candidate weights vanished');
 return raw.map(x=>x/sum);
};
const average=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
function historicalReturns(asset){
 const prices=asset.prices;
 const returns=[];
 for(let i=1;i<prices.length;i++){
  const change=prices[i].close/prices[i-1].close-1;
  if(!Number.isFinite(change))throw new WalkForwardError('Invalid historical training observation');
  returns.push(change);
 }
 return returns;
}
function stdev(values){
 const mean=average(values);
 return Math.sqrt(Math.max(0,average(values.map(x=>(x-mean)**2))));
}
function boundConcentration(weights){
 // Blend in 10% equal weight before clipping. This leaves strictly positive
 // weights for the existing long-only portfolio validator.
 const n=weights.length,equal=1/n;
 const out=weights.map(w=>0.9*w+0.1*equal);
 // Redistribution of excess concentration, conservatively capped at 80%.
 const cap=0.8;
 for(let pass=0;pass<n+2;pass++){
  const capped=out.map((x,i)=>x>cap?i:-1).filter(i=>i>=0);
  if(!capped.length)break;
  const excess=capped.reduce((s,i)=>s+out[i]-cap,0);
  for(const i of capped)out[i]=cap;
  const available=out.map((w,i)=>w<cap-1e-12?i:-1).filter(i=>i>=0);
  if(!available.length)throw new WalkForwardError('Cannot redistribute concentration');
  const room=available.reduce((a,i)=>a+cap-out[i],0);
  if(room<excess-1e-8)throw new WalkForwardError('Target concentration is infeasible');
  for(const i of available)out[i]+=excess*(cap-out[i])/room;
 }
 return normalize(out);
}
export function calculateTrainingWeights(assets,method,{volatilityFloor=.001}={}){
 if(!Array.isArray(assets)||assets.length<2)
  throw new WalkForwardError('Training weights require multiple aligned assets');
 const n=assets.length;
 if(method==='equal-weight')return Array(n).fill(1/n);
 if(method==='inverse-volatility'){
  const inverse=assets.map(asset=>{
   const vol=stdev(historicalReturns(asset));
   return 1/Math.max(vol,volatilityFloor);
  });
  return boundConcentration(normalize(inverse));
 }
 if(method==='momentum-tilt'){
  const scores=assets.map(asset=>{
   const start=asset.prices[0].close,end=asset.prices.at(-1).close;
   const move=end/start-1;
   // Clamp extreme moves before applying exponential softmax.
   return Math.max(-1,Math.min(1,move));
  });
  const scoresExp=scores.map(s=>Math.exp(Math.max(-6,Math.min(6,3*s))));
  return boundConcentration(normalize(scoresExp));
 }
 throw new WalkForwardError('Unsupported training algorithm');
}
export function trainingDiagnostics(assets,weights){
 return assets.map((asset,i)=>{
  const returns=historicalReturns(asset);
  return {symbol:asset.symbol,weight:weights[i],
   trainingVolatilityPerBar:stdev(returns),
   observedTrainingReturn:asset.prices.at(-1).close/asset.prices[0].close-1};
 });
}
