# 重構函式檢查清單（scripts/）

目的：盤點並驗證近期從 dictMaker.js、words.js、utils.js 等移動/修改/新增的函式，確保介面相容、邏輯正確、風險可控。

說明：
- 原始位置 vs 新位置：描述函式搬遷與當前歸屬。
- 檢查項目：包含參數、回傳值、例外/邊界條件、效能與相依性。
- 風險：High / Medium / Low。
- 優先順序：P1（最高）/ P2 / P3。

---

## A. rangeFilter.js 模組

### 1) buildRangeFilter(rangeStr)
- 原始位置 vs 新位置：
  - 原：dictMaker.js（舊版整合於字典篩選流程）
  - 新：scripts/rangeFilter.js（以模組化方式暴露：global.RangeFilter.buildRangeFilter 與 global.buildRangeFilter）
- 檢查項目：
  - 參數/型別：`rangeStr` 是否允許空字串、空白、含符號；目前僅支援正整數（不支援負數）
  - 邏輯：
    - 支援格式：">N", ">=N", "<N", "<=N", "A-B"（順序無關）、單一數字
    - A-B 會自動正規化為 [min,max]
  - 回傳值：回傳 predicate 函式 (x:number)=>boolean
  - 例外：空字串 / 無法解析時丟出 Error（訊息已本地化）；需確認 UI 層是否有 try/catch
  - 邊界：極大數值、空白混入、N=0、A==B；非數字（NaN）
- 風險：Medium（輸入格式錯誤時例外易影響流程；是否需支援負數/浮點）
- 優先順序：P2

### 2) streamFilterDict(rangeStr, onProgress)
- 原始位置 vs 新位置：
  - 原：dictMaker.js（內嵌於流程）
  - 新：scripts/rangeFilter.js（以模組化方式暴露：global.RangeFilter.streamFilterDict 與 global.streamFilterDict）
- 檢查項目：
  - 參數：
    - `rangeStr`（轉交給 buildRangeFilter）
    - `onProgress({ percent, processed, matched })` 回呼
  - 相依：
    - 讀取 `data/dict.txt`（HTTP/同源權限、Content-Length 可用性）
    - 讀取 `#encodingSelect` 取得編碼
    - 使用 `getCharLengthFilter()`（目前定義於 dictMaker.js）
      - 確認在使用頁面（dictMaker.*）載入順序正確；跨頁不可重用
  - 邏輯：
    - 環境支援 ReadableStream 則串流分塊處理，否則一次性讀取
    - 以空白分割，要求至少 3 欄（詞、頻、詞性）
    - 頻率 parseInt 後以 range predicate + 字數過濾器判斷
    - 排序：以頻率倒排
  - 回傳值：字串，以 "詞 頻 詞性" 換行組成
  - 例外：讀檔失敗、格式不符、解析失敗
  - 邊界：
    - 檔頭/註解行、空行、殘缺行
    - chunk 邊界殘留（remainder flush）
    - 無 Content-Length 時 `percent` 估算為 0
  - 重要對齊：
    - dictMaker.js 目前 `onProgress` 內部嘗試讀 `p.total` 以顯示提示字串（範例模板使用 `p.total ? ...`）；但 streamFilterDict 並未回報 `total` 欄位 → 介面不一致
- 風險：High（進度回呼介面不一致；跨檔相依 getCharLengthFilter；字數過濾 UI 缺失時可能一律放行）
- 優先順序：P1（先修正 `onProgress` 結構，至少補齊 total 或移除依賴）

---

## B. cangjieProcessor.js 模組

### 3) loadCangjieDict()
- 原始位置 vs 新位置：
  - 原：utils.js（傳統版）、commonCangjie.js（舊共用）、可能也曾由 dictMaker.js 直接呼叫
  - 新：scripts/cangjieProcessor.js（class 成員，另暴露 global.loadCangjieDict 指向實例方法）
- 檢查項目：
  - 載入來源：`data/cangjie5.dict.yaml`
  - 解析結果型別：Map（新） vs 物件（舊 utils.js）
  - 快取策略：this._cjMap（新）、global._cjMap（舊）
  - 回傳一致性：若其他模組期望物件下標存取（map[han]），需適配（Map 需使用 get）
  - 錯誤處理：讀檔失敗時回傳空 Map，並避免重試失敗循環
