# words.html RimeBtn 調整紀錄（2025-10-19）

## 情境概述
- `words.html` 提供快速整理與轉出功能，原本僅能輸出固定基數 `詞	碼	頻`。
- `dictMaker.html` 具有完整的正規化與計數管線，但計數控制使用 `countOpt`，與 words 不同步。
- 需求：兩頁面共用一組基數設定，基數為 0 時完全不附帶計數，基數 > 0 時需落實「缺額視為 1 再加基數」。

## 更新實作
1. 基數管理
   - 新增 `RimeBaseManager`（`scripts/utils.js`）：統一讀寫 localStorage、共用最後一次的非 0 基數、提供 `applyBaseToText()` 轉換工具。
   - words 與 dictMaker 共用 `#rimeBaseInput`，變更時會回寫設定、更新狀態列並同步勾選狀態。
2. words RimeBtn
   - 以 `normalizeRimeEntries` + `createRimeLines` 搭配 `RimeBaseManager.applyBaseToText()` 取得最終 payload。
   - 基數為 0 → 只輸出 `詞	碼`；基數 > 0 → 轉成 `(原始數或 1) + 基數` 後輸出。
   - `option_status` 顯示語言/排序/基數摘要，`setResultStatus` 呈現完成或缺碼提醒。
3. dictMaker 整合
   - 新增 `#rimeBaseInput` 並隱藏原本 `countOpt` checkbox，透過 `syncDictMakerCountOpt()` 讓 checkbox 僅作為偏好同步橋梁。
   - `runMake`、`modules/app.js`、`legacy_compatibility.js` 皆改用 `transformTextForRimeBase()` 後再呼叫 `cjMakeFromText`，確保 quick/fcj 路徑一致。
   - 轉換時保留註解行、缺少計數的詞視為 1 再加基數，並回寫 UnifiedConfig / Prefs。
4. 顯示與儲存
   - `option_status` 顯示最新基數，`excuted_result` 會區分「有計數 / 不計數」。
   - words 的 `rovodev_words_config` 保存數值，dictMaker 透過 prefs & config 同步布林值 (`countOpt`)。

## 驗證建議
- words：輸入含計數 / 不含計數的詞表，確認基數 0、3、5 等情境輸出是否符合預期，含缺碼時訊息是否正確。
- dictMaker：使用 quickBtn / fcjBtn，在基數 0 與 >0 時確認輸出欄位與數值；舊有 `countOpt` 偏好應自動轉成基數。
- 重新整理或跨頁切換後，基數應維持記憶且 words、dictMaker 彼此同步。

## 待跟進
- README / modules_map 增補共用基數流程與設定說明。
- 觀察是否需要 migrate 舊偏好資料（例如僅存 `countOpt` 的使用者），必要時提供轉換腳本。
- 若後續新增其他格式（如 API export），應沿用 `RimeBaseManager.applyBaseToText()` 確保一致性。
