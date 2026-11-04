const assert=require('node:assert/strict');const {validateSettings}=require('../dist-electron/settingsValidation');
assert.doesNotThrow(()=>validateSettings({defaultGiftTemplate:'Thanks'}));assert.doesNotThrow(()=>validateSettings({defaultGiftSoundPath:'C:/sounds/default.wav',defaultGiftSoundVolume:0}));
for(const value of [-1,1.1,NaN,'loud'])assert.throws(()=>validateSettings({defaultGiftSoundVolume:value}));assert.throws(()=>validateSettings({defaultGiftSoundPath:42}));
console.log('Default gift settings passed: old settings compatibility, sound-path type and volume bounds.');