- 風險：High（多版本重疊、全域命名衝突、結構不一致導致下游壞掉）
- 優先順序：P1（統一對外 API & 型別；避免 utils.js 與此檔互搶 global 名稱）

### 4) pickQuick(codeStr)
- 原始位置 vs 新位置：
  - 原：utils.js（簡化版）、commonCangjie.js（可能有）、dictMaker 流程
  - 新：scripts/cangjieProcessor.js（成員方法，另暴露 global.pickQuick）
- 檢查項目：
  - 規則：取左 1 + 右 1（單碼直接回傳）
  - 入參：允許多碼以空白分隔，取第一組主碼
  - 一致性：與 utils.js 中 pickQuick 行為一致
  - 邊界：空字串、僅空白、非字母碼
- 風險：Medium（雙實作重覆，易產生微差）
- 優先順序：P2（在統一 loadCangjieDict 決策後，一併對齊）

### 5) pickFCJ(codeStr)
- 原始位置 vs 新位置：
  - 原：utils.js（簡化版）、commonCangjie.js
  - 新：scripts/cangjieProcessor.js（成員方法，另暴露 global.pickFCJ）
- 檢查項目：
  - 規則：left(2)+right(1)，不超過原長
  - 邊界：長度 1/2 的處理；空字串
  - 一致性：與 utils.js 版本一致
- 風險：Medium
- 優先順序：P2

### 6) processCode(codeStr, mode)
- 原始位置 vs 新位置：
  - 原：無（新方法）
  - 新：scripts/cangjieProcessor.js
- 檢查項目：
  - 模式 quick / fcj / freecj（別名） fallback：default 回傳原字串
  - 邊界：未知模式、空碼
- 風險：Low
- 優先順序：P3

### 7) processText(text, mode)
- 原始位置 vs 新位置：
  - 原：無（新方法）
  - 新：scripts/cangjieProcessor.js
- 檢查項目：
  - 依字元查碼；找不到碼回傳 { code:null }
  - 回傳陣列結構對齊前端預期（是否有被其他處使用）
- 風險：Low
- 優先順序：P3

### 8) clearCache()
- 原始位置 vs 新位置：
  - 原：無（新方法）
  - 新：scripts/cangjieProcessor.js
- 檢查項目：
  - 僅清除本類別快取，不影響 utils.js 的 global._cjMap（若仍存在）
- 風險：Medium（雙快取源存在時，可能造成快取不一致）
- 優先順序：P2

---

## C. words.js 改動

### 9) prepare(returnType = '', regex = '')
- 原始位置 vs 新位置：
  - 原：words.js（舊版無字數篩選）
  - 新：words.js（新增字數篩選、dedup 與 +num/+count）
- 檢查項目：
  - 語言過濾：langFiltering() 分支（all/cjk/zh/en/預設中英）
  - dedup 行為：
    - 普通去重：Set
    - 帶尾數字：dedupWithTailNumber（尾數相加）
  - 字數過濾：
    - 使用 getUnifiedCharLengthFilter（優先走 CharLengthOptions.getFilter）
    - 中文長度以 [\u4e00-\u9fff] 計算；非中文保留以字元長度計算
    - 旗標觸發條件：`returnType.includes('charFilter') || returnType === 'dedup' || returnType === '[]'`
  - 回傳型別：
    - 包含 [] 則回傳陣列，否則以 \n 連接字串
  - 邊界：
    - 空輸入、全非目標語系、英文/符號混合
    - `keep_tail_num` 與 `dedup` 的早退條件（+num 不去重時直接回傳）
- 風險：Medium（字數計算規則與 UI 選項一致性、早退邏輯與呼叫方預期）
- 優先順序：P2

### 10) dedupWithTailNumber(arr)
- 原始位置 vs 新位置：
  - 原：無（新函式）
  - 新：words.js
- 檢查項目：
  - 尾數字解析 regex：`/^(.+?)\s+(\d+)$/`，是否允許 tab / 多空白，是否排除多段數字
  - 相同內容合併累加
  - 輸出格式：>1 才帶尾數字
- 風險：Low
- 優先順序：P3

### 11) getUnifiedCharLengthFilter()
- 原始位置 vs 新位置：
  - 原：無（新函式）
  - 新：words.js
- 檢查項目：
  - 優先讀 CharLengthOptions.getFilter（組件）
  - 回退讀取 words 專用 checkbox（freeCjSingleCharCheckbox ~ freeCj5pluscharCheckbox）
  - 與 dictMaker 的 getCharLengthFilter 命名/語義不同步 → 僅適用 words 頁面
