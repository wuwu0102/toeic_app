# CarPlay / 車載西文歌曲字幕系統

本目錄是**單一用途專案**：把 YouTube 西文歌曲處理成車載可讀字幕 JSON，並提供簡潔的車載播放器頁面。

- ✅ 這不是西文學習 app。
- ✅ Root TOEIC 英文學習 app 與本專案完全獨立，這次整理僅調整 `side_projects/car-spanish-auto-pipeline`。

---

## 專案結構

```text
side_projects/car-spanish-auto-pipeline/
  src/
    __init__.py
    config.py
    youtube_utils.py
    subtitle_fetcher.py
    audio_extractor.py
    transcriber.py
    translator.py
    formatter.py
    pipeline.py
    cli.py
  output/
    result.json
  web_player/
    index.html
    app.js
    styles.css
    test_data/
      sample_result.json
  tests_or_checks/
    run_checks.py
  .env.example
  requirements.txt
  README.md
```

GitHub Actions workflow：`/.github/workflows/generate_spanish_lyrics.yml`

---

## 目標流程（GitHub 端）

1. 打開 GitHub Actions：**Generate Spanish Lyrics JSON**。
2. 手動觸發（Run workflow）。
3. 在 `youtube_url` 貼入 YouTube 連結。
4. Workflow 會自動：
   - checkout repo
   - 安裝依賴
   - 執行 pipeline
   - 更新 `side_projects/car-spanish-auto-pipeline/output/result.json`
   - 若有變更，自動 commit + push 回 repo

---

## 本地執行 pipeline

```bash
cd /workspace/toeic_app/side_projects/car-spanish-auto-pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m src.cli \
  --url "https://www.youtube.com/watch?v=<VIDEO_ID>" \
  --out "./output/result.json" \
  --prefer-subs \
  --translator dummy
```

輸出格式固定為：

```json
[
  {
    "start": 0.0,
    "end": 2.5,
    "es": "Hola, ¿cómo estás?",
    "zh": "你好嗎？"
  }
]
```

---

## web_player 使用方式

```bash
cd /workspace/toeic_app/side_projects/car-spanish-auto-pipeline
python -m http.server 8080
# open http://127.0.0.1:8080/web_player/
```

### 載入規則

1. 優先讀取 `../output/result.json`
2. 若讀不到或內容無效，fallback 到 `./test_data/sample_result.json`

### 畫面行為

- 顯示西文（大字）與中文（次大字）
- 深色、簡潔、車載導向
- 狀態列：
  - `playing (output result)`
  - `playing (fallback sample)`
- 依時間軸自動切換字幕並循環播放
- `normalizeData()` 支援欄位映射：
  - `start / start_time`
  - `end / end_time`
  - `es / text`
  - `zh / translation`

---

## 自檢

```bash
cd /workspace/toeic_app/side_projects/car-spanish-auto-pipeline
PYTHONPATH=. python tests_or_checks/run_checks.py
```

---

## 已知限制

1. GitHub Actions 與本地環境都依賴影片可公開存取。
2. 字幕流程採「先抓字幕」策略：
   - 先嘗試抓人工字幕 / 自動字幕（最穩定）
   - 若抓不到才 fallback 音訊擷取 + Whisper
3. 若執行環境缺少網路、`yt-dlp`、`ffmpeg` 或 Whisper 模型資源，完整語音辨識可能失敗。
4. `--translator openai` 需設定 `OPENAI_API_KEY`；否則會自動退回 dummy 翻譯。

