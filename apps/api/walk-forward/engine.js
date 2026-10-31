import {validatePortfolio} from '../portfolio-risk/validation.js';
import {runPortfolioRebalance} from '../portfolio-rebalance/engine.js';
import {validateRebalanceOptions} from '../portfolio-rebalance/options.js';
import {planFolds,validateWalkForwardOptions} from './options.js';
import {calculateTrainingWeights,trainingDiagnostics} from './weights.js';

/**
 * Strictly causal walk-forward research.
 * Every portfolio's weights for fold k are learned from observations ending
 * BEFORE the first out-of-sample observation of fold k.
 */
export function runWalkForward(input){
 const portfolio=validatePortfolio(input);
 const options=validateWalkForwardOptions(input.walkForward,portfolio.dates.length);
 const execution=validateRebalanceOptions(input.execution??{});
 const plans=planFolds(portfolio.dates.length,options);
 const methods=options.algorithms;
 const folds=[];
 for(const plan of plans){
  const train=portfolio.assets.map(a=>({
   symbol:a.symbol,prices:a.prices.slice(plan.trainStart,plan.trainEndExclusive)
    .map((close,i)=>({date:portfolio.dates[plan.trainStart+i],close}))
  }));
  const test=portfolio.assets.map(a=>({
   symbol:a.symbol,prices:a.prices.slice(plan.testStart,plan.testEndExclusive)
    .map((close,i)=>({date:portfolio.dates[plan.testStart+i],close}))
  }));
  const evaluations={};
  const trainLast=portfolio.dates[plan.trainEndExclusive-1];
  const testFirst=portfolio.dates[plan.testStart];
  for(const method of methods){
   const weights=calculateTrainingWeights(train,method,options);
   const evaluated=runPortfolioRebalance({
    assets:test.map((asset,i)=>({...asset,weight:weights[i]})),
    periodsPerYear:portfolio.periodsPerYear,
    execution:{...execution,keepTrades:20,chartPoints:40}
   });
   evaluations[method]={
    weights:trainingDiagnostics(train,weights),
    totalReturn:evaluated.performance.strategy.totalReturn,
    passiveReturn:evaluated.performance.baseline.totalReturn,
    maxDrawdown:evaluated.performance.strategy.maxDrawdown,
    transactionDrag:evaluated.costs.rebalance.totalTransactionDrag,
    orders:evaluated.costs.rebalance.orders,
    finalEquity:evaluated.performance.strategy.finalEquity
   };
  }
  folds.push({
   fold:plan.fold,
   trainStart:portfolio.dates[plan.trainStart],
   trainEnd:trainLast,
   firstTestObservation:testFirst,
   testEnd:portfolio.dates[plan.testEndExclusive-1],
   purgedBars:options.purgeGapBars,
   trainingObservations:options.trainingBars,
   testingObservations:options.testingBars,
   evaluations
  });
 }
 const metrics={};
 for(const method of methods){
  const rows=folds.map(f=>f.evaluations[method]);
  const average=key=>rows.reduce((sum,item)=>sum+item[key],0)/rows.length;
  metrics[method]={
   folds:folds.length,
   averageOutOfSampleReturn:average('totalReturn'),
   averageOutOfSampleDrawdown:average('maxDrawdown'),
   averageTransactionDrag:average('transactionDrag'),
   averagePassiveReturn:average('passiveReturn'),
   positiveFoldShare:rows.filter(x=>x.totalReturn>0).length/rows.length,
   outperformingPassiveShare:rows.filter(x=>x.totalReturn>x.passiveReturn).length/rows.length
  };
 }
 const selected=methods.map(method=>({method,...metrics[method]}))
  .sort((a,b)=>b.averageOutOfSampleReturn-a.averageOutOfSampleReturn);
 return {
  mode:'historical-out-of-sample-walk-forward',
  dataset:'User supplied, unverified close histories',
  dateRange:{first:portfolio.dates[0],last:portfolio.dates.at(-1)},
  methods,
  configuration:options,
  executionAssumptions:{
   feesBps:execution.feeBps,slippageBps:execution.slippageBps,
   firstFill:'First available test close, after training window and purge gap',
   interval:execution.rebalanceEvery,initialCashPerFold:execution.initialCash
  },
  folds,metrics,
  descriptiveRanking:selected,
  interpretation:'Arithmetic fold averages are not compounded deployable portfolio returns.',
  warnings:[
   'Selection of a best-performing method on the same test folds creates model-selection bias.',
   'Use new untouched data before trusting a favored algorithm.',
   'The evaluation uses no out-of-sample prices when calculating fold weights.',
   'Purged bars are intentionally excluded from training and test data.',
   'Close fills, fees and slippage are simplified simulations, not executable quotes.',
   'Results are historical research, not calibrated forecasts or investment advice.'
  ]
 };
}