- 風險：Medium（不同頁面使用不同實作，易誤用）
- 優先順序：P2

### 12) doFreeCj(textOrProcess, mode = 'fcj', opts = {}) [包裝函式]
- 原始位置 vs 新位置：
  - 原：無（新 wrapper）
  - 新：words.js（頁面內部）
- 檢查項目：
  - 自動補齊 opts.charLengthFilter → getUnifiedCharLengthFilter()
  - 轉呼叫 FcjUtils.cjMakeFromText
  - 回傳 Promise<string>
- 風險：Medium（FcjUtils 來源多處實作，需確認一致）
- 優先順序：P2

---

## D. dictMaker.js 改動

### 13) runMake(mode)
- 原始位置 vs 新位置：
  - 原：dictMaker.js（但含較多內聚邏輯）
  - 新：dictMaker.js（改為委派 FcjUtils.cjMakeFromText，並引入 getCharLengthFilter）
- 檢查項目：
  - 參數：mode = 'quick' | 'fcj'
  - 選項：append3AtEnd（freq1000_code3_to_code2）、charLengthFilter、showCount、separator
  - UI 綁定：`#fcjOpt_*`、`#countOpt`、`#separatorOpt` 是否與 CharLengthOptions 注入 ID 一致
  - 回傳：異步 then → outputTextarea；計數與 meta 更新
- 風險：Medium（依賴 FcjUtils 與 getCharLengthFilter 的正確性）
- 優先順序：P2

### 14) getCharLengthFilter() [dictMaker 專用]
- 原始位置 vs 新位置：
  - 原：未模組化（頁面內散落）
  - 新：dictMaker.js（本檔定義給本頁使用）
- 檢查項目：
  - 優先 CharLengthOptions.getFilter
  - 回退：讀 `#fcjOpt_*` 之 checkbox
  - 僅供 dictMaker 頁使用，不應被 rangeFilter.js 等模組硬耦合（目前 streamFilterDict 直接呼叫 → 強耦合）
- 風險：Medium（跨檔耦合）
- 優先順序：P2

### 15) dedupeWithComments / normalizeDictionary 相關
- 原始位置 vs 新位置：
  - 原：dictMaker.js（舊版較長流程）
  - 新：dictMaker.js（v2/v1 兩版保留；新增 needsNormalization、performDeduplication 提取子流程）
- 檢查項目：
  - 自動偵測與標準化規則正確性
  - 效能：大檔案行數記憶體占用
  - 格式解析：root / word / count 判斷
- 風險：Medium
- 優先順序：P3

---

## E. utils.js（疑似被不當修改處）與多版本衝突風險

### 16) 智能模式切換（ModuleSystem 檢測與相容層）
- 原始位置 vs 新位置：
  - 原：無（新邏輯）
  - 新：scripts/utils.js 冒頭（偵測 ModuleSystem → 載入輕量相容層，重新綁定 setOutput/setInput 等）
- 檢查項目：
  - 輕量相容層僅提供 FcjUtils.updateOptionStatus（其餘交由現代模組）；需檢查所有頁面是否仍有呼叫 FcjUtils.cjMakeFromText 等（若有將失效）
  - 若無 ModuleSystem，則載入傳統完整 utils（包含 cjMakeFromText、loadCangjieDict、pickQuick/pickFCJ 等）
  - 雙模實作是否可能與 cangjieProcessor.js/global.* 名稱衝突（loadCangjieDict/pickQuick/pickFCJ）
- 風險：High（初始化順序與全域覆寫風險）
- 優先順序：P1

### 17) 簡化版 cjMakeFromText(text, mode, opts)
- 原始位置 vs 新位置：
  - 原：utils.js 舊版/其他共用檔
  - 新：utils.js（傳統模式分支內）
- 檢查項目：
  - 依賴 utils.js 內部 loadCangjieDict（回傳物件 map，與 cangjieProcessor 的 Map 不同）
  - 行為覆蓋：
    - quick：字字輸出
    - fcj：單字用 pickFCJ，多字組合 pickQuick
  - 選項：append3AtEnd 尚未實作？（未見使用）
  - 邏輯：過濾非中文行，charLengthFilter 以 phrase 字數為準
- 風險：Medium（與現代模組版可能不一致；跨檔呼叫者期待相同行為）
- 優先順序：P2

