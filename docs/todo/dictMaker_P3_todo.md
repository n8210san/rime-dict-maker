# dictMaker.js P3 階段 — 可執行任務清單（依 PA - Project Analyzer）

目標與範圍
- 目標：完成 Core 級別函數實作與整合，將 UI wrapper 轉向使用 Core API，清理 v2 檔案至 docs/legacy/，並完成回歸驗證。
- 範圍（P3 高價值）：
  1) 實作 normalizeDictionaryCore（DI cjProvider + 併發控制 + 記憶化）
  2) 實作 dedupeWithCommentsCore（整合 needsNormalizationCore/normalizeDictionaryCore/performDeduplicationCore）
  3) 調整 dictMaker.js wrapper 接 Core API（保持向後相容）
  4) v2 檔案移轉（HTML/模組）到 docs/legacy/，維持參考紀錄
  5) 回歸測試與效能驗證（分隔符一致性、相容性）

---

關鍵注意事項（技術/相容性）
- 併發控制與記憶化：
  - cjProvider(word) 高頻呼叫，需以 Promise 級記憶化（Map: word → Promise<string>）避免重複請求。
  - 限制同時進行的請求數（建議預設 8，並允許 opts.concurrency 覆寫）。
  - 失敗重試策略（可選，預設不重試，保留擴展點）。
- 分隔符一致性保證：
  - Core 僅接受 opts.separator（字串，常用 "\t" 或空白），所有輸出與內部 join/format 一律使用該 separator。
  - Wrapper（UI 層）透過 UIHelpers.getSeparator() 取得並傳給 Core，杜絕混用。
- 向後相容性確保：
  - 保留 window.normalizeDictionaryCore / window.dedupeWithCommentsCore（dictCore.js 已掛載）。
  - dictMaker.js wrapper 對外函數名稱不變（normalizeDictionary / dedupeWithComments），內部委派 Core。
  - 暫留舊流程函數但標記 deprecated（console.info），並以 Core 路徑優先。
- v2 檔案安全移除策略：
  - 僅搬移到 docs/legacy/ 保留歷史紀錄；不刪除內容。
  - 更新 README 或 docs/legacy/README.md 說明存檔與回退方式。
  - 確認任何 HTML 不再引用 v2 腳本後再執行搬移。

---

關鍵路徑（Critical Path）
- P3-1 → P3-2 → P3-3 → P3-6 → P3-7 → P3-9
  - 先完成 Core 兩大函數（P3-1、P3-2），再接 dictMaker.js（P3-3），
  - 完成回歸與效能驗證（P3-6、P3-7），最後執行 v2 清理（P3-9）。

優先等級
- High：P3-1、P3-2、P3-3、P3-6、P3-7、P3-9
- Medium：P3-4、P3-5、P3-8
- Low：P3-10、P3-11

---

P3-1 — 實作 normalizeDictionaryCore（DI + 併發 + 記憶化）
- 描述（具體步驟）：
  1) 在 scripts/modules/dictCore.js 完成 normalizeDictionaryCore 內部邏輯。
  2) 參數驗證：lines（string[]）、opts.separator（string）、opts.cjProvider（function）、可選 opts.concurrency（number，預設 8）。
  3) 行過濾：保留原始空行與以 # 開頭的註解行原樣輸出。
  4) 判斷格式：
     - 格式 A：word separator count → 需產生 root，再輸出 word separator root separator count。
     - 格式 B：word separator root [separator count?] 或 root separator word [separator count?] → 正規化為 word separator root separator count（count 預設 1）。
  5) cjProvider 整合：
     - 若需產生根碼（中文或未知 root），使用 memoized cjProvider(word)。
     - Promise 記憶化 + 併發限制（簡單併發池：佇列 + 運行計數）。
  6) 分隔符一致：輸出均以 opts.separator 組裝。
  7) 錯誤處理：個別字詞 cjProvider 失敗時回退 root = word；不中斷整體流程。
- 複雜度：複雜
- 預估工作量：大
- 風險等級：中
- 依賴關係：無
- 驗證標準：
  - 單元測試樣例：
    - ['字\t2'] 透過 cjProvider 轉為 ['字\tcj\t2']。
    - ['root\t詞\t3'] → ['詞\troot\t3']；['詞\troot'] → ['詞\troot\t1']。
    - 保留註解與空行；未知格式行原樣保留。
  - 併發測試：模擬 1000 筆中文詞，驗證 cjProvider 呼叫數去重（< 唯一詞數），且運行峰值 <= concurrency。
