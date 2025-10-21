# normalizeDictionaryCore 使用指南

## 快速開始

### 基本用法

```javascript
// 1. 準備輸入資料（字串陣列）
const lines = [
  '字',           // 單欄格式
  'word\t5',      // 雙欄格式（詞 計數）
  '詞\tci\t10',   // 三欄格式（已有 root）
  '# 這是註解',   // 註解行
  ''              // 空行
];

// 2. 準備 cjProvider（倉頡編碼提供函式）
async function cjProvider(word) {
  // 實際應用中，這裡會呼叫真實的倉頡編碼服務
  return await FcjUtils.getCJCode(word);
}

// 3. 呼叫函數
const result = await normalizeDictionaryCore(lines, {
  separator: '\t',        // 分隔符
  cjProvider: cjProvider, // 編碼函式
  concurrency: 8          // 併發數（可選）
});

// 4. 結果
console.log(result);
// ['字\tzi\t1', 'word\tword\t5', '詞\tci\t10', '# 這是註解', '']
```

## 與現有系統整合

### 在 dictMaker.js 中使用

```javascript
async function normalizeDictionary() {
  const raw = $('#inputTextarea').val() || '';
  if (!raw.trim()) {
    $('#outputTextarea').val('');
    return;
  }

  const separator = UIHelpers.getSeparator();
  const lines = raw.split(/\r?\n/);
  
  // 建立 cjProvider 適配器
  const cjProvider = async (word) => {
    const cjResult = await FcjUtils.cjMakeFromText(word, 'fcj', {
      charLengthFilter: () => true,
      showCount: false,
      separator: ' '
    });
    
    if (cjResult) {
      const cjLines = cjResult.split('\n').filter(Boolean);
      if (cjLines.length > 0) {
        const cjParts = cjLines[0].split(' ');
        return cjParts[1] || word;
      }
    }
    return word;
  };

  // 使用 Core API
  const result = await normalizeDictionaryCore(lines, {
    separator,
    cjProvider,
    concurrency: 8
  });

  // 更新 UI
  $('#outputTextarea').val(result.join('\n'));
  UIHelpers.updateOutputCount(result);
  UIHelpers.updateOutputMeta('本次使用：補完整字典功能');
}
```

## 參數說明

### lines (必填)
- **類型：** `string[]`
- **說明：** 字典內容的行陣列
- **範例：** `['字', 'word\t5', '# 註解']`

### opts.separator (必填)
- **類型：** `string`
- **說明：** 輸出使用的分隔符
- **常用值：** `'\t'`（Tab）或 `' '`（空格）
- **注意：** 必須與整個系統保持一致

### opts.cjProvider (必填)
- **類型：** `async (word: string) => Promise<string>`
- **說明：** 倉頡編碼提供函式
- **輸入：** 詞（字串）
- **輸出：** 編碼（字串）
- **錯誤處理：** 失敗時應回傳原詞，或拋出錯誤（函數會自動回退）

### opts.concurrency (可選)
- **類型：** `number`
- **預設值：** `8`
- **說明：** 最大併發請求數
- **建議值：**
  - 本地測試：`2-4`
  - 生產環境：`8-16`
  - 慢速網路：`4-8`

## 輸入格式支援

### 格式 A1：單欄「詞」
```
輸入：字
輸出：字\tzi\t1
```

### 格式 A2：雙欄「詞 計數」
```
輸入：字\t5
輸出：字\tzi\t5
```

### 格式 B1：三欄「詞 root count」
```
輸入：字\tzi\t5
輸出：字\tzi\t5
```

### 格式 B2：三欄「root 詞 count」
```
輸入：zi\t字\t5
輸出：字\tzi\t5
```

### 特殊行
```
輸入：# 這是註解
輸出：# 這是註解（原樣保留）

輸入：（空行）
輸出：（空行，原樣保留）
```

## 效能特性

### 記憶化
- 相同的詞只會查詢一次 cjProvider
- 使用 Promise 級快取，避免競態條件

```javascript
// 範例：6 行輸入，3 個唯一詞
const lines = ['字', '字', '詞', '字', '詞', '測試'];
// cjProvider 只會被呼叫 3 次（字、詞、測試各一次）
```

### 併發控制
- 批次並行查詢，避免同時發起過多請求
- 批內並行，批間順序

```javascript
// concurrency = 2 的情況
const lines = ['字1', '字2', '字3', '字4', '字5'];
// 執行順序：
// 批次 1：['字1', '字2'] 並行
// 批次 2：['字3', '字4'] 並行
// 批次 3：['字5']
```

## 錯誤處理

### 參數錯誤
```javascript
try {
  await normalizeDictionaryCore('not array', { ... });
} catch (e) {
  console.error(e.message);
  // 'normalizeDictionaryCore: lines 必須是陣列'
}
```

### cjProvider 錯誤
```javascript
// 個別詞失敗不影響整體
const cjProvider = async (word) => {
  if (word === '錯誤詞') {
    throw new Error('查詢失敗');
  }
  return getCode(word);
};

// 輸入：['正常', '錯誤詞', '另一個']
// 輸出：['正常\tcode\t1', '錯誤詞\t錯誤詞\t1', '另一個\tcode\t1']
// '錯誤詞' 自動回退到原詞
```

## 常見問題

### Q1: 為什麼需要傳入 cjProvider？
**A:** 採用依賴注入設計，讓核心函數保持純粹，不依賴特定的倉頡編碼實作。這樣可以：
- 易於測試（可以注入 mock）
- 靈活切換不同的編碼服務
- 保持函數的可重用性

### Q2: 如何確保 separator 一致？
**A:** 在 UI 層統一使用 `UIHelpers.getSeparator()` 取得分隔符，並傳給所有 Core 函數。

```javascript
const separator = UIHelpers.getSeparator();
// 所有函數都使用同一個 separator
await normalizeDictionaryCore(lines, { separator, ... });
await performDeduplicationCore(lines, { separator });
```

### Q3: concurrency 設定多少合適？
**A:** 取決於您的使用場景：
- **本地開發/測試：** 2-4（方便觀察）
- **生產環境（快速網路）：** 8-16
- **行動裝置/慢速網路：** 4-8
- **大量資料（>1000 詞）：** 可適度提高到 16-32

### Q4: 如何處理混合中英文的詞？
**A:** 函數會自動判斷：
- 純英文：`root = word.toLowerCase()`
- 純中文：`root = await cjProvider(word)`
- 混合/其他：`root = word`（回退）

## 測試

### 執行單元測試
```bash
# Node.js 環境
node tmp_rovodev_test_normalize.js

# 瀏覽器環境
開啟 tmp_rovodev_test_normalize.html
```

### 自訂測試
```javascript
// 建立測試 cjProvider
const testProvider = async (word) => {
  const map = { '字': 'zi', '詞': 'ci' };
  return map[word] || word;
};

// 執行測試
const result = await normalizeDictionaryCore(
  ['字', '詞', 'word'],
  { separator: '\t', cjProvider: testProvider }
);

console.assert(
  result[0] === '字\tzi\t1',
  '中文處理正確'
);
console.assert(
  result[2] === 'word\tword\t1',
  '英文處理正確'
);
```

## 相關文檔

- [P3-1 完成報告](./P3-1_NORMALIZE_CORE_COMPLETE.md)
- [dictCore API 參考](./dictCore_API_REFERENCE.md)
- [P3 任務清單](../todo/dictMaker_P3_todo.md)

## 版本歷史

- **v1.0.0** (2024) - 初始版本
  - 完整實作 normalizeDictionaryCore
  - 支援記憶化與併發控制
  - 完整的錯誤處理