### 18) loadCangjieDict / pickQuick / pickFCJ（傳統版）
- 原始位置 vs 新位置：
  - 原：utils.js 舊版
  - 新：utils.js（傳統模式）
- 檢查項目：
  - global 名稱衝突：cangjieProcessor.js 亦暴露 global 同名函式
  - 回傳型別差異（Map vs 物件）是否會混用
- 風險：High（命名衝突 + 型別不一致）
- 優先順序：P1

---

## F. 其他相關整合點（可能受影響）

### 19) CharLengthOptions 組件
- 原始位置 vs 新位置：
  - 原：各頁各自 checkbox
  - 新：html-lib/components/CharLengthOptions/CharLengthOptions.js（集中化）
- 檢查項目：
  - 提供 getFilter() 的語義是否與 words/dictMaker 兩頁一致
  - 注入 ID 與各頁讀取的 ID 一致性（words: freeCj*；dictMaker: fcjOpt_*）
- 風險：Medium
- 優先順序：P2

### 20) cangjieIntegration.js / charFilterIntegration.js / refactoredCommon.js
- 原始位置 vs 新位置：
  - 原：commonCangjie.js 等
  - 新：scripts/*Integration.js、scripts/refactoredCommon.js
- 檢查項目：
  - 是否重新暴露 FcjUtils 或包裝對應 API；避免與 utils.js 雙重實作
  - 初始化順序：避免早期使用全域函式導致未定義
- 風險：Medium
- 優先順序：P2

---

## 建議修正與執行順序（關鍵路徑）

1) P1 修正（高風險/阻塞）
- [ ] 統一 `loadCangjieDict/pickQuick/pickFCJ` 的全域出口，決定唯一來源：
  - 方案A：保留 cangjieProcessor.js 為唯一來源；utils.js 傳統分支改名或轉呼叫 cangjieProcessor 實例
  - 方案B：保留 utils.js 為唯一來源；cangjieProcessor 改為不往 global 掛同名函式，僅以類別供模組化使用
- [ ] 修正 `streamFilterDict` 的 `onProgress` 結構，補充 `total` 欄位，或調整 dictMaker.js 進度顯示不依賴 total。
- [ ] 確認在「啟用 ModuleSystem」情境下，words.js / dictMaker.js 仍能取得 `FcjUtils.cjMakeFromText` 或對應替代（避免相容層僅提供 updateOptionStatus 造成功能缺失）。

2) P2 檢查（中風險/一致性）
- [ ] 對齊 pickQuick/pickFCJ 規格（各處實作行為一致、單碼/雙碼邊界測試）。
- [ ] 驗證字數過濾：words 與 dictMaker 上的 CharLengthOptions ID 與回退 checkbox ID 完全一致。
- [ ] prepare 的早退與字數過濾開關是否符合所有呼叫場景（RimeBtn、simple、freeCj）。
- [ ] cjMakeFromText 的行為與文件說明一致（quick/FCJ 模式輸出是否雙重去重、是否保留順序）。

3) P3 優化（低風險/體驗）
- [ ] buildRangeFilter 支援負數/空白多樣性、錯誤提示更具體。
- [ ] dedupWithTailNumber 支援 tab、連續空白、複數空格；提供嚴格/寬鬆模式切換。
- [ ] streamFilterDict 若無 Content-Length，可估算進度（樣本行數）或改為 indeterminate spinner。

---

## 測試案例清單（簡述）

- buildRangeFilter："10-30"、"30-10"、">=20"、"<=0"、"15"、"abc"（應拋錯）
- streamFilterDict：
  - 無串流支援（fallback）/有串流支援（chunk 邊界換行）
  - onProgress 結構完整度（包含 total）
  - 字數過濾：1/2/3/4/5+ 勾選組合
- loadCangjieDict：重入、失敗 fallback、Map vs 物件相容
- pickQuick/pickFCJ：長度 1/2/3/4/5 的碼、含第二組碼（以空白分隔）
- prepare：`[]`/`dedup`/`+num` 組合，純英文、純中文、混合；字數過濾勾選
- doFreeCj：未傳 charLengthFilter 時自動補齊；搭配 jieba 斷詞與否
- dictMaker.runMake：各選項開關、分隔符（含 \t）、計數顯示
- utils 智能模式：有/無 ModuleSystem 兩種路徑功能是否等價

---

作者：Rovo Dev（Task Decomposition & QA Checklist）
