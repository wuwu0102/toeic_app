import fs from 'fs';
import vm from 'vm';

const fakeWords = new Set(['agendasync', 'acquisitioncost', 'adaptationplan']);
const functionWords = new Set(['the','a','an','to','of','for','with','in','on','at','by','if','because','while','during','before','after','unless']);
const businessHints = ['meeting','invoice','budget','report','contract','client','manager','team','shipment','schedule','payment','project','office','sales','vendor','supplier'];
const verbHints = new Set(['is','are','was','were','be','being','been','have','has','had','do','does','did','review','reviewed','submit','submitted','check','checked','confirm','confirmed','update','updated','prepare','prepared','approve','approved','arrange','arranged','receive','received','plan','planned']);
const subjectHints = new Set(['i','we','they','he','she','it','the','a','an','our','my','your','manager','team','client','staff','company','vendor','supplier']);
const badPatterns = [/reviewed\s+completed/i, /submitted\s+issued/i, /checked\s+confirmed/i];
const validPos = ['n.','v.','adj.','adv.','prep.'];

const src = fs.readFileSync('words_library.js', 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const words = Array.isArray(ctx.window.WORDS) ? ctx.window.WORDS : [];

const verified = JSON.parse(fs.readFileSync('tools/vocab-audit/verified-toeic-words.json', 'utf8'));
const verifiedSet = new Set(verified.map(v => String(v).toLowerCase().trim()));

const dup = new Map();
for (const row of words) {
  const w = String(row.word || '').toLowerCase().trim();
  dup.set(w, (dup.get(w) || 0) + 1);
}

function tokens(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean);
}

function includesWord(example, word) {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(example);
}

const issues = [];
let pass = 0;
let suspicious = 0;
let obvious = 0;

for (const row of words) {
  const word = String(row.word || '').trim().toLowerCase();
  const pos = String(row.pos || '').trim().toLowerCase();
  const meaning = String(row.meaning || '').trim();
  const example = String(row.example || '').trim();
  const exampleZh = String(row.example_zh || '').trim();
  const tk = tokens(example);

  let score = 0;
  const reasons = [];
  const fatal = [];

  // 1
  if (/^[a-z]+(?:-[a-z]+)?$/.test(word)) score++; else reasons.push('word 不是標準英文字');
  // 2
  if (verifiedSet.has(word) || businessHints.some(h => word.includes(h) || meaning.includes(h))) score++; else reasons.push('TOEIC/商務適配性偏低');
  // 3
  if (!/^admin/.test(word)) score++; else { reasons.push('疑似自創 adminxxx'); fatal.push('word 為自創字'); }
  // 4
  if (!fakeWords.has(word) && !/^admin/.test(word)) score++; else fatal.push('word 命中 fake 清單');
  // 5
  if (!functionWords.has(word)) score++; else fatal.push('word 為功能字');
  // 6
  if (validPos.includes(pos) && !(pos === 'prep.' && !functionWords.has(word))) score++; else {
    reasons.push('pos 可疑');
    if (pos === 'prep.' && !functionWords.has(word)) fatal.push('pos 明顯錯誤（prep.）');
  }
  // 7
  if (/[\u4e00-\u9fff]/.test(meaning)) score++; else reasons.push('meaning 非自然繁中');
  // 8
  if (meaning.toLowerCase() !== word && meaning !== '') score++; else reasons.push('meaning 等於 word 或空值');
  // 9
  if (tk.length >= 6 && tk.length <= 18) score++; else reasons.push('example 長度不在 6-18');
  // 10
  if (example && includesWord(example, word)) score++; else fatal.push('example 缺目標 word 或空值');
  // 11 weak grammar verb
  if (tk.some(t => verbHints.has(t.toLowerCase()) || /(ed|ing|s)$/.test(t.toLowerCase()))) score++; else reasons.push('example 缺少可辨識動詞');
  // 12 weak semantics
  if (example && /[A-Za-z]/.test(example) && !/[^\x00-\x7F]/.test(example)) score++; else reasons.push('example 語意/語言型態可疑');
  // 13 business context soft
  if (businessHints.some(h => example.toLowerCase().includes(h))) score++; else reasons.push('example 商務語境較弱');
  // 14 template soft
  if (!/team .*workflow|handled .* content/i.test(example)) score++; else reasons.push('example 疑似模板');
  // 15 bad collocation fatal pattern
  if (!badPatterns.some(r => r.test(example))) score++; else fatal.push('example 命中明顯錯誤搭配 pattern');
  // 16
  if (exampleZh && /[\u4e00-\u9fff]/.test(exampleZh)) score++; else fatal.push('example_zh 空值或非繁中');
  // 17
  if (exampleZh.length >= 6) score++; else reasons.push('example_zh 翻譯資訊不足');
  // 18
  if (!/[A-Za-z]{4,}/.test(exampleZh)) score++; else fatal.push('example_zh 含大量英文');
  // 19
  if (!/團隊在工作流程中處理了這項內容/.test(exampleZh)) score++; else reasons.push('example_zh 偏模板化');
  // 20
  if (!/團隊在工作流程中處理了這項內容/.test(exampleZh)) score++; else reasons.push('example_zh 命中特定禁句');

  let level = 'pass';
  if (fatal.length > 0) level = 'obvious';
  else if (score >= 18) level = 'pass';
  else if (score >= 15) level = 'suspicious';
  else level = 'obvious';

  if (level === 'pass') pass++;
  if (level === 'suspicious') suspicious++;
  if (level === 'obvious') obvious++;

  if (level !== 'pass') {
    issues.push({ level, word, pos: row.pos, score, fatal, reasons, example, example_zh: exampleZh, suggestion: level === 'obvious' ? '優先修正致命欄位（詞性/例句/中譯）' : '建議人工優化自然度與商務語境' });
  }
}

