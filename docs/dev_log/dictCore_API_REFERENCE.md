# dictCore.js API 參考文件

## 📚 模組概述

**檔案位置**: `scripts/modules/dictCore.js`  
**模組名稱**: `DictCore`  
**版本**: 1.0.0  
**職責**: 提供字典處理的核心純函式（格式檢測、正規化、去重）

---

## 🔌 模組載入

### 方式一：直接載入（推薦用於現有頁面）
```html
<script src="scripts/modules/dictCore.js"></script>
```

### 方式二：透過模組系統（用於 v2_elegant 版本）
```javascript
const dictCore = await ModuleSystem.get('dictCore');
```

---

## 📦 API 介面

### 訪問方式

#### 新式 API（推薦）
```javascript
window.Modules.DictCore.needsNormalizationCore(lines)
window.Modules.DictCore.performDeduplicationCore(lines, opts)
window.Modules.DictCore.normalizeDictionaryCore(lines, opts)
window.Modules.DictCore.dedupeWithCommentsCore(lines, opts)
```

#### 向後相容 API
```javascript
window.needsNormalizationCore(lines)
window.performDeduplicationCore(lines, opts)
window.normalizeDictionaryCore(lines, opts)
window.dedupeWithCommentsCore(lines, opts)
```

---

## 🔧 核心函式

### 1. needsNormalizationCore

**功能**: 檢查字典內容是否需要正規化

**簽名**:
```javascript
function needsNormalizationCore(lines: string[]): boolean
```

**參數**:
- `lines` (string[]): 字典內容的行陣列

**返回值**:
- `boolean`: `true` 表示需要正規化，`false` 表示格式正確

**判斷邏輯**:
- 檢查是否有非註解、非空行的內容行
- 檢查分隔符位置是否符合標準格式
- 忽略以 `#` 開頭的註解行和空白行

**使用範例**:
```javascript
const lines = [
  'word\tcode',
  '詞\taa',
  '# 這是註解',
  ''
];

const needsNormalization = window.Modules.DictCore.needsNormalizationCore(lines);
console.log(needsNormalization); // true 或 false
```

**當前狀態**: 🚧 骨架完成，待 P2-2 實作

---

### 2. performDeduplicationCore

**功能**: 執行字典去重的核心邏輯

**簽名**:
```javascript
function performDeduplicationCore(
  lines: string[], 
  opts: { separator: string }
): string[]
```

**參數**:
- `lines` (string[]): 字典內容的行陣列
- `opts` (Object): 選項物件
  - `separator` (string): 分隔符，如 `'\t'` 或 `' '`

**返回值**:
- `string[]`: 去重後的行陣列

**處理邏輯**:
- 合併重複的詞條（相同詞+編碼）
- 保留註解行和空白行的位置
- 累加重複詞條的計數（如果有）
- 使用指定的分隔符處理詞條

**使用範例**:
```javascript
const lines = [
  'word\tcode\t100',
  'word\tcode\t50',
  '# comment',
  '詞\taa\t10'
];

const opts = { separator: '\t' };
const result = window.Modules.DictCore.performDeduplicationCore(lines, opts);

// 預期結果:
// [
//   'word\tcode\t150',  // 計數合併
//   '# comment',        // 註解保留
//   '詞\taa\t10'
// ]
```

**錯誤處理**:
```javascript
// 錯誤案例 1：lines 不是陣列
try {
  performDeduplicationCore('not-array', { separator: '\t' });
} catch (e) {
  console.error(e.message); 
  // "performDeduplicationCore: lines 必須是陣列"
}

// 錯誤案例 2：缺少 separator
try {
  performDeduplicationCore(['test'], {});
} catch (e) {
  console.error(e.message); 
  // "performDeduplicationCore: opts.separator 必須是字串"
}
```

**當前狀態**: 🚧 骨架完成，待 P2-3 實作

---

### 3. normalizeDictionaryCore

**功能**: 執行字典正規化的核心邏輯（非同步）

**簽名**:
```javascript
async function normalizeDictionaryCore(
  lines: string[],
  opts: {
    separator: string,
    cjProvider: (word: string) => Promise<string>
  }
): Promise<string[]>
```

