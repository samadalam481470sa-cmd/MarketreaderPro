/**
 * Historical public-market research lab.
 * Pure functions; no brokerage access, no use of future data for decisions.
 * Values represent implied probabilities, NOT executable market prices.
 */
const invalid=message=>Object.assign(new Error(message),{status:422});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateSeries(observations,{min=3,max=2000}={}){
 if(!Array.isArray(observations)||observations.length<min||observations.length>max)throw invalid('Historical series length out of range');
 let last=-Infinity;const result=[];
 for(const entry of observations){
  const time=typeof entry.at==='number'?entry.at:Date.parse(entry.at);
  const probability=Number(entry.probability);
  if(!Number.isFinite(time)||!finite(probability)||probability<0||probability>1)throw invalid('Invalid timestamp or implied probability');
  if(time<=last)throw invalid('Observations must be unique and strictly time ordered');
  last=time;result.push({at:time,probability});
 }
 return result;
}
export function rollingStatistics(series,window=10){
 if(!Number.isSafeInteger(window)||window<2||window>500)throw invalid('Invalid rolling window');
 const rows=validateSeries(series);
 let sum=0,sumSquare=0;const out=[];
 for(let i=0;i<rows.length;i++){
  const x=rows[i].probability;sum+=x;sumSquare+=x*x;
  if(i>=window){const prev=rows[i-window].probability;sum-=prev;sumSquare-=prev*prev}
  if(i<window-1)continue;
  const mean=sum/window,variance=Math.max(0,sumSquare/window-mean*mean);
  out.push({at:rows[i].at,mean,standardDeviation:Math.sqrt(variance),
   lower:Math.max(0,mean-2*Math.sqrt(variance)),upper:Math.min(1,mean+2*Math.sqrt(variance))});
 }
 return out;
}
export function describeSeries(observations){
 const rows=validateSeries(observations);
 let max=rows[0].probability,min=max,high=max,maxDrawdown=0,changes=0,sum=0,squares=0;
 for(let i=1;i<rows.length;i++){
  const v=rows[i].probability;min=Math.min(min,v);max=Math.max(max,v);high=Math.max(high,v);
  maxDrawdown=Math.max(maxDrawdown,high-v);
  const delta=v-rows[i-1].probability;sum+=delta;squares+=delta*delta;changes++;
 }
 const avg=sum/changes,variance=Math.max(0,squares/changes-avg*avg);
 return {observations:rows.length,start:new Date(rows[0].at).toISOString(),
  end:new Date(rows.at(-1).at).toISOString(),first:rows[0].probability,
  latest:rows.at(-1).probability,min,max,momentum:rows.at(-1).probability-rows[0].probability,
  maxPeakToTroughProbabilityDrop:maxDrawdown,averageStepChange:avg,
  stepVolatility:Math.sqrt(variance),
  caution:'These metrics describe shifts in market-implied probabilities, not investment returns.'};
}
export function identifyAnomalies(observations,{window=8,threshold=3}={}){
 const rows=validateSeries(observations,{min:5});
 if(!Number.isInteger(window)||window<3||window>100||!finite(threshold)||threshold<1||threshold>10)throw invalid('Invalid anomaly configuration');
 const detected=[];
 for(let i=window;i<rows.length;i++){
  // Baseline includes only historical deltas preceding the candidate.
  const prior=[];
  for(let j=i-window+1;j<i;j++)prior.push(rows[j].probability-rows[j-1].probability);
  const mean=prior.reduce((a,b)=>a+b,0)/prior.length;
  const stdev=Math.sqrt(prior.reduce((a,b)=>a+(b-mean)**2,0)/prior.length);
  const candidate=rows[i].probability-rows[i-1].probability;
  const z=stdev>1e-8?Math.abs((candidate-mean)/stdev):Math.abs(candidate-mean)>0.01?Infinity:0;
  if(z>=threshold)detected.push({at:new Date(rows[i].at).toISOString(),probability:rows[i].probability,
   change:candidate,zScore:Number.isFinite(z)?z:null,reason:'Unusual movement relative to preceding observations'});
 }
 return detected.slice(-100);
}
export function walkForwardBaseline(observations,{trainMinimum=15,maxHorizon=1}={}){
 const rows=validateSeries(observations,{min:18});
 if(!Number.isInteger(trainMinimum)||trainMinimum<10||trainMinimum>=rows.length-2)throw invalid('Insufficient calibration observations');
 if(maxHorizon!==1)throw invalid('Only one-step-ahead historical evaluation is supported');
 const errors={persistence:[],meanChange:[]},predictions=[];
 for(let i=trainMinimum;i<rows.length-1;i++){
  // At time i, all features/training are from observations <= i.
  // The target at i+1 is ONLY used after computing this prediction.
  const history=rows.slice(0,i+1);
  const differences=history.slice(1).map((o,j)=>o.probability-history[j].probability);
  const mean=differences.reduce((a,b)=>a+b,0)/differences.length;
  const current=history.at(-1).probability,target=rows[i+1].probability;
  const baseline=current,trend=Math.max(0,Math.min(1,current+mean));
  errors.persistence.push((baseline-target)**2);errors.meanChange.push((trend-target)**2);
  predictions.push({asOf:new Date(rows[i].at).toISOString(),
   evaluatedAt:new Date(rows[i+1].at).toISOString(),actual:target,persistence:baseline,meanChange:trend});
 }
 const mse=name=>errors[name].reduce((a,b)=>a+b,0)/errors[name].length;
 const improvement=mse('persistence')-mse('meanChange');
 return {samples:predictions.length,baselineMSE:mse('persistence'),
  candidateMSE:mse('meanChange'),candidateOutperformed:improvement>0,
  relativeImprovement:Math.abs(mse('persistence'))>1e-12?improvement/mse('persistence'):0,
  predictions:predictions.slice(-50),guardrail:'Walk-forward evaluation uses only observations available at each forecast time; no execution strategy or profitability implied.'};
}
export function buildHistoricalResearch(observations,{rollingWindow=10,includePredictions=false}={}){
 const rows=validateSeries(observations);
 const report={summary:describeSeries(rows),rolling:rollingStatistics(rows,rollingWindow).slice(-100),
   anomalies:rows.length>=5?identifyAnomalies(rows):[],model:null,
   disclaimer:'Historical public prediction-market probabilities may be sparse, delayed, and non-executable. Not investment advice.'};
 if(includePredictions&&rows.length>=18)report.model=walkForwardBaseline(rows);
 return report;
}
