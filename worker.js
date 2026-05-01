const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const LOCAL_LOOKUP = {
  issued: '已簽發',
  arranged: '已安排',
  received: '已收到',
  updated: '已更新',
  submitted: '已提交',
  prepared: '已準備',
  reviewed: '已審查',
  approved: '已核准',
  approval: '核准',
  expense: '費用',
  additional: '額外的',
  assignment: '任務',
  applicant: '申請人',
  application: '申請',
  document: '文件',
  report: '報告',
  schedule: '時程',
  delivery: '交付',
  logistics: '物流',
  warehouse: '倉庫',
  inventory: '庫存',
  shipping: '運輸',
  shipment: '貨運',
  contract: '合約',
  invoice: '發票',
  payment: '付款',
  supplier: '供應商',
  vendor: '供應商',
  customer: '顧客',
  manager: '經理',
  while: '當…時',
  because: '因為',
  if: '如果',
  an: '一個',
  unless: '除非',
  administrator: '管理人員',
  confirmed: '確認',
  soon: '很快',
  project: '專案',
  timeline: '時程',
  adjusted: '調整',
  boosted: '提升',
  significantly: '顯著地',
  crucial: '關鍵的',
  division: '部門',
  mattered: '重要；有關係',
  during: '在…期間',
  yesterday: '昨天',
  client: '客戶',
  sales: '業務',
  team: '團隊',
  accounting: '會計',
  scheduling: '排班；排程',
  meeting: '會議',
  acquisition: '收購',
  firm: '公司',
  presence: '存在感；影響力',
  workflow: '工作流程',
  software: '軟體',
  efficiency: '效率',
  support: '支援',
  desk: '服務台',
  service: '服務',
  record: '紀錄',
  review: '審查',
  revised: '修訂',
  completed: '完成',
  before: '在…之前',
  after: '在…之後',
  for: '為了；給',
  why: '為什麼',
  the: '這個；該',
  a: '一個',
  of: '的',
  to: '到；對',
  in: '在…裡',
  on: '在…上',

  at: '在',
  by: '由；藉由',
  with: '和；使用',
  our: '我們的',
  its: '它的'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/load' && request.method === 'GET') {
      return handleLoad(url, env);
    }

    if (url.pathname === '/save' && request.method === 'POST') {
      return handleSave(request, env);
    }

    if (url.pathname === '/generate-example' && request.method === 'POST') {
      return handleGenerateExample(request, env);
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, lookup: true });
    }
    if (url.pathname === '/lookup-word-test' && request.method === 'GET') {
      return handleLookupWordTest(url, env);
    }
    if (url.pathname === '/lookup-word' && request.method === 'POST') {
      return handleLookupWord(request, env);
    }

    if (url.pathname === '/api/quick-translate' && request.method === 'POST') {
      return handleQuickTranslateCompat(request, env);
    }

    return json({ error: 'Not found' }, 404);
  }
};

async function handleLoad(url, env) {
  const syncCode = (url.searchParams.get('syncCode') || '').trim();
  if (!syncCode) return json({ error: 'syncCode required' }, 400);
  const raw = await env.TOEIC_STATE_KV.get(syncCode);
  if (!raw) return json({ state: null });
  try {
    return json({ state: JSON.parse(raw) });
  } catch {
    return json({ state: null });
  }
}

async function handleSave(request, env) {
  const body = await request.json().catch(() => null);
  const syncCode = String(body?.syncCode || '').trim();
  if (!syncCode) return json({ error: 'syncCode required' }, 400);
  if (!body || typeof body.state !== 'object' || body.state === null) {
    return json({ error: 'state required' }, 400);
  }
  await env.TOEIC_STATE_KV.put(syncCode, JSON.stringify(body.state));
  return json({ ok: true, savedAt: new Date().toISOString() });
}

async function handleGenerateExample(request, env) {
  const body = await request.json().catch(() => null);
  const word = String(body?.word || '').trim();
  if (!word) return json({ error: 'word required' }, 400);
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY missing' }, 500);

  const prompt = `Generate ONE short and natural TOEIC-style sentence using the word "${word}".

Rules:
- 8 to 12 words if possible
- Natural English
- Simple grammar
- One clear idea only
- Business or daily workplace context
- The target word must be used correctly
- Do NOT force the word into an unnatural business sentence
- If the word is not suitable for business context, use a simple daily context
- Avoid vague phrases like "linked to", "affected audit preparation", "service record"
- Avoid strange abstract sentences
- Avoid overly formal sentences
- Traditional Chinese must be natural and match the English meaning
- Chinese translation should not be word-for-word

Return exactly:
EN: ...
ZH: ...`;

  let content = await callOpenAIExample(env.OPENAI_API_KEY, prompt);
  const en = extractLineValue(content, 'EN');
  if (!en || countEnglishWords(en) > 12) {
    const retryPrompt = `${prompt}\n\nPlease keep EN to 8-12 words and still return exactly EN/ZH format.`;
    content = await callOpenAIExample(env.OPENAI_API_KEY, retryPrompt);
  }

  return json({
    choices: [
      {
        message: {
          content
        }
      }
    ]
  });
}

