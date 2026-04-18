# TOEIC v7.4

這是可直接部署的前端版本，保留：
- 原本單字卡 / 熟練測驗 / 統計 / 設定
- localStorage 本機進度
- 可選雲端同步 API

## 部署方式

### GitHub Pages
1. 新建 GitHub repo，例如 `toeic-app`
2. 上傳這個資料夾全部檔案
3. 在 GitHub Pages 指向 root
4. 打開 `index.html`

### Codespaces / 本機瀏覽器
- 直接把整個資料夾放進專案根目錄
- 用靜態伺服器開啟即可

## 重要檔案
- `index.html`：主頁
- `styles.css`：樣式
- `config.js`：APP 名稱與 API 設定
- `words_library.js`：單字庫
- `app.js`：主邏輯（v7.4 記憶曲線 + 錯題加權）

## 雲端同步
若你有 Worker API，進設定頁填入 `API_BASE_URL` 或直接在 App 內輸入即可。
