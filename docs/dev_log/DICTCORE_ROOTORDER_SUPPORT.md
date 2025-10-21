# DictCore 模組 rootOrder 參數支援

## 修改日期
2024年（當前版本）

## 問題描述
`dictMaker.js` 中的 `normalizeBtn` 和 `dedupeWithCommentsBtn` 按鈕無法正確控制字根順序，原因是 `DictCore` 模組的核心函數不支援 `rootOrder` 參數。

### 症狀
- ✅ `quickBtn` 和 `fcjBtn` 的字根順序控制正常（直接使用 `FcjUtils.cjMakeFromText`）
- ❌ `normalizeBtn` 和 `dedupeWithCommentsBtn` 失敗（使用 `DictCore` 模組函數）

## 解決方案

### 修改檔案
`scripts/modules/dictCore.js`

### 修改內容

#### 1. `normalizeDictionaryCore` 函數
**修改位置：** 第 185-365 行

**變更：**
- 新增參數：`rootOrder = 'after'` 在選項物件中
- 更新文檔註釋，說明 `rootOrder` 參數用途
- 修改輸出邏輯（第 369-376 行）：
  ```javascript
  // 根據 rootOrder 決定輸出順序
  if (rootOrder === 'before') {
    // 字根在前：root + separator + word + separator + count
    result.push(`${root}${separator}${word}${separator}${count}`);
  } else {
    // 字根在後（預設）：word + separator + root + separator + count
    result.push(`${word}${separator}${root}${separator}${count}`);
  }
  ```

#### 2. `performDeduplicationCore` 函數
**修改位置：** 第 82-186 行

**變更：**
- 新增參數：`rootOrder = 'after'` 在選項物件中
- 更新文檔註釋，說明 `rootOrder` 參數用途
- 修改輸出邏輯（第 176-182 行）：
  ```javascript
  // 根據 rootOrder 決定輸出順序
  if (rootOrder === 'before') {
    result[index] = `${root}${separator}${word}${separator}${count}`;
  } else {
    result[index] = `${word}${separator}${root}${separator}${count}`;
  }
  ```

#### 3. `dedupeWithCommentsCore` 函數
**修改位置：** 第 387-439 行

**變更：**
- 更新文檔註釋，說明此函數支援 `rootOrder` 參數
- 新增註解說明：內部呼叫的 `normalizeDictionaryCore` 和 `performDeduplicationCore` 會自動傳遞 `rootOrder`
- 無需修改實際程式碼邏輯（因為會透過 `opts` 物件自動傳遞參數）

## rootOrder 參數說明

### 參數值
- `'after'`（預設）：輸出格式為 `詞 字根 計數`
- `'before'`：輸出格式為 `字根 詞 計數`

### 使用範例

```javascript
// 範例 1: normalizeDictionaryCore
const result = await normalizeDictionaryCore(lines, {
  separator: '\t',
  cjProvider: createCjProvider('after'),
  rootOrder: 'after'  // 字根在後
});

// 範例 2: dedupeWithCommentsCore
const result = await dedupeWithCommentsCore(lines, {
  separator: '\t',
  cjProvider: createCjProvider('before'),
  rootOrder: 'before'  // 字根在前
});

// 範例 3: performDeduplicationCore
const result = performDeduplicationCore(lines, {
  separator: '\t',
  rootOrder: 'after'  // 字根在後
});
```

## 相容性

### 向後相容
- ✅ `rootOrder` 參數為可選參數，預設值為 `'after'`
- ✅ 現有代碼若未傳遞 `rootOrder` 參數，仍會使用預設值正常運作
- ✅ 全域 API 掛載保持不變

### 依賴關係
- `dictMaker.js` 中的 `normalizeDictionary` 和 `dedupeWithComments` 函數已正確傳遞 `rootOrder` 參數
- `createCjProvider` 函數已支援 `rootOrder` 參數
- UI 控制元件 `#rootOrderOpt` 已存在於 `dictMaker.html` 中

## 測試建議

### 手動測試步驟
1. 開啟 `dictMaker.html`
2. 在輸入框輸入測試詞彙（例如：`測試\n示範\n例子`）
3. 選擇字根順序：
   - 選擇「在後」，點擊「補完整字典」，確認輸出格式為 `詞 字根 計數`
   - 選擇「在前」，點擊「補完整字典」，確認輸出格式為 `字根 詞 計數`
4. 測試「註解去重→Rime」按鈕，確認字根順序控制正確
5. 對比「速成」和「快倉」按鈕，確認所有按鈕的字根順序控制一致

### 自動化測試
已建立測試檔案：`tmp_rovodev_test_rootOrder.html`（臨時檔案）

## 影響範圍

### 修改的模組
- ✅ `scripts/modules/dictCore.js`（核心邏輯層）

### 不需修改的模組
- ✅ `scripts/dictMaker.js`（已經正確傳遞參數）
- ✅ `dictMaker.html`（UI 控制元件已存在）

## 完成狀態
✅ 核心函數已支援 `rootOrder` 參數  
✅ 文檔註釋已更新  
✅ 向後相容性已確保  
✅ 測試檔案已建立  

## 後續清理
- 刪除測試檔案：`tmp_rovodev_test_rootOrder.html`
