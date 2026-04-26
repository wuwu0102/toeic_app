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
    if (url.pathname === '/lookup-word' && request.method === 'POST') {
      return handleLookupWord(request, env);
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

  const prompt = `你是專門設計 TOEIC 學習句子的助手。

請產生兩種例句（JSON 格式）：

{
  "short": "短句（8-12字，口語、好記，只包含一個動作）",
  "long": "正式句（偏商業 TOEIC，15-20字）",
  "zh_short": "短句中文翻譯",
  "zh_long": "長句中文翻譯"
}

規則：
1. short 必須簡單、直覺、可快速記憶
2. long 可以正式，但不能太複雜（最多一個子句）
3. 不要使用太冷門或學術詞
4. 句子一定要自然、真實場景
5. 不要解釋，只回傳 JSON

目標單字：${word}`;

  let result = await callOpenAI(env.OPENAI_API_KEY, prompt);
  if (countEnglishWords(result.short) > 12) {
    const retryPrompt = `${prompt}\n\nshort 太長，請將 short 控制在 8-12 個英文單字並只輸出 JSON。`;
    const retry = await callOpenAI(env.OPENAI_API_KEY, retryPrompt);
    result = retry;
  }

  return json({
    choices: [
      {
        message: {
          content: JSON.stringify(result)
        }
      }
    ]
  });
}

async function handleLookupWord(request, env) {
  const body = await request.json().catch(() => null);
  const word = String(body?.word || '').trim().toLowerCase();
  if (!word) return json({ error: 'word required' }, 400);
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY missing' }, 500);

  const prompt = `請給我這個英文單字的中文意思（非常簡短，不超過10字）。
word: ${word}
只回傳純文字。`;
  const meaning = await callOpenAIText(env.OPENAI_API_KEY, prompt);
  return json({ meaning });
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

async function callOpenAIText(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
  return String(data?.choices?.[0]?.message?.content || '').trim() || '無翻譯';
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
