# RfQc 技術債修復：統一偏好設定管理機制（雙來源配置）

目標分析
- 最終目標：消除 dictMaker 偏好設定的雙來源（prefs.js vs configIntegration.js/UnifiedConfig）導致的不一致與維護負擔，形成單一真實來源（SSOT），完整涵蓋現有與新選項（rootOrderOpt、formatOpt、separatorOpt、countOpt、rangeInput、fcj*）。
- 交付成果：
  1) 完整方案評估（A/B）與決策；
  2) 可回滾的代碼變更（含遷移與兼容層）；
  3) 驗證清單與回歸測試腳本/步驟；
  4) 文檔更新。

背景與現況
- 當前同時載入：
  - scripts/configIntegration.js（定義 UnifiedConfigManager 與 global.prefs 適配到 unifiedConfig.dictMaker.*）
  - scripts/modules/prefs.js（再次定義 global.prefs → 使用 localStorage: dict_maker.*）
- 在 dictMaker.html 載入順序中，modules/prefs.js 晚於 configIntegration.js 載入 → 導致 unifiedConfig 的 global.prefs 被覆蓋，現行實際生效的是 legacy prefs（dict_maker.*）。
- PrefsManager.configs 已含 rootOrderOpt、formatOpt、separatorOpt、countOpt、rangeInput。dictMaker.js 仍直接讀 DOM 值（功能正常）。
- configIntegration.js 的遷移清單未涵蓋全部新鍵；同時存在清理/遷移對 dict_maker.* 的處理，但目前被覆蓋後不生效。

關鍵問題與風險
- 不同鍵名前綴：dict_maker.* vs unifiedConfig（rovodev_* namespace + dictMaker.*）
- 可能造成狀態不一致（使用者在不同頁面/版本切換時值不同步）
- 雙實作路徑增加維護成本；新選項納管不完整
- 載入順序造成的覆蓋行為使 unifiedConfig 無法主導

方案比較
- 方案 A：prefs.js 底層委派 unifiedConfig（SSOT）
  - 作法：在 modules/prefs.js 中檢測 unifiedConfig 是否存在；若存在則 prefs.get/set/remove 轉呼叫 unifiedConfig.get/ set/remove（prefix: dictMaker.）；若不存在則 fallback 至 legacy localStorage(dict_maker.*)。
  - 優點：
    - 單一真實來源（降低不一致風險）
    - 漸進遷移：老頁面無 unifiedConfig 也能工作（fallback）
    - PrefsManager 邏輯與 API 不變（低接觸面）
    - 長期維護成本低（只維護 unifiedConfig）
  - 缺點：
    - prefs.js 對 unifiedConfig 有隱性依賴（需保證在 dictMaker.html 先載入 configIntegration.js，或在 prefs.js 內做 runtime 檢測/延遲）
    - 需要補齊 unifiedConfig 的遷移與清理清單（rootOrderOpt/formatOpt 等）
  - 風險與緩解：
    - 風險：載入順序不當 → 緩解：prefs.js 內做 runtime feature detect；若無 unifiedConfig 則自動 fallback。
    - 風險：舊鍵殘留 → 緩解：首次偵測到 unifiedConfig 時執行單向遷移並清理舊鍵（可選擇延後清理）。

- 方案 B：configIntegration 與 legacy prefs（dict_maker.*）雙向同步
  - 作法：
    - 在 configIntegration.js 增加 storage 事件監聽，將 dict_maker.* 與 dictMaker.* 相互同步；
    - 啟動時做雙向 reconcile 策略（例如以較新者為準或以 unifiedConfig 為主）；
    - PrefsManager 保持 localStorage(dict_maker.*) 讀寫不變。
  - 優點：
    - 不動 prefs.js，改動集中於 configIntegration.js
    - 兼容現有任何直接存取 dict_maker.* 的舊頁面
  - 缺點：
    - 複雜度高：需處理循環同步、衝突解決、事件風暴節流、時間戳比較
    - 風險高：跨頁/多分頁 storage 事件競態、不同源值覆寫
    - 長期維護性差：持續背負兩套鍵名與同步器
  - 風險與緩解：
    - 風險：同步循環 → 緩解：write-through with source tagging；但仍增加心智負擔
    - 風險：競態導致資料錯亂 → 緩解：引入版本戳或嚴格單向主從策略；仍複雜

決策建議
- 推薦採用 方案 A（prefs → unifiedConfig 委派 + fallback）
  - 理由：
    - 單一資料來源、低心智負擔
    - 對現有頁面修改最小，向後相容性佳
    - 便於集中治理與監控（可於 unifiedConfig 增加觀察與日誌）

關鍵路徑與順序規劃（方案 A）
1) 鍵名盤點與遷移擴充（High）
   - 擴充 configIntegration.js 與 modules/config.js 中 migrateDictMakerPrefs 的鍵清單：加入 rootOrderOpt、formatOpt（若未完整）及現有全表（fcj*、countOpt、separatorOpt、rangeInput）。
   - 擴充清理/去重流程：避免重複遷移與殘留，置於 try-catch 中保守處理。
