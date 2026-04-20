const fs = require('fs');
const vm = require('vm');

function loadWords(file = 'words_library.js') {
  const code = fs.readFileSync(file, 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  if (!Array.isArray(ctx.window.WORDS)) throw new Error(`${file}: window.WORDS is not an array`);
  return ctx.window.WORDS;
}

function checkFrontendCompatibility() {
  const html = fs.readFileSync('index.html', 'utf8');
  const order = [...html.matchAll(/<script\s+defer\s+src="\.\/(.*?)"\s*><\/script>/g)].map((m) => m[1]);
  const wordsIdx = order.indexOf('words_library.js');
  const appIdx = order.indexOf('app.js');
  let issues = 0;
  if (wordsIdx === -1 || appIdx === -1) issues += 1;
  else if (wordsIdx > appIdx) issues += 1;
  return { issues, order };
}

function normalizeTokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

function containsWordOrVariant(word, sentence) {
  const lowerWord = String(word || '').toLowerCase();
  const lowerSentence = String(sentence || '').toLowerCase();
  if (!lowerWord || !lowerSentence) return false;
  if (new RegExp(`\\b${lowerWord}\\b`, 'i').test(lowerSentence)) return true;
  const variants = [
    `${lowerWord}s`, `${lowerWord}es`, `${lowerWord}ed`, `${lowerWord}ing`,
    `${lowerWord}d`, `${lowerWord}er`, `${lowerWord}est`,
  ];
  if (lowerWord.endsWith('y')) variants.push(`${lowerWord.slice(0, -1)}ies`, `${lowerWord.slice(0, -1)}ied`);
  if (lowerWord.endsWith('e')) variants.push(`${lowerWord.slice(0, -1)}ing`);
  return variants.some((v) => new RegExp(`\\b${v}\\b`, 'i').test(lowerSentence));
}

function runValidation(words) {
  const required = ['word', 'pos', 'level', 'category', 'topic', 'meaning', 'example', 'example_zh'];
  const allowedWord = /^[a-z][a-z0-9-]*$/i;
  const posAllowed = new Set(['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'phr.']);
  const extraSpace = /\s{2,}/;
  const weirdBreak = /[\r\n\t]/;

  const duplicates = [];
  const missingFields = [];
  const emptyValues = [];
  const typeMismatches = [];
  const schemaInconsistencies = [];
  const stringAnomalies = [];
  const badExamples = [];
  const invalidPos = [];
  const invalidWord = [];
  const exampleMismatch = [];
  const duplicateExamples = [];
  const highSimilarityPairs = [];

  const seenWord = new Map();
  const seenExample = new Map();
  const typeByField = {};

  words.forEach((item, index) => {
    const word = String(item.word ?? '').trim();
    const key = word.toLowerCase();

    if (!word || !allowedWord.test(word)) invalidWord.push({ index, word: item.word });

    if (seenWord.has(key)) duplicates.push({ word: key, first: seenWord.get(key), second: index });
    else seenWord.set(key, index);

    const keys = Object.keys(item).sort();
    const requiredSorted = [...required].sort();
    if (keys.join('|') !== requiredSorted.join('|')) schemaInconsistencies.push({ index, keys });

    for (const f of required) {
      if (!(f in item)) {
        missingFields.push({ index, field: f });
        continue;
      }
      if (item[f] === null || item[f] === undefined) {
        emptyValues.push({ index, field: f, value: item[f] });
        continue;
      }
      if (typeof item[f] === 'string' && item[f].trim() === '') emptyValues.push({ index, field: f, value: item[f] });
    }

    for (const f of required) {
      const t = typeof item[f];
      if (!typeByField[f]) typeByField[f] = t;
      else if (typeByField[f] !== t) typeMismatches.push({ index, field: f, expected: typeByField[f], actual: t });
    }

    for (const f of required) {
      if (typeof item[f] !== 'string') continue;
      if (item[f] !== item[f].trim() || extraSpace.test(item[f]) || weirdBreak.test(item[f])) stringAnomalies.push({ index, field: f });
    }

    const pos = String(item.pos ?? '').trim();
    if (!posAllowed.has(pos)) invalidPos.push({ index, word, pos });

    const example = String(item.example ?? '').trim();
    const exampleZh = String(item.example_zh ?? '').trim();

    if (!example || example.length < 20 || !/[A-Za-z]/.test(example) || !/[.?!]$/.test(example)) {
      badExamples.push({ index, word, field: 'example' });
    }
    if (!exampleZh || exampleZh.length < 10 || !/。$/.test(exampleZh)) {
      badExamples.push({ index, word, field: 'example_zh' });
    }
    if (!containsWordOrVariant(word, example)) {
      exampleMismatch.push({ index, word, example });
    }

    const normalized = normalizeTokens(example).join(' ');
    if (seenExample.has(normalized)) {
      duplicateExamples.push({
        first: seenExample.get(normalized),
        second: index,
        text: example,
      });
    } else {
      seenExample.set(normalized, index);
    }
  });

  // Near-duplicate similarity scan (full library, O(n^2), manageable for 1500)
  const tokenized = words.map((w) => normalizeTokens(w.example));
  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const sim = jaccard(tokenized[i], tokenized[j]);
      if (sim >= 0.92) {
        highSimilarityPairs.push({ i, j, sim: Number(sim.toFixed(3)) });
      }
    }
  }

  const frontend = checkFrontendCompatibility();

  return {
    totalWordCount: words.length,
    verifiedWordCount: words.length,
    duplicates: duplicates.length,
    missingFields: missingFields.length,
    emptyValues: emptyValues.length,
    typeMismatches: typeMismatches.length,
    schemaInconsistencies: schemaInconsistencies.length,
    stringAnomalies: stringAnomalies.length,
    invalidPos: invalidPos.length,
    invalidWord: invalidWord.length,
    badExamples: badExamples.length,
    exampleMismatch: exampleMismatch.length,
    duplicateExamples: duplicateExamples.length,
    highSimilarityPairs: highSimilarityPairs.length,
    frontendIssues: frontend.issues,
    details: {
      duplicates,
      missingFields,
      emptyValues,
      typeMismatches,
      schemaInconsistencies,
      stringAnomalies,
      invalidPos,
      invalidWord,
      badExamples,
      exampleMismatch,
      duplicateExamples,
      highSimilarityPairs: highSimilarityPairs.slice(0, 100),
      scriptOrder: frontend.order,
    },
  };
}

try {
  const words = loadWords('words_library.js');
  const mirrorWords = loadWords('eng-learning/words_library.js');

  if (JSON.stringify(words) !== JSON.stringify(mirrorWords)) {
    console.error('Validation failed: words_library.js and eng-learning/words_library.js are not identical');
    process.exit(1);
  }

  const result = runValidation(words);

  console.log(JSON.stringify({
    totalWordCount: result.totalWordCount,
    verifiedWordCount: result.verifiedWordCount,
    duplicates: result.duplicates,
    missingFields: result.missingFields,
    emptyValues: result.emptyValues,
    typeMismatches: result.typeMismatches,
    schemaInconsistencies: result.schemaInconsistencies,
    stringAnomalies: result.stringAnomalies,
    invalidPos: result.invalidPos,
    invalidWord: result.invalidWord,
    badExamples: result.badExamples,
    exampleMismatch: result.exampleMismatch,
    duplicateExamples: result.duplicateExamples,
    highSimilarityPairs: result.highSimilarityPairs,
    frontendIssues: result.frontendIssues,
  }, null, 2));

  for (const [k, v] of Object.entries(result.details)) {
    if (Array.isArray(v) && v.length) {
      console.log(`\n[${k}]`, JSON.stringify(v.slice(0, 30), null, 2));
    }
  }

  const failed = (
    result.totalWordCount < 1000 ||
    result.duplicates !== 0 ||
    result.missingFields !== 0 ||
    result.emptyValues !== 0 ||
    result.typeMismatches !== 0 ||
    result.schemaInconsistencies !== 0 ||
    result.stringAnomalies !== 0 ||
    result.invalidPos !== 0 ||
    result.invalidWord !== 0 ||
    result.badExamples !== 0 ||
    result.exampleMismatch !== 0 ||
    result.duplicateExamples !== 0 ||
    result.highSimilarityPairs !== 0 ||
    result.frontendIssues !== 0
  );

  if (failed) process.exit(1);
} catch (e) {
  console.error('Validation failed:', e.message);
  process.exit(1);
}
