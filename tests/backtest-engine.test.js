import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBars, validateOptions, validateBacktestInput } from '../apps/api/backtest/validation.js';
import { simpleMovingAverage, exponentialMovingAverage, relativeStrengthIndex,
  momentum, annualizedHistoricalVolatility, averageTrueRange } from '../apps/api/backtest/indicators.js';
import { signalAt } from '../apps/api/backtest/strategy.js';
import { simulate } from '../apps/api/backtest/engine.js';
import { bootstrapScenarios } from '../apps/api/backtest/stress.js';
import { runBacktest } from '../apps/api/backtest/index.js';

const start = Date.parse('2025-01-01T00:00:00Z');
const bars = Array.from({length:80}, (_,i) => {
  const prior = 100 + i*.9;
  const open = prior + (i%3===0 ? 2 : 0);
  const close = prior + (i%4===0 ? -1 : 2);
  return {date:new Date(start+i*86400000).toISOString(),open,
    high:Math.max(open,close)+2,low:Math.min(open,close)-2,close,volume:1200+i*10};
});
const options = validateOptions({strategy:'buy-and-hold',initialCash:10000,feeBps:10,slippageBps:5,maxAllocation:0.95});

test('OHLC validation rejects fabricated inconsistency, duplication and negative price',()=>{
  assert.equal(validateBars(bars).length,80);
  assert.throws(()=>validateBars([{...bars[0],low:0},...bars.slice(1)]),/Inconsistent/);
  assert.throws(()=>validateBars([bars[0],bars[0],...bars.slice(2)]),/increasing/);
  assert.throws(()=>validateBars(bars.slice(0,10)),/between/);
});
test('requires reasonable strategy settings',()=>{
  assert.throws(()=>validateOptions({fastPeriod:40,slowPeriod:10}),/shorter/);
  assert.throws(()=>validateOptions({initialCash:0}),/Initial cash/);
  assert.throws(()=>validateOptions({strategy:'guaranteed-profit'}),/Unsupported/);
  assert.equal(validateBacktestInput({bars,options}).bars.length,80);
});
test('indicators use correct rolling history and respect warmup',()=>{
  const values=[1,2,3,4,5,6];
  assert.deepEqual(simpleMovingAverage(values,3),[null,null,2,3,4,5]);
  assert.equal(exponentialMovingAverage(values,3)[2],2);
  assert.equal(relativeStrengthIndex(values,3)[3],100);
  assert.equal(momentum(values,2)[3],1);
  assert.equal(annualizedHistoricalVolatility(values,252,3).length,6);
  assert.equal(averageTrueRange(validateBars(bars),14).length,80);
});
test('the buy-and-hold strategy fills at NEXT open and incurs fees',()=>{
  const normalized=validateBars(bars);
  const outcome=simulate(normalized,options);
  assert.equal(outcome.trades.length,1);
  const first=outcome.trades[0];
  assert.equal(first.index,1);
  assert.equal(first.side,'buy');
  assert.equal(first.referenceOpen,normalized[1].open);
  assert.ok(first.fillPrice>first.referenceOpen);
  assert.ok(first.fee>0);
  assert.equal(outcome.diagnostic.lastBarNoFill,true);
  assert.ok(outcome.equitySummary.finalEquity>0);
});
test('strategy cannot fill on same bar close',()=>{
  const o=validateOptions({strategy:'sma-crossover',fastPeriod:3,slowPeriod:5});
  const d=simulate(validateBars(bars),o);
  for(const fill of d.trades)assert.ok(fill.signalAfter===undefined || fill.index>=1);
  assert.equal(d.equityCurve[0].positionShares,0);
});
test('trading costs impact benchmark returns',()=>{
  const normalized=validateBars(bars);
  const cheaper=simulate(normalized,validateOptions({strategy:'buy-and-hold',feeBps:0,slippageBps:0}));
  const costly=simulate(normalized,validateOptions({strategy:'buy-and-hold',feeBps:80,slippageBps:80}));
  assert.ok(cheaper.equitySummary.finalEquity>costly.equitySummary.finalEquity);
});
test('indicators and benchmark reported without claiming prediction quality',()=>{
  const r=runBacktest({bars,options:{strategy:'sma-crossover',fastPeriod:3,slowPeriod:8}});
  assert.equal(r.mode,'historical-simulation');
  assert.equal(r.benchmark.name,'next-open-buy-and-hold');
  assert.match(r.source,/User-supplied/);
  assert.equal(r.observations,80);
});
test('bootstrap is reproducible and bounded',()=>{
  const normalized=validateBars(bars);
  const a=bootstrapScenarios(normalized,{trials:40,horizon:20,seed:7});
  const b=bootstrapScenarios(normalized,{trials:40,horizon:20,seed:7});
  assert.deepEqual(a,b);
  assert.ok(a.simulatedReturnQuantiles.p05<=a.simulatedReturnQuantiles.p95);
  assert.ok(a.fractionWithNegativeEndingReturn>=0&&a.fractionWithNegativeEndingReturn<=1);
});
test('whole share accounting never overspends cash',()=>{
  const r=runBacktest({bars,options:{strategy:'buy-and-hold',initialCash:1000,maxAllocation:1,fixedFee:10,feeBps:100,slippageBps:100}});
  assert.ok(r.strategyResult.equityCurve.every(x=>x.cash>=0));
  assert.ok(r.strategyResult.trades.every(x=>Number.isInteger(x.quantity)));
});
test('RSI strategy holds on warmup',()=>{
  const opts=validateOptions({strategy:'rsi-reversion'});
  const normalized=validateBars(bars);
  const indicators={rsi:Array(bars.length).fill(null)};
  assert.equal(signalAt(0,normalized,indicators,opts,{isHolding:false}),'hold');
});
