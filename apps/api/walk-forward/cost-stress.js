import {runPortfolioRebalance} from '../portfolio-rebalance/engine.js';
/**
 * Replays identical held-out bars with identical training-only weights under
 * multiple transaction-cost assumptions. Training is NEVER recomputed with
 * held-out data. Simulation does not represent actual broker fills.
 */
export function costSensitivity(portfolio,folds,methods,execution,{maxScenarios=3}={}){
 const levels=[0,1,2].slice(0,maxScenarios);
 const scenarios=levels.map(level=>{
  const feeBps=level===0?0:level===1?execution.feeBps:Math.min(100,execution.feeBps+25);
  const slippageBps=level===0?0:level===1?execution.slippageBps:
   Math.min(250,execution.slippageBps+50);
  const result={label:['zero-friction','configured-costs','higher-cost-stress'][level],
   feeBps,slippageBps,methods:{}};
  for(const method of methods){
   const observations=[];
   for(const fold of folds){
    const start=portfolio.dates.indexOf(fold.firstTestObservation);
    const count=fold.testingObservations;
    const weightBySymbol=new Map(fold.evaluations[method].weights.map(w=>[w.symbol,w.weight]));
    const assets=portfolio.assets.map(a=>({
     symbol:a.symbol,weight:weightBySymbol.get(a.symbol),
     prices:a.prices.slice(start,start+count).map((close,i)=>({
      date:portfolio.dates[start+i],close
     }))
    }));
    const simulation=runPortfolioRebalance({
     assets,periodsPerYear:portfolio.periodsPerYear,
     execution:{...execution,feeBps,slippageBps,keepTrades:10,chartPoints:30}
    });
    observations.push({
     fold:fold.fold,
     totalReturn:simulation.performance.strategy.totalReturn,
     transactionDrag:simulation.costs.rebalance.totalTransactionDrag
    });
   }
   result.methods[method]={
    folds:observations.length,
    averageOutOfSampleReturn:observations.reduce((a,b)=>a+b.totalReturn,0)/observations.length,
    averageTransactionDrag:observations.reduce((a,b)=>a+b.transactionDrag,0)/observations.length,
    details:observations
   };
  }
  return result;
 });
 return {
  scenarios,
  caveat:'Sensitivity outcomes are historical simulated costs on identical held-out bars, not broker quotes, predictions, or trading recommendations.'
 };
}
