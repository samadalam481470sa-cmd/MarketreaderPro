import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRebalanceOptions} from '../apps/api/portfolio-rebalance/options.js';
import {runPortfolioRebalance} from '../apps/api/portfolio-rebalance/engine.js';
import {allocationDrift,weightEntropy} from '../apps/api/portfolio-rebalance/analytics.js';
import {createLedger} from '../apps/api/portfolio-rebalance/ledger.js';

const timestamp=i=>new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10);
function input({size=90,returns=[0.004,-0.001,0.002],weights=[0.6,0.4],options={}}={}){
  const prices=(base,rate)=>Array.from({length:size},(_,i)=>({
    date:timestamp(i),close:base*Math.pow(1+rate,i)
  }));
  return {
    assets:[
      {symbol:'AAA',weight:weights[0],prices:prices(100,returns[0])},
      {symbol:'BBB',weight:weights[1],prices:prices(70,returns[1])}
    ],
    execution:{initialCash:10000,feeBps:10,slippageBps:5,
      rebalanceEvery:7,driftThreshold:0.01,...options}
  };
}
test('defaults are bounded and reject invalid/non-finite cost options',()=>{
 assert.equal(validateRebalanceOptions().initialCash,10000);
 assert.equal(validateRebalanceOptions().rebalanceEvery,21);
 assert.throws(()=>validateRebalanceOptions({rebalanceEvery:0}),/interval/i);
 assert.throws(()=>validateRebalanceOptions({feeBps:NaN}),/finite/);
 assert.throws(()=>validateRebalanceOptions({fixedFee:-1}),/Flat/);
 assert.throws(()=>validateRebalanceOptions({fractionalShares:true,driftThreshold:2}),/Drift/);
});
test('two asset ledger respects no-margin and long-only invariants',()=>{
 const validated=input();
 const options=validateRebalanceOptions(validated.execution);
 const p={assets:validated.assets,weights:[0.6,0.4]};
 const ledger=createLedger(p,options);
 ledger.buyInitial([100,70]);
 const first=ledger.assertInvariants([100,70]);
 assert.ok(first.equity<=10000);
 assert.ok(ledger.state.cash>=0);
 assert.ok(ledger.state.shares.every(x=>x>=0));
 ledger.rebalance([130,60]);
 const second=ledger.assertInvariants([130,60]);
 assert.ok(second.equity>0);
 assert.ok(ledger.state.shares.every(x=>x>=0));
 assert.ok(ledger.state.orders>=2);
});
test('zero fee and constant price yields unchanged equity despite rebalancing',()=>{
 const payload=input({returns:[0,0],options:{
  feeBps:0,slippageBps:0,fixedFee:0,rebalanceEvery:1,driftThreshold:0
 }});
 const r=runPortfolioRebalance(payload);
 assert.ok(Math.abs(r.performance.strategy.finalEquity-10000)<.02);
 assert.ok(Math.abs(r.performance.baseline.finalEquity-10000)<.02);
 assert.equal(r.costs.rebalance.fees,0);
 assert.equal(r.costs.rebalance.slippageCost,0);
 assert.equal(r.simulation.rebalanceSignals,0);
});
test('nonzero costs cannot create money from flat prices',()=>{
 const payload=input({returns:[0,0],options:{
  initialCash:10000,feeBps:50,slippageBps:50,fixedFee:1
 }});
 const r=runPortfolioRebalance(payload);
 assert.ok(r.performance.strategy.finalEquity<10000);
 assert.ok(r.costs.rebalance.totalTransactionDrag>0);
 assert.ok(r.performance.baseline.finalEquity<10000);
});
test('simulates drift-controlled rebalancing only after a completed close',()=>{
 const r=runPortfolioRebalance(input({returns:[0.012,-0.008],options:{
  rebalanceEvery:5,driftThreshold:.002,feeBps:0,slippageBps:0
 }}));
 assert.ok(r.simulation.rebalanceSignals>0);
 assert.ok(r.simulation.rebalanceExecutions>0);
 assert.ok(r.recentRebalanceEvents.length>0);
 for(const entry of r.recentRebalanceEvents){
  assert.ok(Date.parse(entry.executionDate)>Date.parse(entry.signalDate));
  assert.ok(entry.detectedDrift>.002);
 }
 assert.equal(r.simulation.openSignalAfterLastBar,false);
});
test('benchmark never sells or rebalances, unlike drift-controlled strategy',()=>{
 const r=runPortfolioRebalance(input({returns:[0.02,-0.01],options:{
  rebalanceEvery:2,driftThreshold:0,feeBps:0,slippageBps:0
 }}));
 assert.equal(r.costs.benchmark.orders,2);
 assert.ok(r.costs.rebalance.orders>r.costs.benchmark.orders);
 assert.ok(r.costs.rebalance.turnoverMultiple>=r.costs.benchmark.turnoverMultiple);
});
test('trades are bounded, attributed to real symbol set and sized safely',()=>{
 const r=runPortfolioRebalance(input({options:{
  rebalanceEvery:1,driftThreshold:0,fractionalShares:false,keepTrades:20
 }}));
 assert.ok(r.recentTrades.length<=20);
 assert.ok(r.recentTrades.every(x=>['AAA','BBB'].includes(x.symbol)));
 assert.ok(r.recentTrades.every(x=>Number.isInteger(x.quantity)));
 assert.ok(r.performance.chart.strategy.length<=120);
 assert.ok(r.costs.rebalance.fees>=0);
});
test('prior execution and previous dated observation cannot be changed by a future price',()=>{
 const a=input({returns:[0.005,-0.003],options:{rebalanceEvery:3,driftThreshold:.001}});
 const b=structuredClone(a);
 b.assets[1].prices.at(-1).close*=10;
 const original=runPortfolioRebalance(a);
 const changed=runPortfolioRebalance(b);
 const initial=original.performance.chart.strategy[10].equity;
 assert.equal(initial,changed.performance.chart.strategy[10].equity);
 assert.deepEqual(original.recentRebalanceEvents.filter(e=>e.executionDate<timestamp(88)),
   changed.recentRebalanceEvents.filter(e=>e.executionDate<timestamp(88)));
});
test('weights and source data must be validated, not invented',()=>{
 const invalid=input();
 invalid.assets[1].weight=.1;
 assert.throws(()=>runPortfolioRebalance(invalid),/sum to 1/);
 const negative=input();negative.assets[1].prices[20].close=-100;
 assert.throws(()=>runPortfolioRebalance(negative),/strictly positive/);
 const dates=input();dates.assets[1].prices[23].date='2025-05-25';
 assert.throws(()=>runPortfolioRebalance(dates),/dates|ordered/);
});
test('concentration and entropy are interpretable and finite',()=>{
 const result=weightEntropy([0.6,0.4]);
 assert.ok(result.effectiveAssetsByEntropy>1&&result.effectiveAssetsByEntropy<2);
 assert.ok(result.effectiveAssetsByConcentration>1&&result.effectiveAssetsByConcentration<2);
 assert.ok(allocationDrift({allocations:[{actualWeight:.55,targetWeight:.6},
   {actualWeight:.42,targetWeight:.4}]})>.049);
});
