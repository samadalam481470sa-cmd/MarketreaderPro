import {validatePortfolio} from '../portfolio-risk/validation.js';
import {validateRunRequest,RebalanceInputError} from './options.js';
import {createLedger} from './ledger.js';
import {allocationSnapshot,allocationDrift,rebalancePerformance,summarizeLedger,weightEntropy} from './analytics.js';

/**
 * Long-only close-based historical simulation:
 * - initial purchase at the first observed close, with costs;
 * - after observing a completed close at index t-1, decide whether to rebalance;
 * - if due, fill at close[t], not close[t-1];
 * - mark all positions to market after the fill, and continue until final close.
 *
 * This does not imply closing prices were necessarily accessible for executable
 * real orders. User-supplied data are not authenticated. No future observations
 * are used to TRIGGER a rebalancing decision.
 */
export function runPortfolioRebalance(payload){
 const portfolio=validatePortfolio(payload);
 const options=validateRunRequest(payload);
 const bars=portfolio.assets[0].prices.length;
 const pricesAt=index=>portfolio.assets.map(asset=>asset.prices[index]);
 const assets=portfolio.assets.map((asset,i)=>({
  symbol:asset.symbol,
  weight:portfolio.weights[i]
 }));
 const active=createLedger(portfolio,options);
 const benchmark=createLedger(portfolio,options);
 active.buyInitial(pricesAt(0));
 benchmark.buyInitial(pricesAt(0),'benchmark-entry');
 active.assertInvariants(pricesAt(0));
 benchmark.assertInvariants(pricesAt(0));
 const equity=[],benchmarkEquity=[],rebalanceEvents=[];
 let triggers=0,executions=0,skippedForDrift=0,signalsPending=null;
 let currentDrift=0;
 for(let i=0;i<bars;i++){
  const prices=pricesAt(i);
  if(signalsPending!==null){
   // This order was triggered using only the PRECEDING completed close.
   const before=active.state.orders;
   active.rebalance(prices,'one-bar-delayed-target-rebalance');
   if(active.state.orders>before)executions++;
   rebalanceEvents.push({
    signalDate:portfolio.dates[i-1],
    executionDate:portfolio.dates[i],
    detectedDrift:signalsPending,
    orders:active.state.orders-before
   });
   signalsPending=null;
  }
  const a=active.assertInvariants(prices);
  const b=benchmark.assertInvariants(prices);
  equity.push({
   index:i,at:portfolio.dates[i],equity:a.equity,
   cash:a.cash,invested:a.equity-a.cash
  });
  benchmarkEquity.push({
   index:i,at:portfolio.dates[i],equity:b.equity,
   cash:b.cash,invested:b.equity-b.cash
  });
  const allocation=allocationSnapshot(active.state,prices,assets);
  currentDrift=allocationDrift(allocation);
  // A rebalance signal is recorded at the finished close. Next observation
  // is the earliest possible fill in this close-only dataset.
  if(i>0 && i<bars-1 && i%options.rebalanceEvery===0){
   // Ignore residual numerical/share-rounding dust. A zero user threshold means
   // rebalance for meaningful drift, not single-microshare differences.
   if(currentDrift>Math.max(options.driftThreshold,1e-6)){
    triggers++;
    signalsPending=currentDrift;
   }else skippedForDrift++;
  }
 }
 const lastPrices=pricesAt(bars-1);
 const lastAllocation=allocationSnapshot(active.state,lastPrices,assets);
 const performance=rebalancePerformance(equity,benchmarkEquity,options.initialCash,
  portfolio.periodsPerYear,options.chartPoints);
 const report={
  mode:'historical-multi-asset-rebalance-simulation',
  source:'User-uploaded closing prices; source authenticity not checked',
  period:{first:portfolio.dates[0],last:portfolio.dates.at(-1),observations:bars},
  strategy:{
   name:'scheduled-drift-controlled-rebalance',
   intervalBars:options.rebalanceEvery,
   driftThreshold:options.driftThreshold,
   signalTiming:'Completed previous close; subsequent close execution',
   longOnly:true,
   noLeverage:true,
   targetWeights:assets,
   fractionShares:options.fractionalShares,
   feesBps:options.feeBps,
   slippageBps:options.slippageBps,
   flatFee:options.fixedFee
  },
  simulation:{
   initialCash:options.initialCash,
   rebalanceSignals:triggers,
   rebalanceExecutions:executions,
   intervalChecksSkippedForDrift:skippedForDrift,
   openSignalAfterLastBar:false,
   finalCash:active.state.cash,
   finalHoldings:lastAllocation,
   finalBenchmarkCash:benchmark.state.cash,
   benchmarkName:'cost-adjusted buy-and-hold',
   portfolioDiversification:weightEntropy(portfolio.weights)
  },
  performance,
  costs:{
   rebalance:summarizeLedger(active.state,options.initialCash),
   benchmark:summarizeLedger(benchmark.state,options.initialCash)
  },
  recentTrades:active.state.trades.slice(-options.keepTrades),
  recentRebalanceEvents:rebalanceEvents.slice(-80),
  warnings:[
   'Historical price data are user supplied and have not been independently verified.',
   'Next CLOSE execution is an approximation. Real closing auctions, liquidity, spreads and fills may differ.',
   'No same-close information is used to trigger execution at that same close.',
   'Corporate actions, dividends, interest on idle cash, financing and taxes are not modeled.',
   'All statistics describe historical observations, not predictive probabilities or investment advice.'
  ]
 };
 if(!Number.isFinite(report.performance.strategy.finalEquity)||report.performance.strategy.finalEquity<0)
  throw new RebalanceInputError('Portfolio backtest produced invalid equity');
 return report;
}
