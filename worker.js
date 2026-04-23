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

  const prompt = `Generate ONE short TOEIC-style example sentence using the word "${word}".\n\nRules:\n- Max 12 words\n- Simple grammar\n- Focus on one clear business idea\n- Suitable for fill-in-the-blank quiz\n- Avoid long clauses\n- Prefer present tense when natural\n- Traditional Chinese translation must also be concise and natural\n\nReturn exactly in this format:\nEN: ...\nZH: ...`;

  let result = await callOpenAI(env.OPENAI_API_KEY, prompt);
  if (countEnglishWords(result.en) > 12) {
    const retryPrompt = `${prompt}\n\nThe previous EN sentence was too long. Please shorten it to 12 words or fewer.`;
    const retry = await callOpenAI(env.OPENAI_API_KEY, retryPrompt);
    result = retry;
  }

  return json({
    choices: [
      {
        message: {
          content: `EN: ${result.en}\nZH: ${result.zh}`
        }
      }
    ]
  });
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
          content: 'You write concise TOEIC learning examples and follow output format exactly.'
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
  const enMatch = content.match(/EN:\s*([\s\S]*?)\r?\nZH:/);
  const zhMatch = content.match(/ZH:\s*([\s\S]*)$/);

  return {
    en: (enMatch?.[1] || '').trim() || 'The team reviews the report today.',
    zh: (zhMatch?.[1] || '').trim() || '團隊今天審閱報告。'
  };
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