const total = words.length;
const errorRate = total ? ((obvious / total) * 100) : 0;
const suspiciousRate = total ? ((suspicious / total) * 100) : 0;
let mergeRecommendation = '可以 merge，但建議後續人工優化';
if (obvious > 0) mergeRecommendation = '不建議 merge';
else if (suspicious > 30) mergeRecommendation = '不建議 merge，需再修一輪';

const report = {
  generated_at: new Date().toISOString(),
  total,
  pass_count: pass,
  suspicious_count: suspicious,
  obvious_error_count: obvious,
  error_rate: Number(errorRate.toFixed(2)),
  suspicious_rate: Number(suspiciousRate.toFixed(2)),
  merge_recommendation: mergeRecommendation,
  issues
};
fs.writeFileSync('tools/vocab-audit/full-human-check.json', JSON.stringify(report, null, 2));

const block = (title, level) => {
  const rows = issues.filter(i => i.level === level);
  if (!rows.length) return `## ${title}\n\n- 無\n`;
  return `## ${title}\n\n` + rows.map(r => `- word: ${r.word}\n- pos: ${r.pos}\n- score: ${r.score}/20\n- example: ${r.example}\n- example_zh: ${r.example_zh}\n- 問題原因: ${[...r.fatal, ...r.reasons].join('；')}\n- 建議修正: ${r.suggestion}\n`).join('\n');
};

const md = `# 全數字庫人工品質驗證報告\n\n- 總驗證數：${total}\n- 正常數：${pass}\n- 有疑慮數：${suspicious}\n- 錯誤數：${obvious}\n- 錯誤率：${errorRate.toFixed(2)}%\n- 有疑慮比例：${suspiciousRate.toFixed(2)}%\n- 是否建議 merge：${mergeRecommendation}\n\n${block('❌ 明顯錯誤', 'obvious')}\n${block('⚠️ 有疑慮', 'suspicious')}\n`;
fs.writeFileSync('tools/vocab-audit/full-human-check.md', md);

console.log(`Full audit done: total=${total}, pass=${pass}, suspicious=${suspicious}, obvious=${obvious}`);
