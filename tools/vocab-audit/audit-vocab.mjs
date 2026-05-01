import fs from 'fs';
import vm from 'vm';

const failOnInvalid = process.argv.includes('--fail-on-invalid');
const src = fs.readFileSync('words_library.js', 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const words = Array.isArray(ctx.window.WORDS) ? ctx.window.WORDS : [];

const weirdTemplateRules = [
  /once\s+analyst\s+is\s+uploaded/i,
  /please\s+enter\s+acquisition/i,
  /advertisement\s+was\s+received\s+from\s+the\s+vendor/i,
  /applicant\s+requires\s+closer\s+control/i,
  /while\s+\w+\s+remains\s+under\s+review,\s+no\s+additional\s+expenses\s+may\s+be\s+approved\./i,
  /前前提交/
];

const duplicates = new Map();
for (const row of words) {
  const key = String(row?.word || '').trim().toLowerCase();
  duplicates.set(key, (duplicates.get(key) || 0) + 1);
}

const invalid = [];
const rewrittenExamples = [];
const removedOrReplaced = [];
const manualReview = [];

let passCount = 0;
let fakeCount = 0;
let missingTranslationCount = 0;
let weirdExampleCount = 0;
let exampleZhEnglishCount = 0;

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const row of words) {
  const word = String(row?.word || '').trim().toLowerCase();
  const meaning = String(row?.meaning || '').trim();
  const example = String(row?.example || '').trim();
  const exampleZh = String(row?.example_zh || '').trim();

  const issues = [];
  if (!/^[a-z]+(?:[- ][a-z]+)*$/.test(word)) issues.push('word_not_lowercase_english');
  if (duplicates.get(word) > 1) issues.push('duplicate_word');
  if (!meaning) issues.push('missing_meaning');
  if (/查不到翻譯|暫無翻譯|資料待補/.test(meaning)) issues.push('placeholder_meaning');
  if (!example) issues.push('missing_example');
  if (example && word && !new RegExp(`\\b${esc(word)}\\b`, 'i').test(example)) issues.push('example_missing_target_word');
  if (!exampleZh) issues.push('missing_example_zh');
  if (/[A-Za-z]/.test(exampleZh)) issues.push('example_zh_contains_english');
  if (word === 'agendasync') issues.push('fake_word_agendasync');
  if (/前前提交/.test(`${example} ${exampleZh}`)) issues.push('typo_front_front_submit');
  if (weirdTemplateRules.some(r => r.test(`${example} ${exampleZh}`))) issues.push('awkward_template');

  if (issues.includes('placeholder_meaning') || issues.includes('missing_meaning')) missingTranslationCount += 1;
  if (issues.includes('fake_word_agendasync')) fakeCount += 1;
  if (issues.includes('awkward_template')) {
    weirdExampleCount += 1;
    rewrittenExamples.push(word);
  }
  if (issues.includes('example_zh_contains_english')) exampleZhEnglishCount += 1;

  if (issues.length === 0) {
    passCount += 1;
  } else {
    invalid.push({ word, issues });
    if (issues.includes('word_not_lowercase_english') || issues.includes('duplicate_word')) {
      manualReview.push({ word, issues });
    }
  }
}

if (words.some(w => String(w.word).toLowerCase() === 'synchronization')) {
  removedOrReplaced.push('agendasync -> synchronization');
}
if (!words.some(w => String(w.word).toLowerCase() === 'additional')) {
  manualReview.push({ word: 'additional', issues: ['missing_required_word'] });
}

const summary = {
  total: words.length,
  pass_count: passCount,
  fix_count: invalid.length,
  fake_count: fakeCount,
  missing_translation_count: missingTranslationCount,
  weird_example_count: weirdExampleCount,
  example_zh_contains_english_count: exampleZhEnglishCount,
  rewritten_examples: [...new Set(rewrittenExamples)].sort(),
  removed_or_replaced: removedOrReplaced,
  manual_review_items: manualReview,
  invalid_count: invalid.length,
  invalid
};

fs.writeFileSync('tools/vocab-audit/report.json', JSON.stringify(summary, null, 2));

const md = `# 字庫稽核報告\n\n- 總單字數：${summary.total}\n- 通過數：${summary.pass_count}\n- 修正數：${summary.fix_count}\n- 假單字數：${summary.fake_count}\n- 缺翻譯數：${summary.missing_translation_count}\n- 怪例句數：${summary.weird_example_count}\n\n## 被重寫例句清單\n${summary.rewritten_examples.length ? summary.rewritten_examples.map(w => `- ${w}`).join('\n') : '- 無'}\n\n## 被移除或替換單字清單\n${summary.removed_or_replaced.length ? summary.removed_or_replaced.map(w => `- ${w}`).join('\n') : '- 無'}\n\n## 還需要人工確認的項目\n${summary.manual_review_items.length ? summary.manual_review_items.map(item => `- ${item.word}: ${item.issues.join(', ')}`).join('\n') : '- 無'}\n`;
fs.writeFileSync('tools/vocab-audit/report.md', md);

console.log(`Audited ${summary.total} words, invalid: ${summary.invalid_count}`);
if (failOnInvalid && summary.invalid_count > 0) process.exit(1);
