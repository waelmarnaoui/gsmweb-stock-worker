export function scanIsFresh(progress,now=Date.now()){
 const age=now-Date.parse(progress?.at||'');
 return progress?.status==='complete'&&Number(progress.total)>0&&Number(progress.checked)===Number(progress.total)&&Number(progress.verified)>=Number(progress.total)&&Number(progress.failed)===0&&age>=0&&age<45*60000;
}
export async function drainMerchant(api,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),maxBatches=200}={}){
 let last,stalls=0;
 for(let i=0;i<maxBatches;i++){
  const result=await api('/worker/merchant-sync',{});
  if(result.skipped)return {ok:true,skipped:true};
  if(!result.busy&&Number(result.pending)===0&&Number(result.failed)===0)return {ok:true,pending:0,failed:0};
  if(result.busy||result.failed||result.pending===last){if(++stalls>=4)return {ok:false,pending:result.pending,failed:result.failed,busy:result.busy};await sleep(5000*stalls);}else stalls=0;
  last=result.pending;
 }
 return {ok:false,pending:last,reason:'batch-limit'};
}

