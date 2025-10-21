# P3-1 任務完成報告：normalizeDictionaryCore 核心函數實作

## 任務概述

根據 `docs/todo/dictMaker_P3_todo.md` 的 P3-1 任務需求，完成 `scripts/modules/dictCore.js` 中的 `normalizeDictionaryCore` 核心函數實作。

## 實作時間

- 完成日期：2024
- 任務編號：P3-1
- 複雜度：複雜
- 工作量：大

## 核心功能

### 1. 函數簽名

```javascript
async function normalizeDictionaryCore(lines, opts)
```

**參數：**
- `lines` (string[]): 字典內容的行陣列
- `opts` (Object): 選項物件
  - `opts.separator` (string): 分隔符（如 '\t' 或 ' '）
  - `opts.cjProvider` (Function): 倉頡編碼提供函式 `(word: string) => Promise<string>`
  - `opts.concurrency` (number, 預設 8): 最大併發數

**返回值：**
- `Promise<string[]>`: 正規化後的行陣列

### 2. 格式支援

函數支援以下輸入格式的自動檢測與轉換：

#### 格式 A1：單欄「詞」
```
字
word
```
**處理：** 補充 root + count
**輸出：** `字\tzi\t1`、`word\tword\t1`

#### 格式 A2：雙欄「詞 計數」
```
字\t5
word\t10
```
**處理：** 補充 root
**輸出：** `字\tzi\t5`、`word\tword\t10`

#### 格式 B1：三欄「詞 root count」
```
字\tzi\t5
```
**處理：** 標準化順序
**輸出：** `字\tzi\t5`

#### 格式 B2：三欄「root 詞 count」
```
zi\t字\t5
```
**處理：** 標準化順序為「詞 root count」
**輸出：** `字\tzi\t5`

#### 特殊行處理
- **註解行**（`#` 開頭）：原樣保留
- **空行**：原樣保留
- **無效格式**：原樣保留

### 3. 倉頡編碼策略

根據詞的類型自動選擇編碼策略：

| 詞類型 | 策略 | 範例 |
|--------|------|------|
| 純英文 | `root = word.toLowerCase()` | `Word` → `word` |
| 純中文 | `root = await cjProvider(word)` | `字` → `zi` |
| 混合或其他 | `root = word`（回退） | `Word字` → `Word字` |

### 4. 效能優化

#### 記憶化（Memoization）
- 使用 `Map` 快取 cjProvider 結果
- 避免對相同詞重複查詢
- Promise 級別快取，避免同時多個請求同一個詞

```javascript
const cjCache = new Map();
// word → Promise<string>
```

#### 併發控制
- 預設最多 8 個併發請求（可通過 `opts.concurrency` 調整）
- 批次處理：將待查詢詞分批，批內並行，批間順序
- 確保不會同時發起過多請求

```javascript
// 批次大小 = concurrency
const batches = [];
for (let i = 0; i < wordsArray.length; i += concurrency) {
  batches.push(wordsArray.slice(i, i + concurrency));
}
```

### 5. 錯誤處理

#### 參數驗證
```javascript
if (!Array.isArray(lines)) {
  throw new Error('normalizeDictionaryCore: lines 必須是陣列');
}
if (!opts || typeof opts.separator !== 'string') {
  throw new Error('normalizeDictionaryCore: opts.separator 必須是字串');
}
if (!opts.cjProvider || typeof opts.cjProvider !== 'function') {
  throw new Error('normalizeDictionaryCore: opts.cjProvider 必須是函式');
}
```

#### 個別錯誤不中斷整體
- 當 cjProvider 對某個詞失敗時，回退到原詞作為 root
- 記錄警告但繼續處理其他行
- 確保整體流程不受個別失敗影響

```javascript
try {
  const result = await cjProvider(word);
  return result || word;
} catch (e) {
  console.warn(`normalizeDictionaryCore: cjProvider 失敗於 "${word}":`, e.message || e);
  return word; // 回退
}
```

## 實作架構

### 三階段處理流程

```
第一階段：解析與收集
  ├─ 遍歷所有行
  ├─ 識別註解、空行、資料行
  ├─ 解析資料行格式
  ├─ 判斷是否需要查詢 cjProvider
  └─ 收集待查詢詞列表（wordsToFetch）

第二階段：批次並行查詢
  ├─ 將待查詢詞分批（每批 concurrency 個）
  ├─ 批內並行查詢（Promise.all）
  ├─ 批間順序執行（for...of）
  └─ 結果自動快取到 cjCache

第三階段：組裝輸出
  ├─ 遍歷解析結果
  ├─ 註解/空行原樣輸出
  ├─ 資料行從快取取得 root
  └─ 統一格式：詞 + separator + root + separator + count
```

## 測試方案

### 測試腳本

建立了兩個測試文件：
1. `tmp_rovodev_test_normalize.html` - 瀏覽器環境測試
2. `tmp_rovodev_test_normalize.js` - Node.js 環境測試

### 測試案例