- Subagent 分工：Coder（核心函數與併發池實作）

P3-2 — 實作 dedupeWithCommentsCore（完整流程封裝）
- 描述（具體步驟）：
  1) 在 scripts/modules/dictCore.js 完成 dedupeWithCommentsCore：
     - 驗證參數：lines、opts.separator、opts.cjProvider、opts.concurrency（可選）。
     - 流程：
       a. 若 needsNormalizationCore(lines) → 呼叫 normalizeDictionaryCore(lines, opts)；否則使用原 lines。
       b. 呼叫 performDeduplicationCore(normalizedLines, { separator }).
     - 保留註解/空白行位置與輸出一致。
  2) 錯誤處理：任何階段錯誤不中斷全部流程（盡量回退並保留可處理的行）。
- 複雜度：中等
- 預估工作量：中
- 風險等級：中
- 依賴關係：P3-1
- 驗證標準：
  - 測試輸入混合：['字', '字', '# c', '詞\troot', ''] → 正規化後再去重，總計數累加正確。
  - 不需正規化的輸入直接去重，結果與 performDeduplicationCore 一致。
- Subagent 分工：Coder

P3-3 — 調整 dictMaker.js wrapper 使用 Core API
- 描述（具體步驟）：
  1) 在 scripts/dictMaker.js 中，將 normalizeDictionary() 改為委派 normalizeDictionaryCore()。
  2) 將 dedupeWithComments() 改為委派 dedupeWithCommentsCore()，僅保留 UI 更新邏輯（#outputTextarea、updateOutputCount、updateOutputMeta）。
  3) 建立 cjProvider 適配層（UI 層）：
     - 從 FcjUtils.cjMakeFromText 或既有快速倉頡提供器抽取每個詞的碼（設計為 async function word→code）。
     - 以 memo + 併發限制 wrapper 傳入 Core（或直接由 Core 實作，二擇一，首選 Core 層統一）。
  4) 分隔符一致：使用 UIHelpers.getSeparator() → 傳給 Core。
  5) 保留向後相容：
     - wrapper 函式名稱與行為不變，若 Core 不存在時回退舊路徑（透過存在檢查）。
- 複雜度：中等
- 預估工作量：中
- 風險等級：中
- 依賴關係：P3-1、P3-2
- 驗證標準：
  - 現有 UI 流程（quick/fcj/補完整/含註解去重）皆能正常出結果，meta 與行數顯示一致。
  - 臨時禁用 dictCore.js 時，舊 wrapper 仍能工作（回退機制）。
- Subagent 分工：Coder（接線）+ Integrator（UI 驗證）

P3-4 — Core API 文檔與型別註記補全
- 描述（具體步驟）：
  1) 在 dictCore.js 為 normalizeDictionaryCore/dedupeWithCommentsCore 增補 JSDoc，包括 opts.concurrency、錯誤回退策略。
  2) 在 docs/dev_log/ 或 docs/ 補充 API 參考（更新 dictCore_API_REFERENCE.md 或新增）。
- 複雜度：簡單
- 預估工作量：小
- 風險等級：低
- 依賴關係：P3-1、P3-2
- 驗證標準：
  - 內嵌 JSDoc 與文檔對齊，參數/回傳/例外情境清楚。
- Subagent 分工：Writer

P3-5 — cjProvider 效能驗證（記憶化與併發）
- 描述（具體步驟）：
  1) 建立臨時基準腳本（僅開發使用，不入版本或以 tmp_ 前綴）壓測 1K/5K 詞，記錄：
     - cjProvider 實際呼叫次數（去重效果）。
     - 峰值併發（應 <= concurrency）。
     - 總處理時間，相對未記憶化版本的加速比（目標 >= 1.5x）。
  2) 如需，調整預設 concurrency 與快取生命週期（本階段可不限生命週期，頁面存活期內有效）。
- 複雜度：中等
- 預估工作量：中
- 風險等級：中
- 依賴關係：P3-1
- 驗證標準：
  - 壓測報告（簡表）與 console 觀測數據達標。
- Subagent 分工：Coder（基準測）

P3-6 — 分隔符一致性與格式回歸測試
- 描述（具體步驟）：
  1) 建立一組測資（英文、中文、混合；含註解/空行/無效行），對四情境測試：
     - 僅 normalizeDictionaryCore
     - 僅 performDeduplicationCore
     - dedupeWithCommentsCore（需/不需正規化兩類）
     - UI wrapper 調用 Core（dictMaker.js）
  2) 驗證所有輸出均使用相同 separator（以 UI 取值），且行數、count 累加正確。
