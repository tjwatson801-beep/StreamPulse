const assert=require('node:assert/strict');const {claimInstance}=require('../dist-electron/singleInstance');
let quit=0,callback,focused=0,shown=0,restored=0;
const app={requestSingleInstanceLock:()=>false,quit:()=>quit++,on:()=>{throw Error('Secondary process must not register listeners');}};
assert.equal(claimInstance(app,()=>null),false);assert.equal(quit,1);
app.requestSingleInstanceLock=()=>true;app.on=(_,fn)=>callback=fn;
const win={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>restored++,show:()=>shown++,focus:()=>focused++};
assert.equal(claimInstance(app,()=>win),true);callback();assert.equal(restored,1);assert.equal(focused,1);assert.equal(shown,1);
win.isDestroyed=()=>true;callback();assert.equal(focused,1);
console.log('Passed: duplicate process exits and the existing window is restored/focused.');
