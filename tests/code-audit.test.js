import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {audit} from '../scripts/code-audit.js';
test('measures checked-in source, not installed dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mrp-loc-'));
 try{
  await mkdir(join(root,'apps','api'),{recursive:true});
  await mkdir(join(root,'node_modules'),{recursive:true});
  await writeFile(join(root,'apps','api','app.js'),'// comment\nconst a=1;\n\n');
  await writeFile(join(root,'node_modules','padding.js'),'a\n'.repeat(50000));
  const result=await audit(root);
  assert.equal(result.totals.physical,3);
  assert.equal(result.totals.nonblank,2);
  assert.equal(result.remainingPhysicalTo50000,49997);
 }finally{await rm(root,{force:true,recursive:true})}
});
