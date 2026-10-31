import test from 'node:test';import assert from 'node:assert/strict';import {technicalAnalysis} from '../apps/api/indicators.js';
test('technical indicators on bounded public probability history',()=>{const values=Array.from({length:25},(_,i)=>0.2+i*.01);const d=technicalAnalysis({values,period:10});assert.equal(d.status,'calculated');assert.ok(d.sma>0&&d.sma<1);assert.ok(d.ema>0&&d.ema<1);assert.ok(d.rsi>=0&&d.rsi<=100)});
test('insufficient observations are transparent',()=>{const d=technicalAnalysis({values:[0.2,0.3],period:5});assert.equal(d.status,'insufficient-history')});
test('invalid observations rejected',()=>assert.throws(()=>technicalAnalysis({values:[1,1.5],period:2})));
