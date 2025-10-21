# dictMaker: rootOrderOpt 記憶 + 格式下拉 (Rime/Pime) 需求分解與待辦清單

## 目標分析
- 功能一：rootOrderOpt 記憶功能
  - 讓「字根順序」選單 (#rootOrderOpt) 的選值能夠被持久化（localStorage），與既有選項一致。
- 功能二：新增「格式」下拉選單 (#formatOpt)
  - 選項：Rime、Pime
  - 行為：
    - Rime 選中時，自動設定 rootOrderOpt=在後(after)，countOpt=計數(true)
    - Pime 選中時，自動設定 rootOrderOpt=在前(before)，countOpt=不計數(false)
  - 格式選單本身也需要持久化記憶。
- 整合：符合現有 PrefsManager/configIntegration 模式，不破壞現有 dictMaker.js 流程與 AppModule 綁定。

## 範圍與影響
- HTML：dictMaker.html（新增 #formatOpt，確保與現有控制項 ID 命名一致）
- 偏好儲存：scripts/modules/prefs.js（將 #rootOrderOpt 與 #formatOpt 納入持久化清單）
- 統一配置層：scripts/configIntegration.js（新增 dictMaker.* 對應鍵，確保未來擴充/遷移一致）
- 行為邏輯：在初始化/變更時，formatOpt 改變需同步驅動 rootOrderOpt 與 countOpt，並寫回 prefs
- 現有功能相容：dictMaker.js 透過 getRootOrder() 讀 DOM 值，行為不變；runMake/normalize/dedupe 均讀取 #rootOrderOpt、#countOpt 與分隔符

## 任務拆解（含優先等級與依賴）

- P0 高優先（關鍵路徑）
  1. 審視現況並定義鍵值
     - 決定新鍵：
       - dictMaker.rootOrderOpt（字根順序；預設 'after'）
       - dictMaker.formatOpt（格式；預設 'Rime'）
     - 依賴：無
  2. PrefsManager 擴充持久化項目
     - 在 scripts/modules/prefs.js：
       - configs.selects 新增 { id: 'rootOrderOpt', defaultValue: 'after' }
       - configs.selects 新增 { id: 'formatOpt', defaultValue: 'Rime' }
     - bindEvents 中 select 綁定已泛用，無需額外處理
     - 依賴：1
  3. 新增格式選單 UI
     - 在 dictMaker.html 合適位置（與 separatorOpt、rootOrderOpt 同區）新增：
       - <label>格式:<select id="formatOpt"> <option value="Rime">Rime</option> <option value="Pime">Pime</option></select></label>
     - 依賴：無（可並行於 2）
  4. 定義格式選單行為邏輯
     - 在可初始化的腳本（建議 scripts/dictMaker.js 或 modules 層）新增：
       - on change(#formatOpt)：
         - 若為 Rime：$('#rootOrderOpt').val('after'); $('#countOpt').prop('checked', true)
         - 若為 Pime：$('#rootOrderOpt').val('before'); $('#countOpt').prop('checked', false)
         - 同步寫回 prefs：prefs.set('rootOrderOpt', ...)、prefs.set('countOpt', ...)、prefs.set('formatOpt', ...)
       - 在 PrefsManager.init() 之後觸發一次格式規則對齊：
         - 若使用者已有明確的 rootOrderOpt/countOpt 設定且與 formatOpt 不一致，處理策略：
           - 預設採「使用者優先」：僅在 formatOpt 改變時才覆寫；初始化時不強制覆寫現有值
     - 依賴：2、3（需 DOM 就緒，Prefs 已初始化）

- P1 中優先（完整整合與一致性）
  5. configIntegration 一致性擴充
     - 在 scripts/configIntegration.js：
       - migrateDictMakerPrefs 的鍵清單加入 'rootOrderOpt', 'formatOpt'
       - 綁定/命名空間支援 dictMaker.rootOrderOpt 與 dictMaker.formatOpt（保持與 prefs 一致）
     - 依賴：2、3
  6. App 模組適配檢查
     - 檢查 scripts/modules/app.js 是否需要讀取 config.get('dictMaker.rootOrderOpt')/('dictMaker.countOpt')：
       - 目前 runMake 使用 config.get('dictMaker.countOpt'), 'separatorOpt'，rootOrder 由 dictMaker.js 讀 DOM；可維持現狀
       - 若要完全一致可後續重構：由 config 綁定 rootOrderOpt/formatOpt 至 UI（非當前必須）
     - 依賴：5

- P2 低優先（最佳化與維護性）
  7. 專用事件封裝（選擇性）
     - 將格式選單行為封裝為一小模組（如 modules/uiHelpers.js 中新增 helper），減少 dictMaker.js 耦合
     - 依賴：4
  8. 舊資料遷移（強化）
     - 若曾有零散的 rootOrder 設定鍵名（無），則增加保護性遷移；目前可略
     - 依賴：5

## 程式碼修改清單
- dictMaker.html
  - 新增 #formatOpt 選單（Rime/Pime）
- scripts/modules/prefs.js
  - configs.selects 新增 'rootOrderOpt' 與 'formatOpt'
- scripts/dictMaker.js（或 helpers）
  - 綁定 #formatOpt change 事件，依選項設定 #rootOrderOpt 與 #countOpt 並寫回 prefs
  - 在 PrefsManager.init() 之後注入該綁定
- scripts/configIntegration.js
  - migrateDictMakerPrefs 鍵清單加入 'rootOrderOpt'、'formatOpt'（保持未來一致性與名稱空間化）

## 測試規劃
- 手動測試
  - 初次載入：
    - 預設顯示 formatOpt=Rime；rootOrderOpt=after；countOpt=true？（注意：初始化不應強制覆寫使用者歷史設定，因此首次載入若無歷史資料，才呈現預設）
  - 切換格式：
    - 切到 Pime：rootOrderOpt 變更為 before；countOpt 勾選取消；刷新頁面後狀態維持
    - 切回 Rime：rootOrderOpt 變更為 after；countOpt 勾選；刷新頁面後狀態維持
  - 與按鈕流程
    - quick/fcj/normalize/dedupe 操作時，輸出符合 rootOrder 與 count 顯示選項
- 自動化（可選）
  - 建立 tmp_rovodev_ 測試頁，模擬 localStorage 與事件，驗證格式切換聯動與持久化

## 文件更新
- README 或 docs/dev_log 補充：
  - 新增格式選單 Rime/Pime 說明與對 rootOrderOpt/countOpt 的自動配置
  - 補充 rootOrderOpt 記憶功能已納入 PrefsManager
- 本文件：docs/todo/dictMaker_format_and_rootOrder_memory_todo.md

## 品質檢查重點
- 不破壞現有功能：
  - PrefsManager.init() 順序正確、無例外
  - 未安裝新選單前（舊版頁面）程式不報錯（僅限本專案頁面）
- 狀態一致性：
  - formatOpt 僅在使用者變更時覆寫 rootOrderOpt/countOpt；初始化尊重既有持久化值
  - prefs 與 configIntegration 鍵名一致（dict_maker.* 與 dictMaker.* 命名空間對齊）
- 相容性：
  - localStorage 例外保護（try/catch）延續
  - 仍可離線運作

## 驗收標準
- 重新整理頁面後：rootOrderOpt、formatOpt、countOpt 設定可正確記憶
- 切換 Rime/Pime 時，自動套用對應 rootOrderOpt/countOpt，且變更被持久化
- quick/fcj/normalize/dedupe 的輸出結果皆符合當前 rootOrder 與 count 設定
