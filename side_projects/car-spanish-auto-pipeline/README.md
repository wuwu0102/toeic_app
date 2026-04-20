# CarPlay / 車載西文歌曲字幕系統

本專案是單一用途專案：

- **Backend pipeline**：產生可給前端播放器使用的西文/中文字幕 JSON。
- **web_player**：在車載（CarPlay / 車機）風格畫面顯示西文大字 + 中文次大字字幕。

> 這不是西文學習 app，不是多版本播放器實驗場。

---

## 專案結構

```text
car-spanish-auto-pipeline/
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
    preview_server.py
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
  requirements.txt
  .env.example
  README.md
```

---

## 安裝

```bash
cd /workspace/toeic_app/side_projects/car-spanish-auto-pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

系統需求（若要跑完整 YouTube/語音流程）：

- Python 3.11+
- ffmpeg
- yt-dlp

---

## Backend：執行 pipeline

### 基本執行

```bash
python -m src.cli \
  --url "https://www.youtube.com/watch?v=<VIDEO_ID>" \
  --out ./output/result.json \
  --translator dummy
```

### 強制語音辨識（無字幕時常用）

```bash
python -m src.cli \
  --url "https://www.youtube.com/watch?v=<VIDEO_ID>" \
  --force-transcribe \
  --model small \
  --translator dummy \
  --out ./output/result.json
```

### 產生 output/result.json

請確認 `--out ./output/result.json`，成功後前端會優先讀這個檔案。

如果執行環境暫時無法連 YouTube / Whisper，本專案已提供可直接播放的 `output/result.json`（目前為 **mock output**，格式與正式輸出一致）。

---

## Frontend：開啟 web_player

可用任一靜態伺服器在專案根目錄啟動，例如：

```bash
cd /workspace/toeic_app/side_projects/car-spanish-auto-pipeline
python -m http.server 8080
```

然後打開：

- `http://127.0.0.1:8080/web_player/`

### 載入規則（已實作）

1. 先讀：`../output/result.json`
2. 若失敗，自動 fallback：`./test_data/sample_result.json`

狀態列會顯示目前來源：

- `playing (backend source)`：正式 output
- `playing (fallback sample)`：fallback sample

---

## JSON 格式（前後端對接）

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

`web_player/app.js` 內的 `normalizeData()` 也支援下列 fallback key：

- `start` / `start_time`
- `end` / `end_time`
- `es` / `text`
- `zh` / `translation`

---

## 檢查

```bash
PYTHONPATH=. python tests_or_checks/run_checks.py
```

---

## 已知限制

- 是否能成功抓取 YouTube 字幕，取決於影片是否公開且有字幕。
- 若要走語音辨識，需可用 Whisper 執行環境與模型資源。
- 若使用 OpenAI 翻譯，需要有效的 `OPENAI_API_KEY`。
- 未配置上述外部能力時，可先使用現有 mock `output/result.json` + fallback sample 完成前端驗證。
