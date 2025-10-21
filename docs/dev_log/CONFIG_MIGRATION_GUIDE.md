# 配置系統遷移指南

## 📘 給未來維護者

本文檔說明如何在配置統一系統中新增、修改或移除配置項目。

## 🆕 新增配置項目

### 步驟 1: 在 PrefsManager 中定義

**檔案:** `scripts/modules/prefs.js`

根據類型新增到對應的陣列：

```javascript
const PrefsManager = {
  configs: {
    // Checkbox 類型
    checkboxes: [
      { id: 'myNewCheckbox', defaultValue: false }  // ✨ 新增這裡
    ],
    
    // Select 類型
    selects: [
      { id: 'myNewSelect', defaultValue: 'optionA' }  // ✨ 或這裡
    ],
    
    // Input 類型
    inputs: [
      { id: 'myNewInput', defaultValue: '' }  // ✨ 或這裡
    ]
  }
};
```

### 步驟 2: 加入遷移清單

**檔案:** `scripts/configIntegration.js` 和 `scripts/modules/config.js`

在 `migrateDictMakerPrefs()` 中新增鍵名：

```javascript
migrateDictMakerPrefs() {
  const dictMakerKeys = [
    // ... 現有的鍵 ...
    'myNewCheckbox',  // ✨ 新增到這裡
    'myNewSelect',
    'myNewInput'
  ];
  // ...
}
```

### 步驟 3: 在 HTML 中新增 UI 元素

**檔案:** `dictMaker.html` (或其他頁面)

```html
<!-- Checkbox 範例 -->
<label>
  <input type="checkbox" id="myNewCheckbox"> 我的新選項
</label>

<!-- Select 範例 -->
<select id="myNewSelect">
  <option value="optionA">選項 A</option>
  <option value="optionB">選項 B</option>
</select>

<!-- Input 範例 -->
<input type="text" id="myNewInput" placeholder="請輸入...">
```

### 步驟 4: 測試

```javascript
// Console 測試
prefs.set('myNewCheckbox', true);
console.log('讀取:', prefs.get('myNewCheckbox')); // 應輸出: true
console.log('Unified:', unifiedConfig.get('dictMaker.myNewCheckbox')); // 應輸出: true

// 刷新頁面，確認值保留
```

**完成！** 無需修改 prefs.js 的委派邏輯，系統會自動處理。

---

## ✏️ 修改現有配置

### 修改預設值

**檔案:** `scripts/modules/prefs.js`

```javascript
// 修改前
{ id: 'formatOpt', defaultValue: 'Rime' }

// 修改後
{ id: 'formatOpt', defaultValue: 'Pime' }  // ✨ 只修改 defaultValue
```

**注意:** 只影響新使用者，現有使用者的設定不受影響。

### 修改鍵名 (需要遷移)

如果要重新命名配置鍵（例如 `oldKey` → `newKey`），需要額外的遷移邏輯：

```javascript
// 在 prefs.js 的 _migrateToUnified() 中新增
const oldValue = unifiedConfig.get('dictMaker.oldKey');
if (oldValue !== null) {
  unifiedConfig.set('dictMaker.newKey', oldValue);
  unifiedConfig.remove('dictMaker.oldKey');
  console.log('✅ 已遷移 oldKey → newKey');
}
```

---

## 🗑️ 移除配置項目

### 步驟 1: 從 PrefsManager 移除

**檔案:** `scripts/modules/prefs.js`

```javascript
// 註解或刪除該配置
// { id: 'deprecatedOption', defaultValue: false }  // ❌ 已棄用
```

### 步驟 2: 從遷移清單移除

**檔案:** `scripts/configIntegration.js` 和 `scripts/modules/config.js`

```javascript
const dictMakerKeys = [
  // 'deprecatedOption',  // ❌ 移除這行
  // ... 其他鍵 ...
];
```

### 步驟 3: 從 HTML 移除 UI 元素

```html
<!-- ❌ 移除或註解
<input type="checkbox" id="deprecatedOption"> 舊選項
-->
```

### 步驟 4: (可選) 清理資料

如果要清理使用者的舊資料：

```javascript
// 在適當位置加入清理邏輯
unifiedConfig.remove('dictMaker.deprecatedOption');
localStorage.removeItem('dict_maker.deprecatedOption');
console.log('🧹 已清理 deprecatedOption');
```

**建議:** 保留清理邏輯數週後再移除，以便舊版本使用者也能清理。

---

## 🔧 進階操作

### 批量遷移

如果需要批量修改多個配置的命名格式：

```javascript
// 在 configIntegration.js 的 migrateExistingConfigs() 中新增
async migrateBatchRename() {
  const renameMap = {
    'old_name_1': 'newName1',
    'old_name_2': 'newName2',
    'old_name_3': 'newName3'
  };
  
  Object.entries(renameMap).forEach(([oldKey, newKey]) => {
    const oldValue = this.get(`dictMaker.${oldKey}`);
    if (oldValue !== null && this.get(`dictMaker.${newKey}`) === null) {
      this.set(`dictMaker.${newKey}`, oldValue);
      this.remove(`dictMaker.${oldKey}`);
      console.log(`✅ 遷移: ${oldKey} → ${newKey}`);
    }
  });
}
```

