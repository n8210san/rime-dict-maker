# dictMaker.js P2 階段 — 可執行任務清單（依 PA - Project Analyzer）

目標與範圍
- 目標：將 dictMaker.js 中與「格式檢測/標準化/去重」相關的業務邏輯模組化為「純函式 Core + DOM Wrapper」，在不改變功能與 UI 行為的前提下，完成 P2 階段的分步重構與驗證。
- 範圍（P2 階段依風險分步）：
  1) 第一步（低風險）：needsNormalization + performDeduplicationCore（抽成純函式）
  2) 第二步（中風險）：normalizeDictionaryCore（抽成純函式，需 DI cjProvider）
  3) 第三步（整合）：dedupeWithCommentsCore + Wrappers（封裝流程、保留向後相容）
  4) 第四步（驗證）：回歸測試、載入順序驗證
- 原則：純函式 + DOM wrapper 模式、依賴注入（separator、cjProvider）、向後相容性保障、載入順序協調、最小改動原則。

---

關鍵設計與命名規劃
- 新增模組：scripts/modules/dictCore.js
  - 導出（掛載）至 window.Modules.dictCore 與相容的全域 shim（必要時）。
  - 純函式（不觸碰 DOM）：
    - needsNormalizationCore(lines: string[]): boolean
    - performDeduplicationCore(lines: string[], opts: { separator: string }): string[]
    - normalizeDictionaryCore(lines: string[], opts: { separator: string, cjProvider: (word: string) => Promise<string> }): Promise<string[]>
    - dedupeWithCommentsCore(lines: string[], opts: { separator: string, cjProvider: ... }): Promise<string[]>
  - Wrapper（dictMaker.js / ButtonManager 使用）：
    - needsNormalization(lines) → 代理 needsNormalizationCore
    - performDeduplication(lines) → 呼叫 performDeduplicationCore 並完成 DOM 更新
    - normalizeDictionary() → 呼叫 normalizeDictionaryCore 並完成 DOM 更新
    - dedupeWithComments() → 流程化：判斷 → normalize → de-dup → DOM 更新
- 依賴注入：
  - separator：由 UIHelpers.getSeparator() 提供（wrapper 注入，core 僅收值）。
  - cjProvider：
    - 預設：使用 FcjUtils.cjMakeFromText + parse 取得根碼（以最小改動封裝提供）。
    - 可替換：透過 opts.cjProvider 注入（便於測試）。
- 向後相容：
  - 保留原來 window.needsNormalization / performDeduplication / normalizeDictionary / dedupeWithComments 名稱與行為。
  - ButtonManager 綁定不變：仍呼叫上述名稱；Wrapper 內部轉呼叫 Core。
- 載入順序協調（新增與更新）：
  - 建議順序：uiHelpers → prefs → dictCore → fileOps → buttonManager → dictMaker.js
  - 原頁面仍無需 import；以全域掛載保持可運作。

---

關鍵路徑（Critical Path）
- P2-1 → P2-2 → P2-3 → P2-4 → P2-5 → P2-6 → P2-7 → P2-8 → P2-9

優先等級
- High：P2-1、P2-2、P2-3、P2-5、P2-6、P2-8
- Medium：P2-4、P2-7、P2-9
- Low：P2-10（文檔）

---

P2-1 — 建立 dictCore 模組骨架與介面（低風險起步）
- 任務內容：
  - 新增 scripts/modules/dictCore.js（IIFE + window.Modules.dictCore 掛載）。
  - 在檔內定義空的純函式骨架與 JSDoc 註解：needsNormalizationCore、performDeduplicationCore、normalizeDictionaryCore、dedupeWithCommentsCore。
  - 暫不接線 DOM，僅回傳固定值或 TODO；先確保載入不壞現有頁面。
- 預估複雜度：簡單
- 風險等級：低
- 前置條件：P1 已完成 uiHelpers/prefs/buttonManager/fileOps 的載入與向後相容。
- 驗證方式：
  - 在 dictMaker_*.html 載入新模組（放在 dictMaker.js 之前），Console 無 ReferenceError。
- 回退策略：
  - 移除 script 標籤或在 dictMaker.js 中不使用 Modules.dictCore（保留舊函式）。

