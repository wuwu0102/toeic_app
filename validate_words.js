const fs = require('fs');
const vm = require('vm');

function loadWords() {
  const code = fs.readFileSync('words_library.js', 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  if (!Array.isArray(ctx.window.WORDS)) throw new Error('window.WORDS is not an array');
  return ctx.window.WORDS;
}

function checkFrontendCompatibility() {
  const html = fs.readFileSync('index.html', 'utf8');
  const order = [...html.matchAll(/<script\s+defer\s+src="\.\/(.*?)"\s*><\/script>/g)].map(m => m[1]);
  const wordsIdx = order.indexOf('words_library.js');
  const appIdx = order.indexOf('app.js');
  let issues = 0;
  if (wordsIdx === -1 || appIdx === -1) issues += 1;
  else if (wordsIdx > appIdx) issues += 1;
  return { issues, order };
}

function runValidation(words) {
  const required = ['word', 'pos', 'level', 'category', 'topic', 'meaning', 'example', 'example_zh'];
  const allowedWord = /^[a-z][a-z0-9-]*$/i;
  const extraSpace = /\s{2,}/;
  const weirdBreak = /[\r\n\t]/;
  const weakMeaning = /(做|東西|事情|問題|項目|處理)/;
  const weakExample = /(lorem ipsum|very very|blah|test test)/i;

  const duplicates = [];
  const nonSingleWord = [];
  const missingFields = [];
  const emptyValues = [];
  const typeMismatches = [];
  const schemaInconsistencies = [];
  const stringAnomalies = [];
  const badMeanings = [];
  const badExamples = [];

  const seen = new Map();
  const typeByField = {};

  words.forEach((item, index) => {
    const word = String(item.word ?? '').trim();
    const key = word.toLowerCase();

    if (!word || /\s/.test(word) || !allowedWord.test(word)) nonSingleWord.push({ index, word: item.word });

    if (seen.has(key)) duplicates.push({ word: key, first: seen.get(key), second: index });
    else seen.set(key, index);

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

    const meaning = String(item.meaning ?? '').trim();
    if (!meaning || weakMeaning.test(meaning)) badMeanings.push({ index, word, meaning });

    const example = String(item.example ?? '').trim();
    const exampleZh = String(item.example_zh ?? '').trim();
    if (!example || example.length < 20 || weakExample.test(example) || !/[A-Za-z]/.test(example) || !/[.?!]$/.test(example)) badExamples.push({ index, word, field: 'example' });
    if (!exampleZh || exampleZh.length < 8 || weakExample.test(exampleZh) || !/。$/.test(exampleZh)) badExamples.push({ index, word, field: 'example_zh' });
  });

  const frontend = checkFrontendCompatibility();

  return {
    validWordCount: words.length,
    duplicates: duplicates.length,
    nonSingleWord: nonSingleWord.length,
    missingFields: missingFields.length,
    emptyValues: emptyValues.length,
    typeMismatches: typeMismatches.length,
    schemaInconsistencies: schemaInconsistencies.length,
    stringAnomalies: stringAnomalies.length,
    badMeanings: badMeanings.length,
    badExamples: badExamples.length,
    frontendIssues: frontend.issues,
    details: { duplicates, nonSingleWord, missingFields, emptyValues, typeMismatches, schemaInconsistencies, stringAnomalies, badMeanings, badExamples, scriptOrder: frontend.order }
  };
}

try {
  const words = loadWords();
  const result = runValidation(words);
  console.log(JSON.stringify({
    validWordCount: result.validWordCount,
    duplicates: result.duplicates,
    nonSingleWord: result.nonSingleWord,
    missingFields: result.missingFields,
    emptyValues: result.emptyValues,
    typeMismatches: result.typeMismatches,
    schemaInconsistencies: result.schemaInconsistencies,
    stringAnomalies: result.stringAnomalies,
    badMeanings: result.badMeanings,
    badExamples: result.badExamples,
    frontendIssues: result.frontendIssues
  }, null, 2));

  const failed = (
    result.validWordCount !== 1500 ||
    result.duplicates !== 0 ||
    result.nonSingleWord !== 0 ||
    result.missingFields !== 0 ||
    result.emptyValues !== 0 ||
    result.typeMismatches !== 0 ||
    result.schemaInconsistencies !== 0 ||
    result.stringAnomalies !== 0 ||
    result.badMeanings !== 0 ||
    result.badExamples !== 0 ||
    result.frontendIssues !== 0
  );

  if (failed) {
    for (const [k, v] of Object.entries(result.details)) {
      if (Array.isArray(v) && v.length) console.log(`\n[${k}]`, JSON.stringify(v.slice(0, 20), null, 2));
    }
    process.exit(1);
  }
} catch (e) {
  console.error('Validation failed:', e.message);
  process.exit(1);
}
