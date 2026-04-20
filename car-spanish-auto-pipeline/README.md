# car-spanish-auto-pipeline

> 全新獨立專案：**不修改**英文學習專案、`car-spanish-player-v1`、`car-spanish-player-v2`。本專案只產生可供播放器使用的 JSON。

## 專案用途
輸入公開 YouTube 影片 URL 或 videoId，流程會：
1. 解析 YouTube 輸入
2. 優先抓字幕（人工 > 自動）
3. 無字幕時抽音訊 + Whisper 辨識
4. 基本清理分段
5. 翻譯成繁體中文
6. 輸出播放器可直接使用的 JSON
7. 可啟動本地預覽

## 安裝需求
- Python 3.11+
- `ffmpeg`（系統安裝）
- `yt-dlp`（可用 pip 或系統安裝）

## 安裝方式
```bash
cd car-spanish-auto-pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 環境變數
1. 複製 `.env.example`：
```bash
cp .env.example .env
```
2. 如要啟用 OpenAI 翻譯，設定：
```bash
export OPENAI_API_KEY="your_key"
```

> 未設定 API key 時，請使用 `--translator dummy`，流程仍可完整執行。

## CLI 用法
```bash
python -m src.cli --url "https://www.youtube.com/watch?v=<VIDEO_ID>" --out "./output/result.json"
```

### 常用參數
- `--url`：YouTube URL
- `--video-id`：11 碼 videoId
- `--out`：輸出 JSON 路徑（必填）
- `--prefer-subs`：優先字幕流程
- `--force-transcribe`：略過字幕、直接語音辨識
- `--translator dummy|openai`
- `--model tiny|base|small|medium|large-v3`
- `--preview`：輸出後啟動本地預覽

## 情境範例
### 1) 直接抓字幕（預設偏好）
```bash
python -m src.cli --url "https://youtu.be/<VIDEO_ID>" --prefer-subs --translator dummy --out ./output/result.json
```

### 2) 強制語音辨識
```bash
python -m src.cli --url "https://youtu.be/<VIDEO_ID>" --force-transcribe --model small --translator dummy --out ./output/result.json
```

### 3) 開預覽
```bash
python -m src.cli --video-id "dQw4w9WgXcQ" --out ./output/result.json --preview
```
開啟瀏覽器：`http://127.0.0.1:8765`

## 輸出 JSON 格式（對接播放器）
```json
[
  {
    "start": 0.0,
    "end": 2.3,
    "es": "Hola, ¿cómo estás?",
    "zh": "你好，你好嗎？"
  }
]
```
- `start`：起始秒數
- `end`：結束秒數
- `es`：西文字幕
- `zh`：繁中翻譯

## 與 `car-spanish-player-v1 / v2` 串接
1. 先產生 `output/result.json`
2. 在播放器端把資料來源指到此 JSON（fetch / import）
3. 欄位名稱直接對應：`start/end/es/zh`

最簡單下一步：在前端播放器啟動時改成讀取本專案輸出檔（或複製到前端 public 目錄）。

## 錯誤排查
- `yt-dlp not found`：請安裝 yt-dlp 並確認 PATH。
- `ffmpeg not found`：請安裝 ffmpeg。
- 字幕抓不到：影片可能沒有公開字幕，改用 `--force-transcribe`。
- Whisper model 載入失敗：模型名稱錯誤或環境資源不足。
- OpenAI 翻譯不可用：確認 `OPENAI_API_KEY` 與 `openai` 套件。
- JSON 寫出失敗：確認 `--out` 路徑可寫。

## 已知限制
- 本專案只支援使用者提供的公開 YouTube 影片。
- 不處理私有、受限、或未授權影片。
- 無 API key 時翻譯採 Dummy fallback（可完整跑流程但非正式翻譯品質）。

## 目錄結構
```text
car-spanish-auto-pipeline/
  src/
  output/
  samples/
  tests_or_checks/
  web_preview/
  requirements.txt
  README.md
  .env.example
```

## 檢查腳本
```bash
PYTHONPATH=. python tests_or_checks/run_checks.py
```
包含：
- parse_youtube_input（videoId/watch/youtu.be/invalid）
- formatter output
- translator fallback
- pipeline dry-run