**參數**:
- `lines` (string[]): 字典內容的行陣列
- `opts` (Object): 選項物件
  - `separator` (string): 分隔符
  - `cjProvider` (Function): 倉頡編碼提供函式，接受詞返回編碼

**返回值**:
- `Promise<string[]>`: 正規化後的行陣列

**處理邏輯**:
- 將字典內容轉換為標準格式：詞 + 分隔符 + 編碼
- 透過 `cjProvider` 獲取每個詞的倉頡編碼
- 保留註解行和空白行
- 移除無效或空白的詞條

**使用範例**:
```javascript
// 定義編碼提供函式
const cjProvider = async (word) => {
  // 這裡可以呼叫 FcjUtils.cjMakeFromText 等
  const code = await getCangjieCode(word);
  return code;
};

const lines = [
  'word',      // 只有詞，沒有編碼
  '詞',        // 只有詞，沒有編碼
  '# comment'  // 註解
];

const opts = {
  separator: '\t',
  cjProvider: cjProvider
};

const result = await window.Modules.DictCore.normalizeDictionaryCore(lines, opts);

// 預期結果:
// [
//   'word\tcode1',   // 補上編碼
//   '詞\tcode2',     // 補上編碼
//   '# comment'      // 註解保留
// ]
```

**依賴注入範例**:
```javascript
// 使用自定義的編碼提供者（便於測試）
const mockCjProvider = async (word) => {
  const mockCodes = {
    'word': 'abc',
    '詞': 'xyz'
  };
  return mockCodes[word] || 'unknown';
};

const result = await normalizeDictionaryCore(
  ['word', '詞'],
  { separator: '\t', cjProvider: mockCjProvider }
);
```

**錯誤處理**:
```javascript
// 錯誤案例：缺少 cjProvider
try {
  await normalizeDictionaryCore(['test'], { separator: '\t' });
} catch (e) {
  console.error(e.message); 
  // "normalizeDictionaryCore: opts.cjProvider 必須是函式"
}
```

**當前狀態**: 🚧 骨架完成，待 P2-5 實作

---

### 4. dedupeWithCommentsCore

**功能**: 執行帶註解的去重完整流程（非同步）

**簽名**:
```javascript
async function dedupeWithCommentsCore(
  lines: string[],
  opts: {
    separator: string,
    cjProvider: (word: string) => Promise<string>
  }
): Promise<string[]>
```

**參數**:
- `lines` (string[]): 字典內容的行陣列
- `opts` (Object): 選項物件
  - `separator` (string): 分隔符
  - `cjProvider` (Function): 倉頡編碼提供函式

**返回值**:
- `Promise<string[]>`: 處理後的行陣列

**處理流程**:
1. 檢測格式（調用 `needsNormalizationCore`）
2. 如果需要正規化，執行正規化（調用 `normalizeDictionaryCore`）
3. 執行去重（調用 `performDeduplicationCore`）
4. 返回最終結果

**使用範例**:
```javascript
const cjProvider = async (word) => await getCangjieCode(word);

const lines = [
  'word',       // 需要正規化
  'word',       // 重複
  '# comment',  // 註解
  '詞\taa\t10'  // 已有格式
];

const opts = {
  separator: '\t',
  cjProvider: cjProvider
};

const result = await window.Modules.DictCore.dedupeWithCommentsCore(lines, opts);

// 預期結果:
// [
//   'word\tcode\t2',  // 正規化並去重，計數 = 2
//   '# comment',      // 註解保留
//   '詞\taa\t10'
// ]
```

**完整工作流程**:
```javascript
async function processDict() {
  const inputLines = [
    'apple',
    'apple',
    'banana',
    '# 水果列表',
    '橘子\txyz'
  ];

  // 定義編碼提供者
  const cjProvider = async (word) => {
    // 模擬非同步編碼查詢
    return await lookupCangjieCode(word);
  };

  // 執行完整去重流程
  const result = await dedupeWithCommentsCore(inputLines, {
    separator: '\t',
    cjProvider: cjProvider
  });

  console.log('處理結果:', result);
}
```

