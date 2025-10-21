# dictMaker.js P1 階段瘦身 — 可執行任務清單 (PA: Project Analyzer)

目標與範圍
- 目標：將 scripts/dictMaker.js 從 538 行降至 150–220 行，維持功能完全一致。
- 範圍（P1 高價值、低風險）：
  1) 配置管理（prefs + PrefsManager）→ scripts/modules/prefs.js
  2) UI 更新輔助（UIHelpers：updateOutputCount、updateOutputMeta、formatTimestamp、getSeparator 等）→ scripts/modules/uiHelpers.js
  3) 檔案操作（下載、輸出→輸入 nextStep）→ scripts/modules/fileOps.js
  4) 按鈕管理（ButtonManager 綁定與處理）→ scripts/modules/buttonManager.js
- 原則：最小改動、可回退、向後相容、分階段驗證，保留既有全域 API 名稱以降低影響。

---

任務 1 — 建立模組骨架與全域註冊（不改動邏輯）
- 內容：
  - 新增 4 檔：scripts/modules/prefs.js、uiHelpers.js、fileOps.js、buttonManager.js。
  - 參考現有 modules/* 檔案風格（IIFE + 掛載至 window.Modules.* 或 window.*）做出一致的模組包裝。
  - 規劃輸出 API：
    - prefs.js：{ prefs, PrefsManager }
    - uiHelpers.js：{ UIHelpers }，含 getSeparator, updateOutputCount, updateOutputMeta, formatTimestamp, getCharLengthFilter
    - fileOps.js：{ FileOps }，含 download(text, filename)、nextStep(fromTextareaId, toTextareaId)
    - buttonManager.js：{ ButtonManager }，只負責綁定按鈕與委派至外部 handler
  - 不接線、不抽移邏輯，僅建立可被引用的空殼函式與覆寫點（預留向後相容全域名）。
- 難度：簡單
- 依賴：無
- 風險：低（新增檔案，不影響現行路徑）
- 驗證：
  - 檔案可正確載入於 words_*.html / dictMaker_*.html 不報錯（console 無 ReferenceError）。

任務 2 — 將 prefs 與 PrefsManager 從 dictMaker.js 抽離至 prefs.js
- 內容：
  - 直接搬移 `const prefs = {...}` 與 `const PrefsManager = {...}` 進 prefs.js。
  - 維持 API 與行為一致：localStorage 鍵前綴 `dict_maker.*` 不變。
  - 在 prefs.js IIFE 內保留 `window.prefs` 與 `window.PrefsManager`（向後相容），同時輸出至 window.Modules.prefs。
- 難度：簡單
- 依賴：任務 1
- 風險：低（純移轉）
- 驗證：
  - 頁面初始化後，`PrefsManager.init()` 正常執行，checkbox/select/input 的狀態可持久化。
  - 改動前後行為比對：切換任一選項後重新整理，狀態一致。

任務 3 — 抽離 UIHelpers：getSeparator / updateOutputCount / updateOutputMeta / formatTimestamp
- 內容：
  - 搬移 4 個 UI 輔助函式至 uiHelpers.js，導出為 `UIHelpers`：
    - getSeparator()
    - updateOutputCount(lines|string)
    - updateOutputMeta(title, mode)
    - formatTimestamp()
  - 在 dictMaker.js 中以 `const { getSeparator, updateOutputCount, updateOutputMeta, formatTimestamp } = UIHelpers;` 使用。
  - 於 uiHelpers.js 內保留向後相容全域名稱（同名掛載至 window 以免現有其他腳本使用失效）。
- 難度：簡單
- 依賴：任務 1
- 風險：低
- 驗證：
  - 執行 quick/fcj 流程與去重流程後，`#outputCount` 與 `#outputMeta` 顯示正確。

任務 4 — 抽離 getCharLengthFilter 至 UIHelpers（或 charFilter 模組適配層）
- 內容：
  - 將 getCharLengthFilter() 移至 uiHelpers.js 並整合 CharLengthOptions 的回退邏輯。
  - 保持與原實作一致（有組件時走組件，無 UI 時回退為全部允許）。
  - 向後相容：`window.getCharLengthFilter` 仍可用。
- 難度：中等（需注意可用性偵測）
- 依賴：任務 3
- 風險：低
- 驗證：
  - 勾選不同字數選項，quick/fcj 流程產生的輸出行數與內容符合預期。

任務 5 — 檔案操作抽離：下載與「輸出→輸入」
- 內容：
  - 將 ButtonManager.handleDownload() 與 nextStep() 功能抽離至 fileOps.js：
    - FileOps.download(text, filename?) 使用 UIHelpers.formatTimestamp 生成預設檔名。
    - FileOps.nextStep(fromId = '#outputTextarea', toId = '#inputTextarea')，搬移資料並更新 `#outputMeta`。
  - 在 uiHelpers.js 暴露 formatTimestamp 供 fileOps 使用。
  - 保留向後相容：`window.nextStep` 與 `window.ButtonManager.handleDownload` 舊接口仍能呼叫（透過轉呼叫 FileOps）。
- 難度：中等
- 依賴：任務 3
- 風險：低
- 驗證：
  - 下載檔名格式含 `dict_output_YYYY-MM-DDTHH-mm-ssZ.txt`（冒號改為連字號）。
  - 點擊「輸出→輸入」後輸入框內容更新且 meta 顯示正確。

任務 6 — ButtonManager 模組化
- 內容：
  - 將 ButtonManager 整體搬至 modules/buttonManager.js。
  - 將「下載」改為委派呼叫 `FileOps.download(...)`。
  - 將「輸出→輸入」按鈕 handler 保留為對外注入或直接呼叫 `window.nextStep`（過渡期），最終委派 `FileOps.nextStep()`。
  - 提供初始化 API：`ButtonManager.init({ onProcess: {...}, onUtility: {...} })` 或維持現有內嵌 handler 但從全域函式引用（最小改動）。
  - 對外掛載 `window.ButtonManager` 以保留相容性，並輸出至 `window.Modules.buttonManager`。
- 難度：中等
- 依賴：任務 5
- 風險：中（按鈕初始化順序常見問題）
- 驗證：
  - 點擊所有按鈕（去重、標準化、quick、fcj、下一步、下載）均可觸發原功能。
  - 初始化順序改動不導致 `undefined handler`。

任務 7 — dictMaker.js 初始化段落瘦身與接線
- 內容：
  - 在 $(function(){ ... }) 內，改為：
    - 注入 CharLengthOptions（保留原邏輯）。
    - 呼叫 PrefsManager.init()、ButtonManager.init() 改用模組引用。
  - 移除已抽離的函式本體，只保留 import/存取與流程代碼。
  - 確保 runMake、dedupeWithComments、normalizeDictionary、performDeduplication、needsNormalization 使用新模組 API（UIHelpers/prefs/fileOps/buttonManager）。
- 難度：中等
- 依賴：任務 2、3、4、5、6
- 風險：中（整合階段）
- 驗證：
  - 全流程回歸測試（三類資料：英文、中文、混合；含註解行與空行）。
  - 以行數與 meta 文字比對確認一致。

任務 8 — 保留向後相容性與回退機制
- 內容：
  - 在各模組 IIFE 末尾，將主要 API 以相同名稱掛回 window（例如 window.prefs/window.PrefsManager/window.ButtonManager/window.getSeparator 等），同時導出至 window.Modules.*。
  - 在 dictMaker.js 中保留最小 shim：若 Modules 不存在或 API 缺失，回退到舊全域。
  - 加入輕量 console.info 標記版本與切換點，便於回退追蹤。
- 難度：簡單
- 依賴：任務 2–7
- 風險：低
- 驗證：
  - 禁用新模組檔案載入（暫時移除 script 標籤）時，頁面仍可靠舊全域運作（僅於開發環境測）。

任務 9 — 更新載入順序與 HTML 引用
- 內容：
  - 在 words_*.html / dictMaker_*.html 中新增 modules/prefs.js、uiHelpers.js、fileOps.js、buttonManager.js 的引入。
  - 確保引用順序：uiHelpers → prefs → fileOps → buttonManager → dictMaker.js（避免未定義）。
  - 保留 require 版或直連 script 版皆可使用（用全域掛載）。
- 難度：簡單
- 依賴：任務 1–8（建置完成後再調整）
- 風險：中（載入順序）
- 驗證：
  - 於不同 HTML 範本頁面實測不報錯，功能一致。

任務 10 — 文檔與驗收（分階段驗證與行數目標）
- 內容：
  - 在 docs/ 撰寫簡短整合報告：變更點、API 對齊、回退方式。
  - 在 PR/Commit 中標記階段：
    - Phase 1/4 建立模組骨架
    - Phase 2/4 prefs 移轉
    - Phase 3/4 UIHelpers + fileOps 移轉
    - Phase 4/4 ButtonManager 移轉與接線
  - 驗收：dictMaker.js 行數 ≤ 220 行（目標 180±30）。
- 難度：簡單
- 依賴：任務 1–9
- 風險：低
- 驗證：
  - 統計行數（簡單工具或 IDE counter），並附回歸測試結果截圖/清單。

---

附錄 — 關鍵 API 對照與保留點
- 向後保留之全域函式/物件（避免其他頁面/腳本壞掉）：
  - prefs、PrefsManager
  - ButtonManager（公開 init/bindButtons/handleDownload）
  - getSeparator、updateOutputCount、updateOutputMeta、formatTimestamp、getCharLengthFilter
  - nextStep（委派到 FileOps.nextStep）
- 新增模組名稱空間：window.Modules.{ prefs, uiHelpers, fileOps, buttonManager }

關鍵路徑與順序（Critical Path）
- 任務 2 → 3/4 → 5 → 6 → 7 → 9 → 10
  - 2 為所有 UI 綁定初始化的前置；
  - 3/4（UIHelpers）為 fileOps 與 dictMaker 其他流程的共用基礎；
  - 5（fileOps）是 buttonManager 的依賴；
  - 6（buttonManager）與 7（整合）完成後，才能調整 HTML 引用（9）並最終驗收（10）。

優先等級
- High：任務 2、3、5、6、7、9
- Medium：任務 1、4、8
- Low：任務 10
