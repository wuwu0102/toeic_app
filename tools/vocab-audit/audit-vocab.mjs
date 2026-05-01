import fs from 'fs';
import vm from 'vm';

const failOnInvalid = process.argv.includes('--fail-on-invalid');
const bannedExact = new Set(['agendasync', 'acquisitioncost', 'adaptationplan']);
const functionWords = new Set(['the', 'a', 'an', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'by', 'if', 'because', 'while', 'during', 'before', 'after', 'unless']);
const forcedVerbWords = new Set(['completed', 'issued', 'confirmed', 'arranged', 'reviewed']);
const forbiddenBigrams = ['reviewed completed', 'submitted issued', 'checked confirmed', 'revised arranged'];
const bannedPhrases = ['in the workflow', 'this item was processed'];

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
const zhFreq = new Map();
const invalid = [];
let verbVerbPatternCount = 0;

for (const row of words) {
  const word = String(row?.word || '').trim().toLowerCase();
  const pos = String(row?.pos || '').trim().toLowerCase();
  const meaning = String(row?.meaning || '').trim();
  const example = String(row?.example || '').trim();
  const exampleZh = String(row?.example_zh || '').trim();
  const issues = [];

  if (!/^[a-z]+$/.test(word)) issues.push('word_not_lowercase_english');
  if (!verifiedSet.has(word)) issues.push('word_not_in_verified_list');
  if (functionWords.has(word)) issues.push('function_word_in_library');
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

  const lowerEx = example.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (lowerEx.includes(phrase)) issues.push('banned_template_phrase');
  }
  for (const bg of forbiddenBigrams) {
    if (lowerEx.includes(bg)) issues.push('forbidden_verb_verb_pair');
  }

  if (/\b\w+ed\s+\w+ed\b/i.test(example)) {
    verbVerbPatternCount += 1;
    issues.push('possible_verb_plus_verb');
  }

  if (forcedVerbWords.has(word) && pos === 'prep.') issues.push('verb_marked_as_prep');

  const normExample = lowerEx.replace(/\s+/g, ' ').trim();
  const normZh = exampleZh.replace(/\s+/g, ' ').trim();
  exampleFreq.set(normExample, (exampleFreq.get(normExample) || 0) + 1);
  zhFreq.set(normZh, (zhFreq.get(normZh) || 0) + 1);

  if (issues.length) invalid.push({ word, issues });
}

const repeatedExamples = [...exampleFreq.values()].filter(count => count > 1).reduce((a, b) => a + b, 0);
const repeatedZh = [...zhFreq.values()].filter(count => count > 1).reduce((a, b) => a + b, 0);
const templateRatio = words.length ? repeatedExamples / words.length : 0;

if (templateRatio > 0.03) invalid.push({ word: '__template__', issues: ['template_ratio_over_3_percent'] });
if (repeatedZh > 0) invalid.push({ word: '__zh_repeat__', issues: ['example_zh_repeated'] });

const summary = {
  total: words.length,
  verified_total: verifiedSet.size,
  invalid_count: invalid.length,
  template_ratio: Number((templateRatio * 100).toFixed(2)),
  repeated_example_rows: repeatedExamples,
  repeated_zh_rows: repeatedZh,
  verb_verb_pattern_count: verbVerbPatternCount,
  invalid,
};

fs.writeFileSync('tools/vocab-audit/report.json', JSON.stringify(summary, null, 2));
const md = `# 字庫稽核報告\n\n- 總數：${summary.total}\n- verified 清單：${summary.verified_total}\n- 錯誤數：${summary.invalid_count}\n- 模板率：${summary.template_ratio}%\n- 中文重複列數：${summary.repeated_zh_rows}\n`;
fs.writeFileSync('tools/vocab-audit/report.md', md);

console.log(`Audited ${summary.total} words, invalid: ${summary.invalid_count}, template ratio: ${summary.template_ratio}%`);
if (failOnInvalid && (summary.invalid_count > 0 || words.length < 1000)) process.exit(1);
if (!failOnInvalid && words.length < 1000) process.exit(1);
