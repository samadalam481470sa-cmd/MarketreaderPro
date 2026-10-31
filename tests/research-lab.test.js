import test from 'node:test';import assert from 'node:assert/strict';
import {validateSeries,describeSeries,rollingStatistics,identifyAnomalies,walkForwardBaseline,buildHistoricalResearch} from '../apps/api/research-lab.js';
const t=Date.parse('2026-01-01T00:00:00Z');
const series=Array.from({length:40},(_,i)=>({at:new Date(t+i*60000).toISOString(),probability:0.2+i*0.01}));
test('strictly chronological observations required',()=>{
 assert.throws(()=>validateSeries([series[1],series[0],series[2]]));
 assert.throws(()=>validateSeries([{...series[0],probability:3},series[1],series[2]]));
 assert.equal(validateSeries(series).length,40);
});
test('rolling volatility and probabilities are finite',()=>{
 const stats=rollingStatistics(series,10);
 assert.equal(stats.length,31);
 assert.ok(stats[0].mean>0.2&&stats[0].mean<0.4);
 assert.ok(stats.every(x=>x.standardDeviation>=0&&x.lower>=0&&x.upper<=1));
});
test('summary is descriptive, not speculative profits',()=>{
 const summary=describeSeries(series);
 assert.equal(summary.observations,40);
 assert.equal(summary.min,0.2);
 assert.ok(summary.momentum>0);
 assert.match(summary.caution,/not investment returns/);
});
test('anomaly classifier works with constant values and sharp jump',()=>{
 const rows=Array.from({length:16},(_,i)=>({at:new Date(t+i*60000).toISOString(),probability:i===15?0.7:0.3}));
 assert.ok(identifyAnomalies(rows,{window:8,threshold:3}).length>=1);
});
test('walk-forward evaluation does not use future data',()=>{
 const result=walkForwardBaseline(series,{trainMinimum:15});
 assert.equal(result.samples,24);
 assert.equal(result.predictions[0].persistence,series[15].probability);
 assert.equal(result.predictions[0].actual,series[16].probability);
 assert.ok(result.baselineMSE>=0);
});
test('composed report bounds expensive output',()=>{
 const report=buildHistoricalResearch(series,{rollingWindow:5,includePredictions:true});
 assert.equal(report.rolling.length,36);
 assert.ok(report.model);
});
