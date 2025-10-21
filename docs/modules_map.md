# 模組與流程對照

## 頁面入口
- `words.html`
  - `scripts/words.js`：管理查詞、列表篩選與輸出 Rime/PIME 格式。
  - `scripts/require-jieba-js.js`、`scripts/main.js`：載入 jieba 分詞並完成初始化。
  - `scripts/rangeFilter.js`、`scripts/extracted_features.js`：提供字詞篩選與欄位解析。
  - `scripts/utils.js`：整合 localStorage、匯出格式與共用工具。
- `dictMaker.html`
  - `scripts/dictMaker.js`：統籌資料流、正規化與去重。
  - `scripts/modules/app.js`：頁面初始化與事件綁定。
  - `scripts/modules/dictCore.js`：核心整理流程（normalize、dedupe、輸出）。
  - `scripts/modules/prefs.js`、`scripts/modules/uiHelpers.js`：偏好設定與 UI 輔助。
  - `scripts/cangjieIntegration.js`、`scripts/cangjieProcessor.js`：倉頡碼查詢與換算。
- 共用元件
  - `html-lib/components/CharLengthOptions/CharLengthOptions.js`：字數限制選項。
  - `html-lib/components/FreeCjLimitSelector/FreeCjLimitSelector.js`：倉頡長度控制。

## 主要資料流程
1. `words.html` 由使用者輸入或既有詞表生成 payload，並以 `window.WORDS_TO_DICTMAKER_KEY` 寫入 `localStorage`。
2. `dictMaker.html` 啟動後由 `scripts/dictMaker.js` 讀取 payload，交由 `dictCore` 進行正規化、分組與字典輸出。
3. 倉頡相關模組在流程中視需要呼叫 `commonCangjie.js` 或外部字表補碼。
4. 匯出階段透過 `scripts/modules/fileOps.js` 與 `scripts/modules/buttonManager.js` 提供下載或複製動作。

## 工具與維護
- `tools/project_quickstart.ps1`：啟動前檢視最近工作與 Git 摘要。
- `scripts/legacy_compatibility.js`：維持舊版頁面相容行為。
- `docs/todo/`：追蹤工作項目，其中 `RECENT_WORK.md` 為最新快照。

> 如增添新模組，請同步更新此映射並視需要調整 quickstart 腳本提示。