| 測試編號 | 測試內容 | 預期結果 |
|----------|----------|----------|
| 測試 1 | 單欄格式 | 正確補充 root 和 count |
| 測試 2 | 雙欄格式（詞 計數） | 正確補充 root |
| 測試 3 | 三欄格式（已有 root） | 標準化順序 |
| 測試 4 | 混合格式 | 綜合處理正確 |
| 測試 5 | 併發與記憶化 | cjProvider 呼叫次數 = 唯一詞數 |
| 測試 6 | 參數驗證 | 正確拋出錯誤 |
| 測試 7 | 錯誤處理 | 個別失敗時回退 |

### 執行測試

**Node.js 環境：**
```bash
node tmp_rovodev_test_normalize.js
```

**瀏覽器環境：**
開啟 `tmp_rovodev_test_normalize.html` 查看結果

## 技術亮點

### 1. 純函數設計
- 無副作用，不直接操作 DOM
- 所有依賴通過參數注入（DI）
- 易於測試和重用

### 2. Promise 級記憶化
```javascript
const promise = (async () => {
  try {
    const result = await cjProvider(word);
    return result || word;
  } catch (e) {
    console.warn(`...`);
    return word;
  }
})();

cjCache.set(word, promise); // 快取 Promise，不是結果
```

這樣設計的好處：
- 同時多個請求同一個詞時，只會發起一次實際查詢
- 避免競態條件（race condition）

### 3. 優雅的併發控制
```javascript
// 分批
for (let i = 0; i < wordsArray.length; i += concurrency) {
  batches.push(wordsArray.slice(i, i + concurrency));
}

// 批內並行，批間順序
for (const batch of batches) {
  await Promise.all(batch.map(word => getCachedCJ(word)));
}
```

### 4. 格式檢測邏輯
使用正則表達式判斷字根位置：
- `/^[a-z]+$/` 匹配全小寫英文（字根特徵）
- `/^[a-zA-Z]+$/` 匹配純英文
- `/^[\u4e00-\u9fff]+$/` 匹配純中文

## 向後相容性

### 全域掛載
```javascript
global.normalizeDictionaryCore = DictCore.normalizeDictionaryCore;
```

### 模組化
```javascript
global.Modules.DictCore = {
  needsNormalizationCore,
  performDeduplicationCore,
  normalizeDictionaryCore, // ✅ 新增
  dedupeWithCommentsCore
};
```

## 代碼統計

- **新增行數：** ~160 行
- **函數複雜度：** 中高（三階段處理 + 併發控制）
- **測試覆蓋率：** 7 個測試案例

## 依賴關係

### 上游依賴
- 無（這是底層核心函數）

### 下游使用者
- `dedupeWithCommentsCore`（P3-2 任務）
- `dictMaker.js` wrapper 函數（P3-3 任務）

## 後續任務

根據 P3 計劃，接下來的任務：

1. **P3-2**: 實作 `dedupeWithCommentsCore`（整合 normalize + dedupe）
2. **P3-3**: 調整 `dictMaker.js` wrapper 使用 Core API
3. **P3-5**: cjProvider 效能驗證（記憶化與併發）
4. **P3-6**: 分隔符一致性與格式回歸測試

## 驗證清單

- [x] 參數驗證完整
- [x] 支援所有格式（單欄、雙欄、三欄）
- [x] 保留註解和空行
- [x] 英文/中文/混合編碼策略
- [x] 記憶化實作
- [x] 併發控制實作
- [x] 錯誤處理與回退
- [x] 分隔符一致性
- [x] JSDoc 文檔完整
- [x] 測試腳本建立

## 注意事項

### 使用時需要注意

1. **cjProvider 必須返回 Promise**
   ```javascript
   // ✅ 正確
   const cjProvider = async (word) => {
     return await someAsyncFunction(word);
   };
   
   // ❌ 錯誤（非 async）
   const cjProvider = (word) => {
     return word; // 返回字串而非 Promise
   };
   ```

2. **separator 必須與輸出一致**
   ```javascript
   // UI 層統一使用 UIHelpers.getSeparator()
   const separator = UIHelpers.getSeparator();
   const result = await normalizeDictionaryCore(lines, {
     separator,
     cjProvider
   });
   ```

3. **concurrency 調整建議**
   - 本地測試：2-4（避免過多並發）
   - 生產環境：8-16（根據伺服器能力）
   - 慢速網路：4-8（降低併發）

## 總結

✅ **P3-1 任務已完成**

實作了完整的 `normalizeDictionaryCore` 核心函數，包含：
- 嚴格的參數驗證
- 靈活的格式檢測與轉換
- 高效的記憶化與併發控制
- 健壯的錯誤處理
- 完整的測試覆蓋

該函數為 P3 階段的核心基礎，後續任務將基於此函數構建完整的字典處理流程。

---

**實作者：** Rovo Dev (AI Assistant)  
**審核狀態：** 待測試驗證  
**文檔版本：** 1.0
