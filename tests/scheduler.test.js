import test from 'node:test';import assert from 'node:assert/strict';
import {due,timeParts} from '../scripts/scheduler.js';
test('morning cron honors America/Chicago',()=>{
 const before=new Date('2026-10-30T11:59:00Z');const after=new Date('2026-10-30T12:00:00Z');
 assert.equal(due(before,null,7,0),false);
 assert.equal(due(after,null,7,0),true);
 assert.equal(due(after,'2026-10-30',7,0),false);
});
