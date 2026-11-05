const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function workerApi(base,headers,path,data,{fetcher=fetch,sleep=pause}={}){
 const allowed=data===undefined?path==='/worker/stock-plan'||path==='/worker/config?stock=1':['/worker/import','/worker/stock-progress','/worker/merchant-sync'].includes(path);
 if(!allowed)throw Error('Endpoint outside stock scope');
 const payload=data===undefined?undefined:JSON.stringify(data);
 for(let attempt=0;;attempt++){
  try{const r=await fetcher(base+path,{method:data===undefined?'GET':'POST',headers,body:payload,redirect:'error',signal:AbortSignal.timeout(135000)});
   if(r.ok)return await r.json();
   if([500,502,503,504].includes(r.status)&&attempt<2){await sleep(2000*2**attempt);continue;}
   throw Object.assign(Error('Stock server connection failed'),{httpStatus:r.status});
  }catch(e){if(e.httpStatus||attempt>=2)throw e;await sleep(2000*2**attempt);}
 }
}
