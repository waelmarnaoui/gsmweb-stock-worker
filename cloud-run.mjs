import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {workerApi} from './api.mjs';

export async function signIn(context,username,password){
 const {requireLogin}=await import('./browser.mjs'),page=context.pages()[0]||await context.newPage();
 await page.goto('https://shop.koff.ro/ro',{waitUntil:'domcontentloaded',timeout:30000});
 // Stop at supplier security checks. No CAPTCHA solving, proxies or stealth settings.
 const {securityCheckpoint}=await import('./browser.mjs');
 let state=await page.evaluate(()=>({title:document.title,text:document.body.innerText}));
 if(securityCheckpoint(state.title,state.text))throw Error('Supplier security verification requires approved access; cloud run stopped.');
 await page.waitForLoadState('networkidle',{timeout:20000});
 state=await page.evaluate(()=>({title:document.title,text:document.body.innerText}));
 if(securityCheckpoint(state.title,state.text))throw Error('Supplier security verification requires approved access; cloud run stopped.');
 let passwordField=page.locator('input[type="password"]:visible');
 if(!await passwordField.count()){
  const signInLink=page.locator('a[href*="login"]:visible');
  if(await signInLink.count())await signInLink.first().click();
  passwordField=page.locator('input[type="password"]:visible');
 }
 await passwordField.first().waitFor({state:'visible',timeout:15000});
 console.log(JSON.stringify({source:'cloud',stage:'supplier_login_form'}));
 const form=page.locator('form').filter({has:page.locator('input[type="password"]:visible')});
 const account=form.locator('input[type="email"]:visible, input[name="username"]:visible, input[name="email"]:visible, input[type="text"]:visible').first();
 await account.fill(username);await passwordField.first().fill(password);
 await form.getByRole('button',{name:'Login',exact:true}).click();
 console.log(JSON.stringify({source:'cloud',stage:'supplier_login_submitted'}));
 await page.waitForLoadState('domcontentloaded');
 await page.locator('a[href*="/cp"]:visible,button:has-text("Logout"),button:has-text("Deconectare")').first().waitFor({state:'visible',timeout:30000}).catch(async()=>{
  const result=await page.evaluate(()=>{const text=document.body.innerText;return {path:location.pathname,passwordFormPresent:!!document.querySelector('input[type="password"]'),credentialRejected:/invalid credentials|incorrect password|wrong password|parol[aă] (?:incorect|gre[sș]it)|date (?:incorecte|invalide)|email.*(?:incorect|invalid)|autentificare e[sș]uat[aă]/i.test(text),extraVerification:/verification code|two.factor|one.time|cod de verificare|autentificare [îi]n doi|verific[aă].*(?:email|identitat)/i.test(text),supplierSecurityCheck:/captcha|verify you are human|performing security verification|verifies you are not a bot/i.test(text)};});
  console.log(JSON.stringify({source:'cloud',stage:'supplier_login_not_completed',...result}));
  throw Error('Koff login did not complete. Check the saved login privately; verification challenges need supplier-approved access.');
 });
 await requireLogin(page);
}

export async function run(){
 const base=process.env.GSMWEB_ADMIN_URL,token=process.env.CLOUD_STOCK_TOKEN,username=process.env.KOFF_USERNAME,password=process.env.KOFF_PASSWORD;
 if(!base||new URL(base).protocol!=='https:'||!token||token.length<32||!username||!password)throw Error('Cloud stock connection is incomplete. Configure the four repository secrets privately.');
 const privateDir=await mkdtemp(join(tmpdir(),'gsmweb-cloud-stock-'));
 Object.assign(process.env,{KOFF_PROFILE:join(privateDir,'browser'),STOCK_STATE_FILE:join(privateDir,'progress.json'),KOFF_HEADLESS:'false'});
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(process.env.VERCEL_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_BYPASS_SECRET}:{})};
 const api=(path,data)=>workerApi(base,headers,path,data);
 let context;
 try{
  const {browser}=await import('./browser.mjs');context=await browser(false);await signIn(context,username,password);console.log(JSON.stringify({source:'cloud',supplierAuthenticated:true}));await context.close();context=undefined;
  const {stockSync,stockState}=await import('./stock.mjs');await stockSync(api);
  console.log(JSON.stringify({status:stockState.status,total:stockState.total,checked:stockState.checked,verified:stockState.verified,outOfStock:stockState.outOfStock,failed:stockState.failed,at:stockState.at}));
  if(stockState.status!=='complete')process.exitCode=1;
 }catch(e){await api('/worker/stock-progress',{status:'paused',message:'Agentul cloud s-a oprit. Verifică autentificarea Koff și ultimul raport.'}).catch(()=>{});throw e;}finally{if(context)await context.close();try{for(let batch=0;batch<200;batch++){const result=await api('/worker/merchant-sync',{});if(result.busy||result.skipped||result.failed||!result.pending)break;}}catch{console.error('Google Merchant availability sync needs attention.');process.exitCode=1;}await rm(privateDir,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(()=>{console.error('Cloud stock check stopped. Inspect the private admin stock status and connection settings. No credentials or browser data are logged.');process.exitCode=1;});
