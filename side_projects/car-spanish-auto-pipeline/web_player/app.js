const DATA_SOURCES = ['../output/result.json', './test_data/sample_result.json'];
const TICK_MS = 100;

const state = {
  lines: [],
  currentTime: 0,
  activeIndex: -1,
  timer: null,
  usingFallback: false,
};

const el = {
  es: document.getElementById('current-es'),
  zh: document.getElementById('current-zh'),
  status: document.getElementById('status'),
};

function normalizeData(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => ({
      start: Number(item?.start ?? item?.start_time),
      end: Number(item?.end ?? item?.end_time),
      es: String(item?.es ?? item?.text ?? '').trim(),
      zh: String(item?.zh ?? item?.translation ?? '').trim(),
    }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.es.length > 0);
}

async function tryFetch(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${url} (${response.status})`);
  }
  return response.json();
}

async function loadData() {
  el.status.textContent = 'loading';

  try {
    const primaryRaw = await tryFetch(DATA_SOURCES[0]);
    const primaryLines = normalizeData(primaryRaw);
    if (primaryLines.length > 0) {
      state.usingFallback = false;
      el.status.textContent = 'playing (backend source)';
      return primaryLines;
    }
  } catch (_) {
    // ignore and fallback below
  }

  try {
    const fallbackRaw = await tryFetch(DATA_SOURCES[1]);
    const fallbackLines = normalizeData(fallbackRaw);
    if (fallbackLines.length > 0) {
      state.usingFallback = true;
      el.status.textContent = 'playing (fallback sample)';
      return fallbackLines;
    }
  } catch (_) {
    // handled below
  }

  return [];
}

function renderLine(line) {
  if (!line) {
    el.es.textContent = 'No subtitles loaded';
    el.zh.textContent = 'No subtitles loaded';
    el.es.classList.remove('active');
    el.zh.classList.remove('active');
    return;
  }

  el.es.textContent = line.es;
  el.zh.textContent = line.zh || ' '; // keep layout stable if translation missing
  el.es.classList.add('active');
  el.zh.classList.add('active');
}

function startPlayback() {
  if (!state.lines.length) {
    el.status.textContent = 'error';
    renderLine(null);
    return;
  }

  renderLine(state.lines[0]);
  state.activeIndex = 0;
  state.currentTime = 0;

  const maxEnd = state.lines[state.lines.length - 1].end;

  state.timer = setInterval(() => {
    state.currentTime += TICK_MS / 1000;

    const nextIndex = state.lines.findIndex((line) => state.currentTime >= line.start && state.currentTime < line.end);

    if (nextIndex !== -1 && nextIndex !== state.activeIndex) {
      state.activeIndex = nextIndex;
      renderLine(state.lines[nextIndex]);
    }

    if (state.currentTime > maxEnd + 0.2) {
      clearInterval(state.timer);
      state.timer = null;
      state.currentTime = 0;
      state.activeIndex = -1;
      startPlayback();
    }
  }, TICK_MS);
}

async function init() {
  state.lines = await loadData();

  if (!state.lines.length) {
    el.status.textContent = 'error';
    renderLine(null);
    return;
  }

  startPlayback();
}

init();