### 條件式遷移

如果遷移邏輯需要條件判斷：

```javascript
// 範例: 只遷移特定值
const oldValue = unifiedConfig.get('dictMaker.oldKey');
if (oldValue === 'specificValue') {
  unifiedConfig.set('dictMaker.newKey', 'newValue');
  console.log('✅ 條件式遷移完成');
}
```

### 資料轉換遷移

如果需要轉換資料格式：

```javascript
// 範例: 字串 → 布林
const oldValue = localStorage.getItem('dict_maker.oldKey');
if (oldValue === 'true' || oldValue === '1') {
  unifiedConfig.set('dictMaker.newKey', true);
} else {
  unifiedConfig.set('dictMaker.newKey', false);
}
```

---

## 🎯 最佳實踐

### ✅ 推薦做法

1. **保持鍵名一致性:** 使用 camelCase (例如 `myNewOption`)
2. **提供預設值:** 所有配置都應有合理的預設值
3. **寫入遷移清單:** 新增配置時記得更新 migrateDictMakerPrefs
4. **測試遷移路徑:** 測試 legacy → unified 的遷移是否正常
5. **記錄變更:** 在 CHANGELOG 中記錄配置變更

### ❌ 避免做法

1. **直接操作 localStorage:** 使用 prefs API 而非 localStorage
2. **硬編碼鍵名:** 集中在 PrefsManager.configs 中定義
3. **跳過遷移清單:** 會導致舊資料無法遷移
4. **覆蓋現有值:** 遷移時檢查目標是否已有值
5. **忽略錯誤處理:** 所有操作都應有 try-catch

---

## 📋 配置變更檢查清單

新增/修改配置時，請確認：

- [ ] PrefsManager.configs 已更新
- [ ] migrateDictMakerPrefs 清單已更新 (兩個檔案)
- [ ] HTML UI 元素已新增/修改
- [ ] 已在 Console 測試讀寫
- [ ] 已測試頁面刷新後保留
- [ ] 已測試從 legacy 遷移 (如適用)
- [ ] 已更新相關文檔
- [ ] 已在測試頁面驗證 (tmp_rovodev_test_config_unification.html)

---

## 🐛 常見問題

### Q: 新增的配置沒有自動保存？
**A:** 檢查是否：
1. PrefsManager.configs 中有定義
2. PrefsManager.init() 有被呼叫
3. UI 元素 id 與配置鍵名一致

### Q: 遷移沒有執行？
**A:** 檢查是否：
1. 鍵名已加入 migrateDictMakerPrefs 清單
2. prefs._migrated 標記是否已設定 (可重置測試)
3. 觸發了任一 prefs.get/set 操作

### Q: 配置在不同頁面不同步？
**A:** 這是預期行為，localStorage 在同域名下共享，但需要刷新頁面才會載入新值。如需即時同步，可監聽 storage 事件（未來優化）。

### Q: 如何測試 fallback 模式？
**A:** 暫時註解掉 configIntegration.js 的載入：
```html
<!-- <script src="scripts/configIntegration.js"></script> -->
```

---

## 🔬 除錯技巧

### 檢查當前配置狀態
```javascript
// 檢查所有 dictMaker 配置
const configs = {};
['formatOpt', 'rootOrderOpt', 'separatorOpt', 'countOpt', 'rangeInput'].forEach(key => {
  configs[key] = {
    prefs: prefs.get(key),
    unified: unifiedConfig?.get(`dictMaker.${key}`),
    legacy: localStorage.getItem(`dict_maker.${key}`)
  };
});
console.table(configs);
```

### 追蹤配置變更
```javascript
// 監聽 unifiedConfig 變更 (如果使用 modules/config.js)
if (typeof Modules !== 'undefined' && Modules.config) {
  Modules.config.watch('dictMaker.formatOpt', (newVal, oldVal) => {
    console.log(`formatOpt 變更: ${oldVal} → ${newVal}`);
  });
}
```

### 強制重新初始化
```javascript
// 清空快取並重新初始化
prefs._migrated = false;
PrefsManager.init();
console.log('✅ 已重新初始化');
```

---

## 📚 相關資源

- **實作總結:** `CONFIG_UNIFICATION_SUMMARY.md`
- **詳細實作:** `CONFIG_UNIFICATION_IMPLEMENTATION.md`
- **驗證清單:** `CONFIG_UNIFICATION_VERIFICATION.md`
- **快速參考:** `CONFIG_UNIFICATION_QUICK_REF.md`
- **原始需求:** `docs/todo/dictMaker_config_unification_todo.md`

---

## 💬 回饋與改進

如果在維護過程中發現問題或有改進建議，請：
1. 記錄在 CHANGELOG 中
2. 更新相關文檔
3. 考慮是否需要新增測試案例

---

**最後更新:** 2024年
**維護者:** 請在修改後更新此文檔