P2-2 — 實作 needsNormalizationCore（純函式）
- 任務內容：
  - 從 dictMaker.js 搬移既有 needsNormalization 的邏輯，調整為 pure function：輸入 lines 陣列、回傳 boolean。
  - 加入單元測試用的導出（保持於 Modules.dictCore）。
- 預估複雜度：簡單
- 風險等級：低
- 前置條件：P2-1
- 驗證方式：
  - 本地以 3 組資料（英文、中文、混合；包含註解與空行）手動驗證函式回傳值與目前線上行為一致。
- 回退策略：
  - Wrapper 仍可調回原 window.needsNormalization。

P2-3 — 實作 performDeduplicationCore（純函式）
- 任務內容：
  - 從 performDeduplication 中抽出核心邏輯為 pure function：輸入 lines 與 opts.separator，輸出去重後的 string[]。
  - 去除 DOM 操作，保留演算法原始行為（順序、合併計數、保留註解與空行）。
  - 注意分隔符由外部注入；預設由 UIHelpers.getSeparator() 於 wrapper 傳入。
- 預估複雜度：中等
- 風險等級：低
- 前置條件：P2-2
- 驗證方式：
  - 手動比對輸入與輸出的每行內容；與舊 performDeduplication 的結果一致（可在 Console 試跑）。
- 回退策略：
  - wrapper 層切換回舊 performDeduplication。

P2-4 — 封裝 performDeduplication 的 DOM Wrapper（向後相容）
- 任務內容：
  - 在 dictMaker.js（或新 wrapper 檔）中建立新 wrapper：performDeduplication(lines)。
  - 內部調用 Modules.dictCore.performDeduplicationCore(lines, { separator: getSeparator() })，
    並完成 DOM 更新（#outputTextarea、updateOutputCount、updateOutputMeta）。
  - 保留原 window.performDeduplication 名稱（覆蓋為 wrapper）。
- 預估複雜度：簡單
- 風險等級：中（DOM 影響）
- 前置條件：P2-3
- 驗證方式：
  - 點擊「去重」按鈕由 ButtonManager 觸發後，結果與改動前一致。
- 回退策略：
  - 暫時保留舊實作副本於註解/隔離函式，或快速 revert commit。

P2-5 — 實作 normalizeDictionaryCore（純函式 + DI cjProvider）
- 任務內容：
  - 將 normalizeDictionary 的主流程抽為純函式，不觸 DOM。
  - DI：opts.cjProvider(word) → Promise<string>，回傳字根（若無則回傳原詞）。
    - 預設提供者：封裝 FcjUtils.cjMakeFromText(word, 'fcj', {...}) 並 parse 第一行的第二欄。
  - 行為一致：
    - 保留空行與註解原樣；
    - 支援三種格式（詞組/字根/計數變化），回退邏輯不變；
    - 正確處理 separator 注入。
- 預估複雜度：複雜
- 風險等級：中
- 前置條件：P2-2、P2-3
- 驗證方式：
  - 以多組中英資料與邊界案例（缺欄位、非數字 count）比對核心輸出與舊版 normalizeDictionary 的輸出完全一致。
- 回退策略：
  - wrapper 保留切換旗標：若 Modules.dictCore.normalizeDictionaryCore 不可用則回退舊函式。

P2-6 — 封裝 normalizeDictionary 的 DOM Wrapper（向後相容）
- 任務內容：
  - 建立 normalizeDictionary() wrapper：
    - 讀取 #inputTextarea，split 行 → 呼叫 normalizeDictionaryCore(lines, { separator, cjProvider })。
    - 將結果 set 至 #outputTextarea，並呼叫 updateOutputCount、updateOutputMeta。
  - 保留原 window.normalizeDictionary 名稱與按鈕綁定（ButtonManager 不需改動）。
- 預估複雜度：中等
- 風險等級：中
- 前置條件：P2-5
- 驗證方式：
  - 使用原有頁面操作「標準化」功能，結果一致；含中文快倉碼生成與回退邏輯。
- 回退策略：
  - wrapper 層以 try/catch fallback 至舊版 normalizeDictionary。