**當前狀態**: 🚧 骨架完成，待 P2-6 實作

---

## 🎯 使用模式

### 模式一：單獨使用核心函式
```javascript
// 1. 先檢查是否需要正規化
const needsNorm = needsNormalizationCore(lines);

// 2. 如果需要，執行正規化
if (needsNorm) {
  lines = await normalizeDictionaryCore(lines, { separator, cjProvider });
}

// 3. 執行去重
lines = performDeduplicationCore(lines, { separator });
```

### 模式二：使用整合函式（推薦）
```javascript
// 一次完成所有處理
const result = await dedupeWithCommentsCore(lines, {
  separator: '\t',
  cjProvider: myCustomProvider
});
```

### 模式三：依賴注入測試
```javascript
// 使用 mock provider 進行單元測試
const mockProvider = async (word) => 'mock_code';

const result = await normalizeDictionaryCore(
  ['test'],
  { separator: '\t', cjProvider: mockProvider }
);
```

---

## ⚙️ 配置選項

### separator (分隔符)

**類型**: `string`  
**必需**: 是  
**常用值**:
- `'\t'` - Tab 字符（推薦，Rime 標準）
- `' '` - 空格

**範例**:
```javascript
const opts = { separator: '\t' };
```

### cjProvider (編碼提供者)

**類型**: `(word: string) => Promise<string>`  
**必需**: 是（僅對 normalize 和 dedupe 函式）  
**作用**: 提供詞的倉頡編碼

**實作建議**:
```javascript
// 使用現有的 FcjUtils
const cjProvider = async (word) => {
  const result = await FcjUtils.cjMakeFromText(word);
  const parsed = parseCjResult(result);
  return parsed.rootCode;
};

// 或者使用簡化版
const cjProvider = async (word) => {
  return await getCangjieRootCode(word);
};
```

---

## 🧪 測試建議

### 單元測試案例

```javascript
// 測試 1: 空陣列
console.assert(
  needsNormalizationCore([]) === false,
  '空陣列不需要正規化'
);

// 測試 2: 僅註解
console.assert(
  needsNormalizationCore(['# comment', '']) === false,
  '僅註解不需要正規化'
);

// 測試 3: 參數驗證
try {
  performDeduplicationCore(null, { separator: '\t' });
  console.error('應該拋出錯誤');
} catch (e) {
  console.log('參數驗證通過');
}

// 測試 4: 非同步處理
(async () => {
  const mockProvider = async (w) => 'test';
  const result = await normalizeDictionaryCore(
    ['word'],
    { separator: '\t', cjProvider: mockProvider }
  );
  console.assert(Array.isArray(result), '應返回陣列');
})();
```

---

## 📋 開發檢查清單

### 實作新功能前
- [ ] 確認函式簽名符合 API 文檔
- [ ] 理解輸入/輸出格式
- [ ] 準備測試資料

### 實作過程中
- [ ] 保持純函式特性（無副作用）
- [ ] 添加適當的參數驗證
- [ ] 處理邊界情況（空陣列、空字串等）
- [ ] 保留註解和空行

### 實作完成後
- [ ] 執行單元測試
- [ ] 驗證錯誤處理
- [ ] 檢查效能（大數據集）
- [ ] 更新文檔和範例

---

## 🔗 相關資源

- **P2 階段計劃**: `docs/todo/dictMaker_P2_todo.md`
- **完成報告**: `docs/dev_log/TASK_P2-1_COMPLETE.md`
- **驗證清單**: `docs/dev_log/P2-1_VERIFICATION_CHECKLIST.md`
- **原始碼**: `scripts/modules/dictCore.js`

---

## 📝 版本歷史

### v1.0.0 (P2-1 階段)
- ✅ 建立模組骨架
- ✅ 定義四個核心函式介面
- ✅ 實作參數驗證
- ✅ 設定模組註冊和向後相容
- 🚧 實際邏輯待實作（P2-2 ~ P2-6）

---

**最後更新**: 2024  
**維護者**: RovoDev  
**狀態**: 骨架完成，核心邏輯開發中
