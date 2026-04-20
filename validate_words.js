const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_LIBRARY = 'words_library.js';
const MIRROR_LIBRARY = path.join('eng-learning', 'words_library.js');

function loadWords(file) {
  const code = fs.readFileSync(file, 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  if (!Array.isArray(ctx.window.WORDS)) throw new Error(`${file}: window.WORDS is not an array`);
  return ctx.window.WORDS;
}

function normalizeForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const stop = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'it', 'as', 'or', 'we', 'our', 'you', 'your', 'they', 'their', 'he', 'she', 'his', 'her', 'will', 'can', 'must', 'before', 'after', 'during', 'each']);
  return normalizeForCompare(text).split(' ').filter(t => t && !stop.has(t));
}

function jaccard(a, b) {
  const as = new Set(a);
  const bs = new Set(b);
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter += 1;
  const union = as.size + bs.size - inter;
  return union ? inter / union : 0;
}

function checkFrontendChain() {
  const html = fs.readFileSync('index.html', 'utf8');
  const scriptOrder = [...html.matchAll(/<script\s+defer\s+src="\.\/(.*?)"\s*><\/script>/g)].map(m => m[1]);
  const wordsIdx = scriptOrder.indexOf('words_library.js');
  const appIdx = scriptOrder.indexOf('app.js');
  const configIdx = scriptOrder.indexOf('config.js');

  const issues = [];
  if (wordsIdx === -1) issues.push('index.html does not load words_library.js');
  if (appIdx === -1) issues.push('index.html does not load app.js');
  if (configIdx === -1) issues.push('index.html does not load config.js');
  if (wordsIdx !== -1 && appIdx !== -1 && wordsIdx > appIdx) issues.push('words_library.js must load before app.js');

  const appJs = fs.readFileSync('app.js', 'utf8');
  if (!appJs.includes('window.WORDS')) issues.push('app.js does not read window.WORDS');

  return { scriptOrder, issues };
}

function checkMirror(mainWords) {
  if (!fs.existsSync(MIRROR_LIBRARY)) {
    return { exists: false, required: false, inSync: true, issues: [] };
  }

  const mirrorWords = loadWords(MIRROR_LIBRARY);
  const mainSerialized = JSON.stringify(mainWords);
  const mirrorSerialized = JSON.stringify(mirrorWords);
  const inSync = mainSerialized === mirrorSerialized;

  return {
    exists: true,
    required: false,
    inSync,
    issues: inSync ? [] : ['Mirror vocabulary exists but is out of sync with root library']
  };
}

function validateWords(words) {
  const required = ['word', 'pos', 'level', 'category', 'topic', 'meaning', 'example', 'example_zh'];
  const wordRe = /^[a-z][a-z0-9-]*$/i;
  const sentenceZhRe = /[。！？]$/;

  const missingFields = [];
  const emptyExamples = [];
  const emptyZh = [];
  const nonSentenceZh = [];
  const malformedWords = [];
  const senseMismatches = [];
  const duplicateExamples = [];
  const highSimilarityPairs = [];

  const exampleMap = new Map();
  const tokenized = [];

  words.forEach((w, idx) => {
    for (const f of required) {
      if (!(f in w)) missingFields.push({ index: idx + 1, word: w.word, field: f });
    }

    const word = String(w.word || '').trim();
    const example = String(w.example || '').trim();
    const exampleZh = String(w.example_zh || '').trim();

    if (!wordRe.test(word)) malformedWords.push({ index: idx + 1, word });
    if (!example) emptyExamples.push({ index: idx + 1, word });
    if (!exampleZh) emptyZh.push({ index: idx + 1, word });

    if (exampleZh && (!sentenceZhRe.test(exampleZh) || /[A-Za-z]{4,}/.test(exampleZh) || exampleZh.length < 10)) {
      nonSentenceZh.push({ index: idx + 1, word, example_zh: exampleZh });
    }

    if (word && example && !new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(example)) {
      senseMismatches.push({ index: idx + 1, word, example });
    }

    const normalizedExample = normalizeForCompare(example);
    if (normalizedExample) {
      if (exampleMap.has(normalizedExample)) {
        duplicateExamples.push({
          first: exampleMap.get(normalizedExample),
          second: idx + 1,
          example
        });
      } else {
        exampleMap.set(normalizedExample, idx + 1);
      }
    }

    tokenized.push({ index: idx + 1, word, tokens: tokenize(example), example });
  });

  for (let i = 0; i < tokenized.length; i += 1) {
    for (let j = i + 1; j < tokenized.length; j += 1) {
      const score = jaccard(tokenized[i].tokens, tokenized[j].tokens);
      if (score >= 0.92) {
        highSimilarityPairs.push({
          a: tokenized[i].index,
          b: tokenized[j].index,
          score: Number(score.toFixed(3)),
          exampleA: tokenized[i].example,
          exampleB: tokenized[j].example
        });
      }
    }
  }

  return {
    totalWordCount: words.length,
    verifiedWordCount: words.length,
    missingFields,
    emptyExamples,
    emptyZh,
    nonSentenceZh,
    malformedWords,
    senseMismatches,
    duplicateExamples,
    highSimilarityPairs
  };
}

function main() {
  const words = loadWords(ROOT_LIBRARY);
  const frontend = checkFrontendChain();
  const mirror = checkMirror(words);
  const validation = validateWords(words);

  const summary = {
    totalWordCount: validation.totalWordCount,
    verifiedWordCount: validation.verifiedWordCount,
    missingFields: validation.missingFields.length,
    emptyExamples: validation.emptyExamples.length,
    emptyZh: validation.emptyZh.length,
    nonSentenceZh: validation.nonSentenceZh.length,
    malformedWords: validation.malformedWords.length,
    senseMismatches: validation.senseMismatches.length,
    duplicateExamples: validation.duplicateExamples.length,
    highSimilarityPairs: validation.highSimilarityPairs.length,
    frontendSourceIssues: frontend.issues.length,
    mirrorExists: mirror.exists,
    mirrorRequired: mirror.required,
    mirrorInSync: mirror.inSync
  };

  console.log(JSON.stringify(summary, null, 2));

  const details = {
    frontendScriptOrder: frontend.scriptOrder,
    frontendIssues: frontend.issues,
    mirrorIssues: mirror.issues,
    missingFields: validation.missingFields.slice(0, 20),
    emptyExamples: validation.emptyExamples.slice(0, 20),
    emptyZh: validation.emptyZh.slice(0, 20),
    nonSentenceZh: validation.nonSentenceZh.slice(0, 20),
    malformedWords: validation.malformedWords.slice(0, 20),
    senseMismatches: validation.senseMismatches.slice(0, 20),
    duplicateExamples: validation.duplicateExamples.slice(0, 20),
    highSimilarityPairs: validation.highSimilarityPairs.slice(0, 20)
  };

  Object.entries(details).forEach(([k, v]) => {
    if (Array.isArray(v) && v.length > 0) {
      console.log(`\n[${k}]`);
      console.log(JSON.stringify(v, null, 2));
    }
  });

  const failed = (
    summary.totalWordCount <= 0 ||
    summary.missingFields !== 0 ||
    summary.emptyExamples !== 0 ||
    summary.emptyZh !== 0 ||
    summary.nonSentenceZh !== 0 ||
    summary.malformedWords !== 0 ||
    summary.senseMismatches !== 0 ||
    summary.duplicateExamples !== 0 ||
    summary.highSimilarityPairs !== 0 ||
    summary.frontendSourceIssues !== 0 ||
    !summary.mirrorInSync
  );

  if (failed) process.exit(1);
}

main();
