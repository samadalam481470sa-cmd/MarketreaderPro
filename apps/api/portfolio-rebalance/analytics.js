import {summarizeEquity,downsampleEquity} from '../backtest/metrics.js';
const sum=values=>values.reduce((a,b)=>a+b,0);
export function allocationSnapshot(state,prices,assets){
 const investments=prices.map((price,i)=>state.shares[i]*price);
 const equity=state.cash+sum(investments);
 return {
  equity,
  cash:state.cash,
  cashWeight:equity>0?state.cash/equity:0,
  allocations:assets.map((asset,i)=>({
   symbol:asset.symbol,
   actualWeight:equity>0?investments[i]/equity:0,
   targetWeight:asset.weight,
   value:investments[i]
  }))
 };
}
export function allocationDrift(snapshot){
 return snapshot.allocations.reduce((maximum,a)=>
  Math.max(maximum,Math.abs(a.actualWeight-a.targetWeight)),0);
}
export function rebalancePerformance(equity,benchmark,initialCash,periodsPerYear,chartPoints){
 const strategy=summarizeEquity(equity,initialCash,periodsPerYear);
 const baseline=summarizeEquity(benchmark,initialCash,periodsPerYear);
 return {
  strategy,baseline,
  excessTotalReturn:strategy.totalReturn-baseline.totalReturn,
  finalEquityDifference:strategy.finalEquity-baseline.finalEquity,
  simulationAssumption:'No dividends, FX, corporate actions, taxes, financing, or bid-ask liquidity verification.',
  chart:{
   strategy:downsampleEquity(equity,chartPoints),
   benchmark:downsampleEquity(benchmark,chartPoints)
  }
 };
}
export function summarizeLedger(ledger,initialCash){
 const trades=ledger.trades;
 const bySymbol=Object.entries(ledger.costBySymbol).map(([symbol,transactionDrag])=>({
  symbol,transactionDrag,
  notional:sum(trades.filter(t=>t.symbol===symbol).map(t=>t.notional)),
  orders:trades.filter(t=>t.symbol===symbol).length
 }));
 return {
  orders:ledger.orders,
  ignoredOrders:ledger.ignoredOrders,
  grossTradingNotional:ledger.totalNotional,
  turnoverMultiple:initialCash>0?ledger.totalNotional/initialCash:null,
  fees:ledger.fees,
  slippageCost:ledger.slippageCost,
  totalTransactionDrag:ledger.fees+ledger.slippageCost,
  bySymbol
 };
}
export function weightEntropy(weights){
 let entropy=0;
 for(const w of weights){if(w>0)entropy-=w*Math.log(w)}
 return {entropy,effectiveAssetsByEntropy:Math.exp(entropy),
  concentrationIndex:sum(weights.map(w=>w*w)),
  effectiveAssetsByConcentration:1/sum(weights.map(w=>w*w))};
}
