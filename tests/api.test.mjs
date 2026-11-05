import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workerApi} from '../api.mjs';
import {run} from '../cloud-run.mjs';
test('cloud runner sends no requests outside its stock scope and never follows credential redirects',async()=>{
 let called=0;
 for(const path of ['/worker/title-plan','/worker/config','https://evil.example/'])await assert.rejects(()=>workerApi('https://admin.example',{},path,undefined,{fetcher:async()=>{called++;}}));
 assert.equal(called,0);
 const bodies=[];await workerApi('https://admin.example',{Authorization:'Bearer test'},'/worker/import',{rows:[{sku:'KF1',stockRefresh:true}]},{sleep:async()=>{},fetcher:async(url,opts)=>{assert.equal(opts.redirect,'error');bodies.push(opts.body);return bodies.length===1?new Response('',{status:503}):Response.json({updated:1});}});assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
});
test('missing cloud secrets stop the runner before launching a browser or supplier request',async()=>{
 await assert.rejects(()=>run(),/connection is incomplete/);
});
