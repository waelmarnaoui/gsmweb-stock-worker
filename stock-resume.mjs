// A finished pass must check the whole catalog again, even when a few rows failed.
// Interrupted passes may only reuse recent observations; old checkpoints are stale.
export function canResumeStock(state,now=Date.now()){
 const started=Date.parse(state.startedAt||state.at||'');
 return ['running','paused'].includes(state.status)&&Number.isFinite(started)&&started<=now&&now-started<90*60000;
}