- 複雜度：中等
- 預估工作量：中
- 風險等級：中
- 依賴關係：P3-1、P3-2、P3-3
- 驗證標準：
  - 測試清單與比對輸出快照（文字檔或記錄於 docs/）。
- Subagent 分工：Tester

P3-7 — 向後相容性驗證
- 描述（具體步驟）：
  1) 臨時移除 dictCore.js 載入，確認舊 wrapper 路徑仍可運作（開發測）。
  2) 回復 dictCore.js 載入，確認新路徑工作無誤。
  3) 檢查 window.* 全域 API 是否仍存在（needsNormalizationCore/performDeduplicationCore/normalizeDictionaryCore/dedupeWithCommentsCore）。
- 複雜度：簡單
- 預估工作量：小
- 風險等級：低
- 依賴關係：P3-3
- 驗證標準：
  - 兩種載入情境皆可正確運作（以手動/腳本記錄）。
- Subagent 分工：Tester

P3-8 — dictMaker.js 代碼清理與註記
- 描述（具體步驟）：
  1) 清理已不再使用的舊內部實作（如 normalizeDictionary/performDeduplication 舊核心段），保留薄 wrapper 與 UI 邏輯。
  2) 在涉及回退的分支加入 console.info 註記（便於追蹤實際走哪條路徑）。
  3) 確認 import/全域依賴順序與 Modules 掛載一致。
- 複雜度：簡單
- 預估工作量：小
- 風險等級：低
- 依賴關係：P3-3
- 驗證標準：
  - 檔案行數下降，且 ESLint/基本檢查通過；UI 功能不變。
- Subagent 分工：Coder

P3-9 — v2 檔案清理（搬移至 docs/legacy/）
- 描述（具體步驟）：
  1) 盤點 v2 檔案（例：dictMaker_v2.html、dictMaker_v2_elegant.html、words_v2.html、words_v2_elegant.html，以及任何 v2 標記之模組）。
  2) 確認無現行 HTML 仍引用這些 v2 檔案。
  3) 在 docs/legacy/ 建立對應結構並搬移（保留相對路徑說明）。
  4) 新增 docs/legacy/README.md（或更新 MODERNIZATION_COMPLETE.md）描述搬移清單與回退方法。
- 複雜度：簡單
- 預估工作量：小
- 風險等級：中（引用遺留）
- 依賴關係：P3-6、P3-7（完成驗證後再清理）
- 驗證標準：
  - 專案根目錄不再出現 v2 HTML/模組；docs/legacy/ 中有完整備份與說明。
- Subagent 分工：Repo Maintainer

P3-10 — 文件更新與整合報告
- 描述（具體步驟）：
  1) 更新 docs/INTEGRATION_REPORT.md 或新增 P3 小節：變更點、API 對齊、回退方式、效能數據。
  2) 在 README.md 或 docs/ 中補充使用說明（如何在 UI 層選擇分隔符，如何擴展 cjProvider）。
- 複雜度：簡單
- 預估工作量：小
- 風險等級：低
- 依賴關係：P3-1～P3-7
- 驗證標準：
  - 文檔可完整引導使用 Core API 與回退機制。
- Subagent 分工：Writer

P3-11 — 最終回歸與發佈檢查
- 描述（具體步驟）：
  1) 針對三類資料（英文、中文、混合；含註解行/空行）進行全流程回歸（quick/fcj/補完整/帶註解去重）。
  2) 比對 P1/P2 前後的輸出行數與 meta 文案一致性（允許排序與累計差異僅在規則內）。
  3) 最小化 console 噪音（保留關鍵 info，同步調整等級與訊息）。
- 複雜度：中等
- 預估工作量：中
- 風險等級：中
- 依賴關係：P3-1～P3-10
- 驗證標準：
  - 提交一份回歸結果清單到 docs/（包含測資、輸出、差異說明）。
- Subagent 分工：Release Manager

---

附錄 — 任務到人與里程碑建議
- 里程碑 M1（Core 實作完成）：P3-1、P3-2
- 里程碑 M2（UI 接線 + 測試）：P3-3、P3-6、P3-7、P3-8
- 里程碑 M3（清理 + 文檔 + 發佈）：P3-9、P3-10、P3-11