P2-7 — 實作 dedupeWithCommentsCore（串接 needsNormalizationCore + normalizeDictionaryCore + performDeduplicationCore）
- 任務內容：
  - 純函式：接收 lines 與 opts（separator、cjProvider）。
  - 流程：
    1) needsNormalizationCore → true 時先 normalizeDictionaryCore
    2) 將結果傳入 performDeduplicationCore
    3) 回傳最終 string[]
  - 不觸碰 DOM。
- 預估複雜度：中等
- 風險等級：中
- 前置條件：P2-2、P2-3、P2-5
- 驗證方式：
  - 手動給定多組輸入，核心輸出與舊 dedupeWithComments 的 DOM 結果一致（忽略純顯示文案）。
- 回退策略：
  - wrapper 可切回舊 dedupeWithComments。

P2-8 — 封裝 dedupeWithComments 的 DOM Wrapper（整合階段）
- 任務內容：
  - 建立 dedupeWithComments() wrapper：
    - 讀取 #inputTextarea → split → 呼叫 dedupeWithCommentsCore(lines, { separator, cjProvider })。
    - 更新 #outputTextarea 與 UI meta（與現有提示文案保持一致：如「檢測到格式異常，正在自動標準化...」、「格式標準化完成，正在去重...」、「本次使用：智能註解去重功能（含自動格式標準化）」）。
  - 按鈕綁定維持由 ButtonManager → window.dedupeWithComments。
- 預估複雜度：中等
- 風險等級：中
- 前置條件：P2-7
- 驗證方式：
  - 實際點擊「去重」驗證；對比輸出內容與文案更新節點，與改動前一致。
- 回退策略：
  - wrapper 內可設 flag 使用舊版流程。

P2-9 — 載入順序更新與驗證（協調 P2 變更）
- 任務內容：
  - 在 dictMaker_*.html / words_*.html 內加入 scripts/modules/dictCore.js。
  - 調整順序：uiHelpers → prefs → dictCore → fileOps → buttonManager → dictMaker.js。
  - 確認 ButtonManager 的按鈕綁定仍指向 window.* 函式（無需改動）。
- 預估複雜度：中等
- 風險等級：中（載入順序）
- 前置條件：P2-1~P2-8 完成並自測通過。
- 驗證方式：
  - 以不同 HTML 範本（v1/v2/elegant）實測，Console 無錯誤、功能一致。
- 回退策略：
  - 臨時移除 dictCore script；恢復原順序。

P2-10 — 回歸測試與文檔（驗收）
- 任務內容：
  - 回歸測試：
    - 測試樣本：英文、中文、混合；含註解行、空行、異常格式行；不同 separator；不同字數過濾。
    - 覆蓋場景：needsNormalization → normalize → dedupe 流程；單獨 normalize；單獨 dedupe。
    - 對比方式：改動前後輸出內容逐行比對，行數、計數、順序一致；UI meta 文字一致。
  - 文檔：
    - 在 docs/ 新增 P2 完成報告：PA_P2_EXECUTION_REPORT.md，說明改動點、DI 設計、相容性策略與載入順序變更。
- 預估複雜度：中等
- 風險等級：低
- 前置條件：P2-1~P2-9
- 驗證方式：
  - 產出測試結果清單或截圖；審閱輸出一致性。
- 回退策略：
  - 頁面移除 dictCore（回退到 P1 結構），保留 wrapper 內部 fallback。

---

實作細節與注意事項
- 純函式約束：不得觸碰 DOM，不讀寫全域 UI 狀態；輸入輸出明確。
- DI 設計：
  - separator 由 wrapper 注入；允許 tab 與自定義符號（與 UIHelpers.getSeparator 相容）。
  - cjProvider 允許在測試中替換為同步 stub（例如固定回傳 word.toLowerCase() 或 word 本身）。
- 錯誤處理與回退：
  - normalize 中的 cjProvider 失敗時，回退為原詞；記錄 console.warn，不阻斷流程。
  - wrapper 在例外時維持舊行為（alert/提示文字與目前一致）。
- ButtonManager 相容性：
  - 不變更現有 selector 與事件；僅確保 window.* 名稱保持可呼叫。
- 最小改動原則：
  - 不調整既有函式參數與回傳型別（對外觀點）；內部再呼叫 core。
  - 儘量沿用現有程式碼片段，降低 diff 範圍。
