import fs from 'fs';
import vm from 'vm';

const failOnInvalid = process.argv.includes('--fail-on-invalid');
const bannedExact = new Set(['agendasync', 'acquisitioncost', 'adaptationplan']);

const verified = JSON.parse(fs.readFileSync('tools/vocab-audit/verified-toeic-words.json', 'utf8'));
const verifiedSet = new Set(verified.map(w => String(w).trim().toLowerCase()));

const src = fs.readFileSync('words_library.js', 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const words = Array.isArray(ctx.window.WORDS) ? ctx.window.WORDS : [];

const duplicates = new Map();
for (const row of words) {
  const key = String(row?.word || '').trim().toLowerCase();
  duplicates.set(key, (duplicates.get(key) || 0) + 1);
}

const exampleFreq = new Map();
const invalid = [];
for (const row of words) {
  const word = String(row?.word || '').trim().toLowerCase();
  const meaning = String(row?.meaning || '').trim();
  const example = String(row?.example || '').trim();
  const exampleZh = String(row?.example_zh || '').trim();
  const issues = [];

  if (!/^[a-z]+$/.test(word)) issues.push('word_not_lowercase_english');
  if (!verifiedSet.has(word)) issues.push('word_not_in_verified_list');
  if (/^admin/.test(word)) issues.push('adminxxx_detected');
  if (bannedExact.has(word)) issues.push('banned_fake_word_detected');
  if ((duplicates.get(word) || 0) > 1) issues.push('duplicate_word');
  if (!meaning || meaning === word) issues.push('invalid_meaning');
  if (/查不到翻譯|暫無翻譯|資料待補/.test(meaning)) issues.push('placeholder_meaning');

  const tokens = example ? example.split(/\s+/).filter(Boolean) : [];
  if (tokens.length < 8 || tokens.length > 14) issues.push('example_word_count_out_of_range');
  if (word && !new RegExp(`\\b${word}\\b`, 'i').test(example)) issues.push('example_missing_target_word');
  if (/[A-Za-z]/.test(exampleZh)) issues.push('example_zh_contains_english');
  if (/查不到翻譯|暫無翻譯|資料待補/.test(`${example} ${exampleZh}`)) issues.push('placeholder_sentence');

  const normExample = example.toLowerCase();
  exampleFreq.set(normExample, (exampleFreq.get(normExample) || 0) + 1);

  if (issues.length) invalid.push({ word, issues });
}

const repeatedTemplates = [...exampleFreq.entries()].filter(([, count]) => count >= 20).map(([text, count]) => ({ text, count }));
if (repeatedTemplates.length) invalid.push({ word: '__template__', issues: ['too_many_repeated_templates'] });

const summary = {
  total: words.length,
  verified_total: verifiedSet.size,
  invalid_count: invalid.length,
  repeated_template_count: repeatedTemplates.length,
  invalid,
};

fs.writeFileSync('tools/vocab-audit/report.json', JSON.stringify(summary, null, 2));
const md = `# 字庫稽核報告\n\n- 總數：${summary.total}\n- verified 清單：${summary.verified_total}\n- 錯誤數：${summary.invalid_count}\n- 重複模板：${summary.repeated_template_count}\n`;
fs.writeFileSync('tools/vocab-audit/report.md', md);

console.log(`Audited ${summary.total} words, invalid: ${summary.invalid_count}`);
if (failOnInvalid && (summary.invalid_count > 0 || words.length < 1000)) process.exit(1);
if (!failOnInvalid && words.length < 1000) process.exit(1);
