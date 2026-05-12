import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE_FILE = 'words_library.js';
const bannedFragments = [
  '同仁已依照內部規範',
  '完成必要的文件紀錄',
  '進行完整討論',
  '確認後續執行安排',
  '此事項',
  '本項目',
  '會後完成'
];

function loadWords(filePath){
  const content = fs.readFileSync(filePath, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(content, context);
  if (!Array.isArray(context.window.WORDS)) throw new Error('window.WORDS is not an array');
  return context.window.WORDS;
}

function main(){
  const words = loadWords(SOURCE_FILE);
  const failures = [];

  words.forEach((entry, index) => {
    const word = String(entry?.word || '').trim();
    const example = String(entry?.example || entry?.example_en || '').trim();
    const exampleZh = String(entry?.example_zh || '').trim();

    if (example && !exampleZh) {
      failures.push({ type: 'missing_translation', index, word, example, exampleZh });
      return;
    }

    const matched = bannedFragments.filter(fragment => exampleZh.includes(fragment));
    if (matched.length) {
      failures.push({ type: 'banned_template', index, word, example, exampleZh, matched });
    }
  });

  if (failures.length) {
    console.error(`❌ Found ${failures.length} invalid example translation entries in ${SOURCE_FILE}`);
    failures.slice(0, 30).forEach(item => {
      const detail = item.type === 'banned_template' ? `matched=${item.matched.join('|')}` : 'missing example_zh';
      console.error(`- #${item.index + 1} ${item.word}: ${detail}`);
    });
    if (failures.length > 30) console.error(`...and ${failures.length - 30} more`);
    process.exit(1);
  }

  console.log(`✅ ${SOURCE_FILE}: all ${words.length} entries passed translation checks.`);
}

main();
