import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'gsmweb-stock-probe-'));process.env.KOFF_PROFILE=join(dir,'browser');
let context;
try{
 const {browser,securityCheckpoint}=await import('./browser.mjs');context=await browser(false);const page=await context.newPage();
 const response=await page.goto('https://shop.koff.ro/ro',{waitUntil:'domcontentloaded',timeout:30000});
 const initial=await page.evaluate(()=>({title:document.title,text:document.body.innerText}));if(securityCheckpoint(initial.title,initial.text))throw Error('Supplier security verification requires approved access.');
 await page.waitForLoadState('networkidle',{timeout:20000});
 const state=await page.evaluate(()=>({title:document.title,text:document.body.innerText,passwordFields:document.querySelectorAll('input[type="password"]').length,loginLinks:[...document.querySelectorAll('a[href]')].filter(a=>/login|sign.?in|autentific/i.test(a.getAttribute('href')+' '+a.textContent)).map(a=>new URL(a.href).pathname)}));
 const blocked=securityCheckpoint(state.title,state.text)||response?.status()>=400;
 console.log(JSON.stringify({probe:true,httpStatus:response?.status(),supplierSecurityCheck:blocked,loginFormPresent:state.passwordFields>0,loginPaths:state.loginLinks.slice(0,5),pagePath:new URL(page.url()).pathname,credentialsUsed:false}));
 console.log(JSON.stringify(await page.evaluate(()=>({forms:document.querySelectorAll('form').length,fields:[...document.querySelectorAll('input')].map(i=>({type:i.type,name:i.name,id:i.id,placeholder:i.placeholder})),buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,12)}))));
 console.log(JSON.stringify(await page.evaluate(()=>({formStructure:[...document.querySelectorAll('form')].map(f=>({id:f.id,fields:[...f.querySelectorAll('input')].map(i=>({id:i.id,name:i.name,type:i.type,visible:!!i.getClientRects().length})),buttons:[...f.querySelectorAll('button,input[type="submit"]')].map(b=>({text:b.textContent.trim(),type:b.type,ariaLabel:b.getAttribute('aria-label'),visible:!!b.getClientRects().length}))})),loginButtons:[...document.querySelectorAll('button')].filter(b=>/login/i.test(b.textContent)).map(b=>({text:b.textContent.trim(),ariaLabel:b.getAttribute('aria-label'),type:b.type,formId:b.form?.id||null,visible:!!b.getClientRects().length}))}))));
 if(blocked)throw Error('Koff blocks this hosted browser. Supplier-approved access is required; no bypass was attempted.');
}catch(e){console.error(String(e.message).slice(0,500));process.exitCode=1;}finally{if(context)await context.close();await rm(dir,{recursive:true,force:true});}
