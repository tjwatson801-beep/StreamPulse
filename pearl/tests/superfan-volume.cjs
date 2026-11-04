const assert=require('assert/strict');const {validateSettings}=require('../dist-electron/settingsValidation');
const fan={id:'fan',username:'fan',message:'hello',imagePath:'',soundPath:'',durationMs:6000,enabled:true};
assert.doesNotThrow(()=>validateSettings({superFans:[fan]}));
for(const value of [0,.4,1])assert.doesNotThrow(()=>validateSettings({superFanSoundVolume:value,superFans:[{...fan,volume:value}]}));
for(const value of [-1,1.1,NaN,'loud']){assert.throws(()=>validateSettings({superFanSoundVolume:value}));assert.throws(()=>validateSettings({superFans:[{...fan,volume:value}]}));}
console.log('Super Fan volume settings passed: legacy compatibility, valid levels, type checks and bounds.');
