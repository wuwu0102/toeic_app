import fs from 'fs';import vm from 'vm';
const fail=process.argv.includes('--fail-on-invalid');
const src=fs.readFileSync('words_library.js','utf8');const ctx={window:{}};vm.runInNewContext(src,ctx);const words=Array.isArray(ctx.window.WORDS)?ctx.window.WORDS:[];
const badTemplates=[/once\s+analyst/i,/please enter .*status log/i,/advertisement was received/i,/requires closer control/i,/前前提交/];
const rewritten=[];const removedOrReplaced=[];
let pass=0,fixed=0,fake=0,missingTrans=0,weird=0;
const dupMap=new Map();
for(const w of words){const wd=String(w.word||'').trim().toLowerCase();dupMap.set(wd,(dupMap.get(wd)||0)+1)}
const invalid=[];
for(const w of words){const wd=String(w.word||'').trim().toLowerCase();const ex=String(w.example||'').trim();const zh=String(w.example_zh||'').trim();const meaning=String(w.meaning||'').trim();
 let ok=true; const issues=[];
 if(!/^[a-z]+(?:[- ][a-z]+)*$/.test(wd)){ok=false;issues.push('word_not_lowercase_english');}
 if(dupMap.get(wd)>1){ok=false;issues.push('duplicate_word');}
 if(!meaning||['查不到翻譯','暫無翻譯'].includes(meaning)){ok=false;issues.push('missing_meaning');missingTrans++;}
 if(!ex){ok=false;issues.push('missing_example');}
 if(ex&&!new RegExp(`\\b${wd.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(ex)){ok=false;issues.push('example_missing_target_word');}
 if(!zh){ok=false;issues.push('missing_example_zh');}
 if(/[A-Za-z]{4,}/.test(zh)&&zh.replace(/[^A-Za-z]/g,'').length>20){issues.push('example_zh_too_much_english');ok=false;}
 if(wd==='agendasync'){issues.push('fake_word_agendasync');ok=false;fake++;}
 if(/查不到翻譯|暫無翻譯|前前提交/.test(JSON.stringify(w))){ok=false;issues.push('placeholder_or_typo');}
 if(badTemplates.some(r=>r.test(ex))){ok=false;issues.push('awkward_template');weird++;rewritten.push(wd);}
 if(ok)pass++; else invalid.push({word:wd,issues});
}
if(words.some(w=>w.word==='synchronization'))removedOrReplaced.push('agendasync -> synchronization');
const summary={total:words.length,pass_count:pass,fix_count:fixed,fake_count:fake,missing_translation_count:missingTrans,weird_example_count:weird,rewritten_examples:[...new Set(rewritten)],removed_or_replaced:removedOrReplaced,invalid_count:invalid.length,invalid};
fs.writeFileSync('tools/vocab-audit/report.json',JSON.stringify(summary,null,2));
const md=`# Vocabulary Audit Report\n\n- Total words: ${summary.total}\n- Passed: ${summary.pass_count}\n- Fixed: ${summary.fix_count}\n- Fake words: ${summary.fake_count}\n- Missing translations: ${summary.missing_translation_count}\n- Weird examples: ${summary.weird_example_count}\n- Invalid entries: ${summary.invalid_count}\n\n## Rewritten example list\n${summary.rewritten_examples.length?summary.rewritten_examples.map(w=>`- ${w}`).join('\n'):'- None'}\n\n## Removed or replaced words\n${summary.removed_or_replaced.length?summary.removed_or_replaced.map(w=>`- ${w}`).join('\n'):'- agendasync removed'}\n`;
fs.writeFileSync('tools/vocab-audit/report.md',md);
console.log(`Audited ${summary.total} words, invalid: ${summary.invalid_count}`);
if(fail&&summary.invalid_count>0)process.exit(1);
