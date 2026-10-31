import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsvRows,parseOhlcvCsv} from '../apps/web/csv.js';
test('handles quoted cells and CRLF correctly',()=>{
 const rows=parseCsvRows('date,name\r\n"2025-01-01","Example, Inc."\r\n');
 assert.deepEqual(rows[1],['2025-01-01','Example, Inc.']);
});
test('converts OHLCV CSV to typed bars',()=>{
 const rows=parseOhlcvCsv('date,open,high,low,close,volume\n2025-01-01,100,103,99,102,8000\n');
 assert.equal(rows[0].open,100);
 assert.equal(rows[0].close,102);
 assert.equal(rows[0].volume,8000);
});
test('rejects malformed quote and missing price',()=>{
 assert.throws(()=>parseCsvRows('date,open\n"unclosed'),/Unclosed/);
 assert.throws(()=>parseOhlcvCsv('date,open,high,low,close\n2025-01-01,100,110,,108'),/Missing/);
});
test('rejects inconsistent number of fields',()=>{
 assert.throws(()=>parseOhlcvCsv('date,open,high,low,close\n2025-01-01,1,2,1'),/columns/);
});
