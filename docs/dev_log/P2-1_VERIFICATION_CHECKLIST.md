# P2-1 驗證清單 - dictCore 模組骨架

## 📋 快速驗證步驟

### 方法一：使用測試頁面（推薦）

1. **開啟測試頁面**
   ```
   在瀏覽器中打開：tmp_rovodev_test_dictCore.html
   ```

2. **檢查測試結果**
   - ✅ 所有測試項目應該顯示綠色（成功）或橘色（警告）
   - ❌ 不應該有紅色（失敗）項目
   - 測試摘要應顯示：成功 >= 12 項

3. **檢查控制台輸出**
   - 應該看到：`✅ dictCore.js 模組已載入（骨架版本 - 函式尚未實作）`
   - 調用函式時應該看到警告訊息

---

### 方法二：在現有頁面中測試

#### 步驟 1：加入模組到 HTML

在 `dictMaker.html` 的 `<script>` 標籤區域，在 `dictMaker.js` **之前** 加入：

```html
<script src="scripts/modules/dictCore.js"></script>
```

完整順序應該是：
```html
<script src="scripts/jquery-3.7.1.slim.min.js"></script>
<script src="scripts/configIntegration.js"></script>
<script src="scripts/cangjieProcessor.js"></script>
<script src="scripts/cangjieIntegration.js"></script>
<script src="scripts/charFilterIntegration.js"></script>
<script src="scripts/utils.js"></script>
<script src="scripts/extracted_features.js"></script>
<script src="scripts/rangeFilter.js"></script>
<script src="html-lib/components/CharLengthOptions/CharLengthOptions.js"></script>
<script src="scripts/modules/prefs.js"></script>
<script src="scripts/modules/dictCore.js"></script>  <!-- 新增這行 -->
<script src="scripts/dictMaker.js"></script>
<script src="scripts/legacy_compatibility.js"></script>
```

#### 步驟 2：開啟頁面

在瀏覽器中開啟 `dictMaker.html`

#### 步驟 3：打開開發者工具（F12）

查看 Console 分頁

#### 步驟 4：驗證模組載入

在 Console 中執行以下命令：

```javascript
// 1. 檢查 Modules 命名空間
console.log('Modules:', typeof window.Modules);
// 預期輸出: Modules: object

// 2. 檢查 DictCore 模組
console.log('DictCore:', typeof window.Modules.DictCore);
// 預期輸出: DictCore: object

// 3. 檢查核心函式
console.log('needsNormalizationCore:', typeof window.needsNormalizationCore);
console.log('performDeduplicationCore:', typeof window.performDeduplicationCore);
console.log('normalizeDictionaryCore:', typeof window.normalizeDictionaryCore);
console.log('dedupeWithCommentsCore:', typeof window.dedupeWithCommentsCore);
// 預期輸出: 全部為 function

// 4. 測試函式調用
window.needsNormalizationCore(['test']);
// 預期輸出: ⚠️ needsNormalizationCore 尚未實作，返回預設值 false
// 返回值: false

// 5. 測試參數驗證
try {
  window.performDeduplicationCore('not-array', { separator: '\t' });
} catch (e) {
  console.log('錯誤處理正常:', e.message);
}
// 預期輸出: 錯誤處理正常: performDeduplicationCore: lines 必須是陣列

// 6. 檢查模組資訊
console.log('Version:', window.Modules.DictCore.version);
console.log('Description:', window.Modules.DictCore.description);
// 預期輸出: Version: 1.0.0
//          Description: 字典處理核心模組（純函式層）
```

---

## ✅ 驗證清單

### 基礎驗證
- [ ] 頁面正常載入，無 JavaScript 錯誤
- [ ] Console 顯示模組載入訊息
- [ ] 原有功能（開啟檔案、按鈕等）仍然正常運作

### 模組結構驗證
- [ ] `window.Modules` 存在
- [ ] `window.Modules.DictCore` 存在
- [ ] `DictCore.version` 為 '1.0.0'
- [ ] `DictCore.description` 有正確描述

### 核心函式驗證
- [ ] `needsNormalizationCore` 函式存在
- [ ] `performDeduplicationCore` 函式存在
- [ ] `normalizeDictionaryCore` 函式存在
- [ ] `dedupeWithCommentsCore` 函式存在

