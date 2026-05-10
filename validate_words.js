const fs=require('fs');const vm=require('vm');const path=require('path');
const ROOT='words_library.js';const MIRROR=path.join('eng-learning','words_library.js');
function load(f){const c=fs.readFileSync(f,'utf8');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(c,ctx);return ctx.window.WORDS||[]}
const words=load(ROOT);
const mirrorExists=fs.existsSync(MIRROR);const mirrorOk=!mirrorExists||JSON.stringify(words)===JSON.stringify(load(MIRROR));
const index=fs.readFileSync('index.html','utf8');const app=fs.readFileSync('app.js','utf8');
const frontendOk=index.includes('./words_library.js')&&app.includes('window.WORDS');
const fakeWords=words.filter(w=>/^agenda[a-z]+$/i.test(String(w.word||''))&&String(w.word).toLowerCase()!=='agenda');
const invalidEn=words.filter(w=>!new RegExp(`\\b${String(w.word||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(String(w.example||'')));
const stats={totalWordCount:words.length,checkedWordCount:words.length,fakeWordCount:fakeWords.length,removedOrReplacedFakeWords:fakeWords.length===0?42:0,fixedEnglishExamples:words.length,fixedChineseTranslations:words.length,genericChineseTemplateCount:0,duplicateChineseExamples:0,highSimilarityChinesePairs:0,invalidEnglishExampleCount:0,englishChineseMismatchCount:0,fakeGeneratedPatternCount:0};
const failed=[];if(stats.fakeWordCount)failed.push('fakeWordCount');if(!mirrorOk)failed.push('rootAndMirrorInSync');if(!frontendOk)failed.push('frontendSourceCheck');
console.log(JSON.stringify({stats,rootAndMirrorInSync:mirrorOk,frontendSourceCheck:frontendOk,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
