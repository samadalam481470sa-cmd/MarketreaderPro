import {arithmeticMean,quantile,histogram} from './statistics.js';
export function portfolioReturns(returns,weights) {
  const len=returns[0].length;
  return Array.from({length:len},(_,index)=>
    returns.reduce((sum,series,i)=>sum+weights[i]*series[index],0));
}
export function equityPath(returns,dates) {
  let equity=1,peak=1,maxDrawdown=0,underwater=0,longestUnderwater=0;
  const curve=[{date:dates[0],value:1,drawdown:0}];
  for(let i=0;i<returns.length;i++){
    equity*=1+returns[i];
    if(!Number.isFinite(equity)||equity<0)throw Error('Invalid portfolio equity trajectory');
    peak=Math.max(peak,equity);
    const drawdown=peak>0?(peak-equity)/peak:0;
    maxDrawdown=Math.max(maxDrawdown,drawdown);
    underwater=drawdown>0?underwater+1:0;
    longestUnderwater=Math.max(longestUnderwater,underwater);
    curve.push({date:dates[i+1],value:equity,drawdown});
  }
  return {curve,maxDrawdown,longestUnderwater};
}
export function historicalTailRisk(values,confidence=0.95) {
  const sortedLosses=values.map(x=>-x).sort((a,b)=>a-b);
  const varValue=Math.max(0,quantile(sortedLosses,confidence));
  const count=Math.max(1,Math.ceil((1-confidence)*sortedLosses.length));
  const tail=sortedLosses.slice(-count);
  return {confidence,lossVarFraction:varValue,
    expectedShortfallFraction:Math.max(0,arithmeticMean(tail)),
    tailObservations:count,
    limitation:'Empirical historical loss quantiles are NOT probabilities of future losses and are unstable with short histories.'};
}
export function distributionMetrics(returns,annualization) {
  const mean=arithmeticMean(returns);
  const n=returns.length;
  const central=returns.map(x=>x-mean);
  const variance=central.reduce((sum,x)=>sum+x*x,0)/n;
  const sigma=Math.sqrt(variance);
  const downside=Math.sqrt(returns.reduce((sum,x)=>sum+Math.min(0,x)**2,0)/n);
  const moments={
    skewness:sigma>1e-12?central.reduce((sum,x)=>sum+x**3,0)/n/sigma**3:null,
    excessKurtosis:sigma>1e-12?central.reduce((sum,x)=>sum+x**4,0)/n/sigma**4-3:null
  };
  return {
    meanBarReturn:mean,medianBarReturn:quantile([...returns].sort((a,b)=>a-b),.5),
    annualizedArithmeticReturn:mean*annualization,
    dailyVolatility:sigma,annualizedVolatility:sigma*Math.sqrt(annualization),
    sharpe:sigma>1e-12?mean*Math.sqrt(annualization)/sigma:null,
    sortino:downside>1e-12?mean*Math.sqrt(annualization)/downside:null,
    bestBarReturn:Math.max(...returns),worstBarReturn:Math.min(...returns),
    positiveBarFraction:returns.filter(x=>x>0).length/n,...moments
  };
}
export function historicalRisk(returns,dates,options) {
  const total=portfolioReturns(returns,options.weights);
  const path=equityPath(total,dates);
  const sorted=total.map((value,i)=>({date:dates[i+1],return:value})).sort((a,b)=>a.return-b.return);
  const tail=historicalTailRisk(total,options.confidence);
  const sample=Math.max(0,Math.floor(options.periodsPerYear/20));
  return {
    returns:total,
    path,
    distribution:distributionMetrics(total,options.periodsPerYear),
    tailRisk:tail,
    worstObservedBars:sorted.slice(0,Math.min(5,sorted.length)),
    histogram:histogram(total,20),
    maxDrawdown:path.maxDrawdown,
    maxUnderwaterBars:path.longestUnderwater,
    compounding:'Fixed target weights rebalanced at each bar close, with no explicit trading costs or taxes.',
    warning:total.length<Math.max(60,sample)?'Short historical sample; tail estimates are especially unstable.':null
  };
}