2) prefs 底層委派 unifiedConfig（High）
   - 修改 scripts/modules/prefs.js：
     - 檢測 global.unifiedConfig 是否存在；若有：
       - prefs.get(key, def) → unifiedConfig.get(`dictMaker.${key}`, def)
       - prefs.set(key, val) → unifiedConfig.set(`dictMaker.${key}`, val)
       - prefs.remove(key) → unifiedConfig.remove(`dictMaker.${key}`)
     - 若無 unifiedConfig：沿用現有 localStorage(dict_maker.*)。
     - 首次偵測 unifiedConfig 時，可選擇執行一次性遷移：從 dict_maker.* 讀值寫入 unifiedConfig（僅當 unified 尚無值）。
3) 修正載入順序與覆蓋（Medium）
   - 確保 dictMaker.html 中 configIntegration.js 仍先於 modules/prefs.js 載入（目前即如此），以利 prefs 在 runtime 可偵測到 unifiedConfig。
   - 移除 configIntegration.js 中對 global.prefs 的強制覆蓋（或保留但不重要，因 prefs.js 會接手委派）。
4) PrefsManager 完整選項納管（Medium）
   - 確認 PrefsManager.configs 已含 rootOrderOpt、formatOpt、separatorOpt、countOpt、rangeInput、fcj*。
   - 驗證 restore/bind 流程與 dictMaker.js 的 initFormatSync 聯動，確保切換格式時的持久化仍寫入 prefs（實際會落到 unifiedConfig）。
5) 測試與驗證（High）
   - 單頁驗證：dictMaker.html
     - 首次載入：無任何 localStorage → 默認值是否正確
     - 設定變更後刷新：值是否保留，且來源僅在 unifiedConfig
   - 遷移驗證：已有 dict_maker.* 值 → 是否順利寫入 unifiedConfig.dictMaker.*，且後續讀寫僅觸 unifiedConfig
   - 聯動驗證：formatOpt 切換是否同步更新 rootOrderOpt/countOpt/separatorOpt 並持久化
   - 逆向相容：移除/禁用 configIntegration.js（模擬無 unifiedConfig）時，prefs 是否仍可獨立運作
6) 文檔與回退策略（Medium）
   - 更新 docs/dev_log 與 README：說明 SSOT 與委派策略、鍵名規範
   - 回退：
     - 移除 prefs 委派邏輯或關閉 unifiedConfig 檢測 → 回歸 legacy dict_maker.*
     - 保留遷移程式碼為 no-op（不再執行清理）

實作 ToDo（可指派給子任務）
- Phase 1：遷移與委派骨架（High）
  - [x] 擴充 configIntegration.js migrateDictMakerPrefs 鍵清單，納入 rootOrderOpt、formatOpt（如缺）✅
  - [x] 檢查並更新清理/去重列表，避免重複遷移與殘留 ✅
  - [x] 在 modules/prefs.js 中新增 unifiedConfig 委派邏輯（含 fallback）✅
  - [x] 在 modules/prefs.js 中加入一次性遷移（可選，僅將不存在的 unified 值用 legacy 值補上）✅

- Phase 2：端到端驗證與相容性（High）
  - [x] 手動測試腳本：✅
    - 無資料情境、僅 legacy、有雙方資料（以 unified 為主）
    - formatOpt 觸發聯動與持久化
  - [ ] 檢查 dictMaker_v2 / elegant 系列頁面是否載入 modules/prefs.js；若無，不受影響；若有，行為一致
  - [ ] 檢查 words*.html 對 configIntegration 與 prefs 的使用是否一致（避免跨頁互覆寫）

- Phase 3：清理與監控（Medium）
  - [ ] 規劃逐步淘汰 dict_maker.* 鍵（觀察期後清理）
  - [ ] 在 unifiedConfig 增加 debug 日誌或 metrics（可選）

優先等級與關鍵路徑
- High：
  - 擴充遷移鍵清單（含 rootOrderOpt、formatOpt）
  - prefs.js 委派 unifiedConfig + fallback
  - 端到端驗證（含遷移）
- Medium：
  - 載入順序檢查、清理列表完善
  - 文檔更新與回退說明
- Low：
  - 監控與度量、逐步清理 legacy 鍵

風險評估
- 高風險：雙向同步（方案 B）帶來競態與循環；不採用
- 中風險：遷移時的舊鍵清理過早 → 採用延後清理策略
- 低風險：載入順序導致一開始沒有 unifiedConfig → 以 runtime 檢測 + fallback 緩解

里程碑與驗收
- M1（A 骨架落地）：prefs 委派 unifiedConfig，遷移清單補齊，頁面可正常持久化與回存
- M2（端到端驗證）：三情境測試通過，format 聯動正常，無錯誤日誌
- M3（清理與文檔）：文檔更新，規劃觀察期與 legacy 清理時間點

附錄：鍵名清單（dictMaker.*）
- 布林/checkbox：
  - fcjOpt_freq1000_code3_to_code2
  - fcjOpt_singleChar
  - fcjOpt_2char
  - fcjOpt_3char
  - fcjOpt_4char
  - fcjOpt_5pluschar
  - countOpt
- select：
  - separatorOpt
  - rootOrderOpt
  - formatOpt
- input：
  - rangeInput

方案 B（備選）ToDo 概要（不建議）
- [ ] configIntegration.js：storage 事件監聽，dict_maker.* <-> dictMaker.* 雙向同步（加入 source 標記避免循環）
- [ ] 衝突策略：以 unified 為主；加入 updatedAt 戳以解決多分頁競態
- [ ] 啟動順序：先做一次雙向 reconcile 再綁定事件
- [ ] 壓測：快速切換多選項、開多分頁觀察循環與延遲