### 向後相容驗證
- [ ] `window.needsNormalizationCore` 可訪問
- [ ] `window.performDeduplicationCore` 可訪問
- [ ] `window.normalizeDictionaryCore` 可訪問
- [ ] `window.dedupeWithCommentsCore` 可訪問

### 功能驗證
- [ ] 調用 `needsNormalizationCore(['test'])` 返回 `false`
- [ ] 調用時顯示警告訊息
- [ ] 參數驗證正常工作（傳入錯誤參數會拋出錯誤）
- [ ] `performDeduplicationCore(['test'], {separator: '\t'})` 返回 `['test']`

### 錯誤處理驗證
- [ ] 傳入非陣列參數會拋出錯誤
- [ ] 缺少 `opts.separator` 會拋出錯誤
- [ ] 缺少 `opts.cjProvider` 會拋出錯誤（針對需要的函式）
- [ ] 錯誤訊息清晰明確

---

## 🔍 預期行為

### 正常行為
1. 模組載入後，Console 顯示：`✅ dictCore.js 模組已載入（骨架版本 - 函式尚未實作）`
2. 調用函式時，顯示警告：`⚠️ [函式名] 尚未實作，返回預設值 [...]`
3. 所有函式都可以正常調用，不會崩潰
4. 參數驗證會捕獲明顯的錯誤

### 異常行為（需要修正）
- ❌ 頁面出現 JavaScript 錯誤
- ❌ `Modules.DictCore` 為 `undefined`
- ❌ 函式調用時拋出 `ReferenceError`
- ❌ 破壞了原有的功能（按鈕無法點擊等）

---

## 🧪 測試案例

### 測試案例 1：基本調用
```javascript
const result = window.needsNormalizationCore(['word\tcode', '詞\taa']);
console.assert(result === false, 'needsNormalizationCore 應返回 false');
```

### 測試案例 2：參數驗證
```javascript
try {
  window.performDeduplicationCore(null, { separator: '\t' });
  console.error('應該拋出錯誤但沒有');
} catch (e) {
  console.assert(
    e.message.includes('必須是陣列'),
    '錯誤訊息應包含「必須是陣列」'
  );
}
```

### 測試案例 3：返回原始輸入
```javascript
const input = ['test1', 'test2', '# comment'];
const result = window.performDeduplicationCore(input, { separator: '\t' });
console.assert(
  result === input,
  'performDeduplicationCore 應返回原始輸入'
);
```

### 測試案例 4：非同步函式
```javascript
(async () => {
  const result = await window.normalizeDictionaryCore(
    ['word'],
    { separator: '\t', cjProvider: async (w) => 'test' }
  );
  console.assert(
    Array.isArray(result),
    'normalizeDictionaryCore 應返回陣列'
  );
})();
```

---

## 📊 成功標準

### ✅ 全部通過
- 所有清單項目都打勾
- 所有測試案例通過
- Console 無錯誤訊息（警告訊息正常）
- 原有功能不受影響

### 🎉 P2-1 任務完成

當所有驗證項目通過後，P2-1 任務即可標記為完成，可以繼續進行 P2-2 任務。

---

## 🚨 常見問題

### Q1: 看到「尚未實作」警告是正常的嗎？
**A**: 是的！這正是 P2-1 階段的預期行為。我們只建立了骨架，實際邏輯將在後續任務中實作。

### Q2: 函式返回的都是預設值，這樣對嗎？
**A**: 對的。目前所有函式都返回預設值（`false`、原始輸入等），確保不會破壞頁面。

### Q3: 頁面功能還能正常使用嗎？
**A**: 應該可以。新模組只是新增，不會影響現有功能。如果有問題，請檢查是否正確放置了 script 標籤。

### Q4: 需要修改 dictMaker.js 嗎？
**A**: P2-1 階段不需要。我們只是建立模組骨架，後續任務才會整合到 dictMaker.js。

---

## 📞 問題回報

如果驗證過程中遇到問題，請記錄：
1. 瀏覽器類型和版本
2. Console 中的錯誤訊息
3. 具體的測試步驟
4. 預期行為 vs 實際行為

---

**驗證日期**: __________  
**驗證人員**: __________  
**驗證結果**: [ ] 通過 [ ] 失敗  
**備註**: ________________________________
