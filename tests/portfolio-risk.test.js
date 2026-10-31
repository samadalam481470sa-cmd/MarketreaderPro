import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePortfolio} from '../apps/api/portfolio-risk/validation.js';
import {dailyReturns,covarianceMatrix,shrinkCovariance,correlations,portfolioVolatility} from '../apps/api/portfolio-risk/statistics.js';
import {historicalTailRisk,equityPath,historicalRisk} from '../apps/api/portfolio-risk/historical.js';
import {scenarioResults} from '../apps/api/portfolio-risk/scenarios.js';
import {analyzePortfolio} from '../apps/api/portfolio-risk/index.js';
const date=i=>new Date(Date.UTC(2025,0,i+1)).toISOString();
const prices=(base,mult)=>Array.from({length:80},(_,i)=>({date:date(i),close:base*(1+0.003*i+mult*Math.sin(i/4))}));
const assets=[
 {symbol:'AAA',weight:.5,prices:prices(100,.01)},
 {symbol:'BBB',weight:.3,prices:prices(200,.02)},
 {symbol:'CCC',weight:.2,prices:prices(60,.03)}
];
test('strict multi-asset validation rejects mismatched dates and invalid weights',()=>{
 const data=validatePortfolio({assets});
 assert.equal(data.assets.length,3);
 assert.equal(data.dates.length,80);
 assert.throws(()=>validatePortfolio({assets:[assets[0],{...assets[1],weight:.4},assets[2]]}),/sum/);
 const shifted=assets.map(x=>({...x,prices:[...x.prices]}));shifted[1].prices[25]={...shifted[1].prices[25],date:'2026-01-25'};
 assert.throws(()=>validatePortfolio({assets:shifted}),/dates|ordered/);
});
test('covariance matrix is symmetric and correlations bounded',()=>{
 const out=dailyReturns(validatePortfolio({assets}).assets);
 const covariance=covarianceMatrix(out);
 assert.equal(covariance.matrix.length,3);
 assert.equal(covariance.matrix[0][1],covariance.matrix[1][0]);
 assert.ok(correlations(covariance.matrix).flat().every(x=>x===null||x>=-1&&x<=1));
 const shrunk=shrinkCovariance(covariance.matrix);
 assert.ok(Math.abs(shrunk[0][1])<=Math.abs(covariance.matrix[0][1])+1e-12);
 assert.ok(portfolioVolatility(shrunk,[.5,.3,.2]).annualizedVolatility>=0);
});
test('value at risk and expected shortfall are finite and ordered',()=>{
 const x=historicalTailRisk([-.1,-.04,-.01,0,.01,.02,.03,.05],.95);
 assert.ok(x.lossVarFraction>=0);
 assert.ok(x.expectedShortfallFraction>=0);
 assert.equal(x.tailObservations,1);
});
test('equity and drawdown follow daily sequence',()=>{
 const path=equityPath([.1,-.2,.1],[date(0),date(1),date(2),date(3)]);
 assert.equal(path.curve.length,4);
 assert.ok(path.maxDrawdown>.19&&path.maxDrawdown<.21);
});
test('stress scenarios only show arithmetic shocks',()=>{
 const r=scenarioResults([{symbol:'AAA',weight:.6},{symbol:'BBB',weight:.4}],[]);
 assert.equal(r.length,3);
 assert.ok(Math.abs(r[0].assumedPortfolioReturn+.1)<1e-12);
 assert.ok(r.every(x=>x.hypothetical));
});
test('complete portfolio analysis has mathematically coherent risk contributions',()=>{
 const data=analyzePortfolio({assets,confidence:.95,periodsPerYear:252});
 assert.equal(data.mode,'historical-user-data-only');
 assert.equal(data.exposure.numberOfAssets,3);
 assert.equal(data.historical.path.curve[0].value,1);
 assert.equal(data.stressScenarios.length,3);
 const sum=data.returns.varianceContributions.reduce((a,b)=>a+(b.fractionOfTotalVariance??0),0);
 assert.ok(Math.abs(sum-1)<1e-7);
 assert.ok(data.historical.maxDrawdown>=0);
});
test('user shock scenarios reject unknown securities',()=>{
 assert.throws(()=>analyzePortfolio({assets,scenarios:[{name:'bad',shocks:{HIDDEN:-.3}}]}),/unknown symbol/);
});
