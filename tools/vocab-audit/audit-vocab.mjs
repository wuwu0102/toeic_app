import fs from 'fs';
import vm from 'vm';

const failOnInvalid = process.argv.includes('--fail-on-invalid');
const FUNCTION_WORDS = new Set(['the','a','an','to','of','for','with','in','on','at','by','if','because','while','during','before','after','unless']);
const BANNED_EXACT = new Set(['agendasync','acquisitioncost','adaptationplan']);
const BAD_EXAMPLE_SNIPPETS = ['reviewed completed','submitted issued','checked confirmed','revised arranged','prepared received','arranged updated','planned submitted','updated prepared','confirmed reviewed','documented approved','was discussed during today','in the workflow'];

const verified = JSON.parse(fs.readFileSync('tools/vocab-audit/verified-toeic-words.json', 'utf8'));
const verifiedSet = new Set(verified.map(w => String(w).trim().toLowerCase()));
const src = fs.readFileSync('words_library.js', 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const words = Array.isArray(ctx.window.WORDS) ? ctx.window.WORDS : [];

const duplicates = new Map();
for (const row of words) {
  const word = String(row?.word || '').trim().toLowerCase();
  duplicates.set(word, (duplicates.get(word) || 0) + 1);
}
const zhFreq = new Map();
for (const row of words) {
  const zh = String(row?.example_zh || '').trim();
  if (zh) zhFreq.set(zh, (zhFreq.get(zh) || 0) + 1);
}

const invalid = [];
for (const row of words) {
  const word = String(row?.word || '').trim().toLowerCase();
  const pos = String(row?.pos || '').trim().toLowerCase();
  const meaning = String(row?.meaning || '').trim();
  const example = String(row?.example || '').trim();
  const exampleZh = String(row?.example_zh || '').trim();
  const issues = [];

  if (!word || !/^[a-z]+$/.test(word)) issues.push('word_not_valid_english');
  if (!verifiedSet.has(word)) issues.push('word_not_in_verified_list');
  if (FUNCTION_WORDS.has(word)) issues.push('function_word_in_library');
  if (/^admin/.test(word)) issues.push('adminxxx_detected');
  if (BANNED_EXACT.has(word)) issues.push('banned_fake_word_detected');
  if ((duplicates.get(word) || 0) > 1) issues.push('duplicate_word');
  if (!meaning || meaning.toLowerCase() === word) issues.push('invalid_meaning');

  if (['completed','issued','confirmed','arranged','received','updated','submitted','prepared','reviewed','approved'].includes(word) && pos === 'prep.') {
    issues.push('pos_error_for_participle');
  }

  const wc = example.split(/\s+/).filter(Boolean).length;
  if (!example) issues.push('example_missing');
  if (wc < 8 || wc > 14) issues.push('example_word_count_out_of_range');
  if (word && !new RegExp(`\\b${word}\\b`, 'i').test(example)) issues.push('example_missing_target_word');
  const lowerEx = example.toLowerCase();
  if (BAD_EXAMPLE_SNIPPETS.some(s => lowerEx.includes(s))) issues.push('example_has_bad_template');

  if (!exampleZh) issues.push('example_zh_missing');
  if (/[A-Za-z]/.test(exampleZh)) issues.push('example_zh_contains_english');
  if (zhFreq.get(exampleZh) > 200) issues.push('example_zh_too_repetitive');
  if (/這項|團隊在工作流程中處理|查不到翻譯|暫無翻譯|資料待補/.test(exampleZh)) issues.push('example_zh_bad_phrase');

  if (issues.length) invalid.push({ word, issues });
}

const summary = {
  total_words: words.length,
  passed_count: words.length - invalid.length,
  error_count: invalid.length,
  removed_fake_words: 0,
  replaced_words: 0,
  rewritten_examples: 0,
  fixed_zh_translations: 0,
  lookup_words_added: 0,
  manual_review_items: [],
  invalid
};

fs.writeFileSync('tools/vocab-audit/report.json', JSON.stringify(summary, null, 2));
const md = `# 字庫稽核報告\n\n- 總單字數：${summary.total_words}\n- 通過數：${summary.passed_count}\n- 錯誤數：${summary.error_count}\n- 被移除假字：${summary.removed_fake_words}\n- 被替換單字：${summary.replaced_words}\n- 重寫例句數：${summary.rewritten_examples}\n- 中文翻譯修正數：${summary.fixed_zh_translations}\n- 即時查詞補充字數：${summary.lookup_words_added}\n- 仍需人工確認項目：${summary.manual_review_items.length ? summary.manual_review_items.join('；') : '無'}\n`;
fs.writeFileSync('tools/vocab-audit/report.md', md);

console.log(`Audited ${words.length} words, invalid: ${invalid.length}`);
if (words.length < 1000) process.exit(1);
if (failOnInvalid && invalid.length) process.exit(1);