async function handleLookupWord(request, env) {
  try {
    const body = await request.json().catch(() => null);
    const word = normalizeLookupWord(body?.word);
    if (!word) return json({ meaning: '查不到翻譯' });

    if (LOCAL_LOOKUP[word]) return json({ meaning: LOCAL_LOOKUP[word] });
    if (!env.OPENAI_API_KEY) return json({ meaning: '查不到翻譯' });

    const prompt = `Translate this English word to Traditional Chinese.

Word: ${word}

Rules:
- Return only the most common Traditional Chinese meaning
- No explanation
- No punctuation
- Maximum 8 Chinese characters
- If it is a verb form, translate the base meaning naturally
- If it is an adverb, translate as an adverb

Examples:
boosted -> 提升
significantly -> 顯著地
crucial -> 關鍵的
unless -> 除非
division -> 部門`;

    const meaning = String(await callOpenAIText(env.OPENAI_API_KEY, prompt)).trim();
    return json({ meaning: meaning || '查不到翻譯' });
  } catch (error) {
    console.error('lookup-word failed', error);
    return json({ meaning: '查不到翻譯' });
  }
}

async function handleLookupWordTest(url, env) {
  const word = normalizeLookupWord(url.searchParams.get('word'));
  if (!word) return json({ word: '', meaning: '查不到翻譯' });
  const meaningRes = await handleLookupWord(
    new Request('https://local/lookup-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word })
    }),
    env
  );
  const payload = await meaningRes.json().catch(() => ({ meaning: '查不到翻譯' }));
  return json({ word, meaning: String(payload?.meaning || '查不到翻譯') });
}

async function handleQuickTranslateCompat(request, env) {
  const res = await handleLookupWord(request, env);
  const data = await res.json().catch(() => null);
  const meaning = String(data?.meaning || '').trim() || '查不到翻譯';
  return json({ zh: meaning, meaning });
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You design natural TOEIC learning examples and must return strict JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';

  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const candidate = content.match(/\{[\s\S]*\}/)?.[0] || '';
    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch {
        parsed = null;
      }
    }
  }

  return {
    short: String(parsed?.short || '').trim() || 'The team checks the report now.',
    long: String(parsed?.long || '').trim() || 'The team reviews the monthly report before the meeting starts.',
    zh_short: String(parsed?.zh_short || '').trim() || '團隊現在檢查報告。',
    zh_long: String(parsed?.zh_long || '').trim() || '團隊在會議開始前審閱每月報告。'
  };
}

async function callOpenAIExample(apiKey, prompt) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You create short, natural TOEIC example lines. Return exactly two lines: EN and ZH.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }
  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  const fallback = 'EN: The team updated the report before the meeting.\nZH: 團隊在會議前更新了報告。';
  const en = extractLineValue(content, 'EN');
  const zh = extractLineValue(content, 'ZH');
  if (!en || !zh) return fallback;
  return `EN: ${en}\nZH: ${zh}`;
}

function extractLineValue(content, key) {
  const match = String(content || '').match(new RegExp(`${key}:\\s*(.+)`, 'i'));
  return String(match?.[1] || '').trim();
}

async function callOpenAIDictionaryEntry(apiKey, prompt, fallbackWord = '') {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You generate compact dictionary entries. Return strict JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }
  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const candidate = content.match(/\{[\s\S]*\}/)?.[0] || '';
    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch {
        parsed = null;
      }
    }
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid dictionary JSON');
  const word = String(parsed.word || fallbackWord || '').trim().toLowerCase();
  const meaning = String(parsed.meaning || '').trim();
  if (!word || !meaning) throw new Error('Invalid dictionary payload');
  return {
    word,
    meaning,
    pos: String(parsed.pos || '').trim(),
    example: String(parsed.example || '').trim(),
    example_zh: String(parsed.example_zh || '').trim()
  };
}

async function callOpenAIText(apiKey, prompt) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You translate English words into concise Traditional Chinese. Return plain text only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}


function normalizeLookupWord(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z]/g, '');
}

function countEnglishWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}
