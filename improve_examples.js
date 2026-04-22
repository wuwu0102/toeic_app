#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INPUT_FILE = path.join(__dirname, 'words_library.js');
const OUTPUT_FILE = path.join(__dirname, 'words_library_improved.js');

const UNCOUNTABLE_NOUNS = new Set([
  'accounting',
  'advertising',
  'advice',
  'analysis',
  'administration',
  'equipment',
  'information',
  'research',
  'training'
]);

function loadWords(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { timeout: 2000, filename: filePath });

  if (!Array.isArray(sandbox.window.WORDS)) {
    throw new Error('window.WORDS array not found in words_library.js');
  }

  return sandbox.window.WORDS;
}

function containsTargetWord(sentence, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
  return re.test(sentence);
}

function looksUnnatural(entry) {
  const sentence = String(entry.example || '').trim();
  const word = String(entry.word || '').trim();

  if (!sentence || sentence.length < 20) return true;
  if (!containsTargetWord(sentence, word)) return true;

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const awkwardPatterns = [
    /\blink(?:ed|ing)?\b[^.?!]*\bto\b/i,
    /\bplease\s+enter\b/i,
    /\bwas\s+received\s+from\b/i,
    /\bonce\s+\w+\s+is\s+uploaded\b/i,
    new RegExp(`\\b(?:if|unless|when|once|before|after)\\s+${escaped}\\s+is\\b`, 'i'),
    new RegExp(`(?:^|,\\s*)${escaped}\\s+(?:is|was|will)\\b`, 'i')
  ];

  if (awkwardPatterns.some((re) => re.test(sentence))) return true;

  // A simple score gate: penalize obvious awkward markers.
  let score = 100;
  if (/\bthis quarter\b/i.test(sentence) && /\btreated\b/i.test(sentence)) score -= 20;
  if (/\bremained undocumented\b/i.test(sentence)) score -= 25;
  if (/\brequires closer control across departments\b/i.test(sentence)) score -= 25;

  return score < 85;
}

function isLikelyPersonNoun(word) {
  const personWords = new Set(['administrator', 'advertiser', 'analyst', 'applicant', 'assistant', 'employee', 'manager']);
  if (personWords.has(word)) return true;
  return /(er|or|ist|ant|ee)$/i.test(word);
}

function generateExample(entry, index) {
  const word = entry.word;
  const lowerWord = word.toLowerCase();
  const person = isLikelyPersonNoun(lowerWord);
  const hasThe = UNCOUNTABLE_NOUNS.has(lowerWord) ? 'the ' : 'the ';

  const personTemplates = [
    {
      en: `The ${word} shared updates with the sales team this morning.`,
      zh: `${word} 今天早上向業務團隊說明了最新進度。`
    },
    {
      en: `Our ${word} prepared a clear report for the client meeting.`,
      zh: `我們的 ${word} 為客戶會議準備了一份清楚的報告。`
    },
    {
      en: `The ${word} answered questions during the project review.`,
      zh: `${word} 在專案檢討會中回答了相關問題。`
    }
  ];

  const thingTemplates = [
    {
      en: `${hasThe}${word} was included in this month's business report.`,
      zh: `${word} 已被納入本月的業務報告。`
    },
    {
      en: `We discussed ${hasThe}${word} during the weekly planning meeting.`,
      zh: `我們在每週規劃會議中討論了${word}。`
    },
    {
      en: `Please check ${hasThe}${word} before sending the final email to the client.`,
      zh: `寄出給客戶的最終電子郵件前，請先確認${word}。`
    }
  ];

  const templates = person ? personTemplates : thingTemplates;
  const pick = templates[index % templates.length];

  if (!containsTargetWord(pick.en, word)) {
    throw new Error(`Generated sentence does not include target word: ${word}`);
  }

  return {
    sentence: pick.en,
    translation: pick.zh
  };
}

function buildImprovedWords(words) {
  const cloned = JSON.parse(JSON.stringify(words));
  const updatedWords = [];

  cloned.forEach((entry, index) => {
    const shouldImprove = looksUnnatural(entry);
    if (!shouldImprove) return;

    try {
      const generated = generateExample(entry, index);
      if (generated && generated.sentence && generated.translation) {
        entry.example = generated.sentence;
        entry.example_zh = generated.translation;
        updatedWords.push(entry.word);
      }
    } catch (error) {
      // Safety fallback: keep original data unchanged for this word.
      console.warn(`[SKIP] ${entry.word}: generation failed, kept original. ${error.message}`);
    }
  });

  return { improvedWords: cloned, updatedWords };
}

function writeOutput(words, filePath) {
  const output = `window.WORDS = ${JSON.stringify(words, null, 2)};\n`;
  fs.writeFileSync(filePath, output, 'utf8');
}

function main() {
  try {
    const words = loadWords(INPUT_FILE);
    const { improvedWords, updatedWords } = buildImprovedWords(words);

    writeOutput(improvedWords, OUTPUT_FILE);

    console.log(`Done. Output written to ${path.basename(OUTPUT_FILE)}`);
    console.log(`Updated ${updatedWords.length} words.`);
    if (updatedWords.length > 0) {
      console.log('Updated words:');
      updatedWords.forEach((word) => console.log(`- ${word}`));
    }
    console.log('Original words_library.js was not modified.');
  } catch (error) {
    console.error('Failed to improve examples:', error.message);
    process.exitCode = 1;
  }
}

main();
