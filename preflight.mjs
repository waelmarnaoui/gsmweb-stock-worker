import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'gsmweb-stock-probe-'));process.env.KOFF_PROFILE=join(dir,'browser');
let context;
try{
 const {browser,securityCheckpoint}=await import('./browser.mjs');context=await browser(false);const page=await context.newPage();
 const response=await page.goto('https://shop.koff.ro/ro',{waitUntil:'domcontentloaded',timeout:30000});
 const state=await page.evaluate(()=>({title:document.title,text:document.body.innerText,passwordFields:document.querySelectorAll('input[type="password"]').length,loginLinks:[...document.querySelectorAll('a[href]')].filter(a=>/login|sign.?in|autentific/i.test(a.getAttribute('href')+' '+a.textContent)).map(a=>new URL(a.href).pathname)}));
 const blocked=securityCheckpoint(state.title,state.text)||response?.status()>=400;
 console.log(JSON.stringify({probe:true,httpStatus:response?.status(),supplierSecurityCheck:blocked,loginFormPresent:state.passwordFields>0,loginPaths:state.loginLinks.slice(0,5),credentialsUsed:false}));
 if(blocked)throw Error('Koff blocks this hosted browser. Supplier-approved access is required; no bypass was attempted.');
}catch(e){console.error(String(e.message).slice(0,500));process.exitCode=1;}finally{if(context)await context.close();await rm(dir,{recursive:true,force:true});}
