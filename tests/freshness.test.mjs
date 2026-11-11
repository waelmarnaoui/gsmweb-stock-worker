import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanIsFresh,drainMerchant} from '../freshness.mjs';
test('only a recent complete verified scan may skip supplier work',()=>{
 const now=Date.parse('2026-11-11T12:00:00Z'),p={status:'complete',total:1007,checked:1007,verified:1007,failed:0,at:'2026-11-11T11:30:00Z'};
 assert.equal(scanIsFresh(p,now),true);for(const patch of [{status:'running'},{failed:1},{verified:1006},{at:'2026-11-11T11:00:00Z'},{at:'2026-11-11T12:01:00Z'}])assert.equal(scanIsFresh({...p,...patch},now),false);
});
test('Merchant sync retries transient failures and reports incomplete drains',async()=>{
 const results=[{pending:50,failed:1},{pending:25,failed:0},{pending:0,failed:0}];assert.equal((await drainMerchant(async()=>results.shift(),{sleep:async()=>{}})).ok,true);
 assert.equal((await drainMerchant(async()=>({pending:25,failed:1}),{sleep:async()=>{}})).ok,false);
});

