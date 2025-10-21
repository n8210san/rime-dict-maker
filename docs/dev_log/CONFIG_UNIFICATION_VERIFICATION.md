# 配置統一方案驗證清單

## 快速驗證步驟

### 前置準備
1. 開啟本地伺服器: `npx http-server`
2. 開啟瀏覽器開發者工具 (F12)

---

## 驗證 A: 自動化測試頁面

### 步驟
1. 開啟 `http://localhost:8080/tmp_rovodev_test_config_unification.html`
2. 查看「環境檢測」區塊，確認所有項目都是 ✅
3. 依序執行以下測試：

#### 測試 1: 清空環境
- 點擊「執行清空」
- 應顯示綠色 ✅ 並列出已移除的鍵

#### 測試 2: Fallback 模式
- 點擊「測試 Fallback」
- 應顯示綠色 ✅
- 確認 Legacy 儲存為 ✅

#### 測試 3: unifiedConfig 委派
- 點擊「測試委派」
- 應顯示綠色 ✅
- 確認所有值都正確寫入 unifiedConfig
- 確認 Legacy 位置無殘留 (✅ 無殘留)

#### 測試 4: 資料遷移
- 點擊「測試遷移」
- 應顯示綠色 ✅
- 確認從 legacy 成功遷移到 unified
- 確認遷移標記為 ✅

#### 測試 5: PrefsManager 整合
- 點擊「測試 PrefsManager」
- 應顯示綠色 ✅
- 確認 Checkbox、Select、Input 都是 ✅

#### 儲存狀態檢視
- 點擊「檢視 localStorage」
- 查看當前 localStorage 的狀態
- 確認資料都在 `rovodev_unified_dictMaker.*` 位置

### 預期結果
✅ 所有 5 個測試都顯示綠色 ✅ = 驗證通過

---

## 驗證 B: dictMaker.html 實際使用

### 步驟 1: 清空環境測試
1. 開啟瀏覽器開發者工具 Console
2. 執行清空腳本：
```javascript
// 清空所有相關設定
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (key.startsWith('dict_maker.') || key.startsWith('rovodev_unified_dictMaker.')) {
    localStorage.removeItem(key);
  }
}
console.log('✅ 清空完成');
```

3. 重新整理頁面

### 步驟 2: 驗證預設值
1. 開啟 `http://localhost:8080/dictMaker.html`
2. 檢查 UI 元素的預設值：
   - formatOpt: 應為 "Rime"
   - rootOrderOpt: 應為 "after"
   - separatorOpt: 應為 " " (空格)
   - countOpt: 應為未勾選
   - rangeInput: 應為 ">2999"
   - 字數選項: 2-5字 應為勾選

### 步驟 3: 驗證寫入與讀取
1. 修改設定：
   - 格式: 改為 "Pime"
   - 字根: 改為 "before"
   - 分隔符: 改為 "tab"
   - 計數: 勾選
   - 範圍: 改為 ">1000"

2. 開啟 Console，檢查儲存位置：
```javascript
// 檢查是否寫入 unifiedConfig
console.log('formatOpt:', unifiedConfig.get('dictMaker.formatOpt'));
console.log('rootOrderOpt:', unifiedConfig.get('dictMaker.rootOrderOpt'));
console.log('separatorOpt:', unifiedConfig.get('dictMaker.separatorOpt'));
console.log('countOpt:', unifiedConfig.get('dictMaker.countOpt'));
console.log('rangeInput:', unifiedConfig.get('dictMaker.rangeInput'));
```

3. 預期輸出：
```
formatOpt: "Pime"
rootOrderOpt: "before"
separatorOpt: "\t"
countOpt: true
rangeInput: ">1000"
```

### 步驟 4: 驗證持久化
1. 重新整理頁面 (F5)
2. 確認所有設定都保留了：
   - 格式: "Pime"
   - 字根: "before"
   - 分隔符: "tab"
   - 計數: 勾選
   - 範圍: ">1000"

### 步驟 5: 驗證沒有 legacy 殘留
開啟 Console，執行：
```javascript
// 檢查 legacy 位置是否有殘留
const legacyKeys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.startsWith('dict_maker.')) {
    legacyKeys.push(key);
  }
}
console.log('Legacy 殘留:', legacyKeys.length === 0 ? '✅ 無殘留' : '❌ 有殘留');
console.log('Legacy 鍵:', legacyKeys);
```

預期輸出：
```
Legacy 殘留: ✅ 無殘留
Legacy 鍵: []
```

---

## 驗證 C: 資料遷移測試

### 步驟 1: 準備 legacy 資料
開啟 Console，執行：
```javascript
// 清空環境
localStorage.clear();

// 寫入 legacy 資料
localStorage.setItem('dict_maker.formatOpt', JSON.stringify('Rime'));
localStorage.setItem('dict_maker.rootOrderOpt', JSON.stringify('after'));
localStorage.setItem('dict_maker.countOpt', JSON.stringify(true));
localStorage.setItem('dict_maker.separatorOpt', JSON.stringify('\t'));
localStorage.setItem('dict_maker.rangeInput', JSON.stringify('>2999'));

console.log('✅ Legacy 資料已準備');
```

### 步驟 2: 觸發遷移
1. 重新整理頁面 (F5)
2. 頁面載入完成後，開啟 Console
3. 應該看到訊息：`✅ prefs 已完成向 unifiedConfig 遷移`

### 步驟 3: 驗證遷移結果
開啟 Console，執行：
```javascript
// 檢查是否已遷移到 unified
console.log('=== Unified 位置 ===');
console.log('formatOpt:', unifiedConfig.get('dictMaker.formatOpt'));
console.log('rootOrderOpt:', unifiedConfig.get('dictMaker.rootOrderOpt'));
console.log('countOpt:', unifiedConfig.get('dictMaker.countOpt'));
console.log('separatorOpt:', unifiedConfig.get('dictMaker.separatorOpt'));
console.log('rangeInput:', unifiedConfig.get('dictMaker.rangeInput'));

// 檢查 UI 是否正確恢復
console.log('=== UI 狀態 ===');
console.log('formatOpt UI:', $('#formatOpt').val());
console.log('rootOrderOpt UI:', $('#rootOrderOpt').val());
console.log('countOpt UI:', $('#countOpt').is(':checked'));
console.log('separatorOpt UI:', $('#separatorOpt').val());
console.log('rangeInput UI:', $('#rangeInput').val());
```

預期輸出：所有值都正確遷移且 UI 正確顯示

### 步驟 4: 驗證不覆蓋現有值
1. 清空環境
2. 先在 unified 寫入一個值：
```javascript
localStorage.clear();
unifiedConfig.set('dictMaker.formatOpt', 'Pime');  // unified 已有值
localStorage.setItem('dict_maker.formatOpt', JSON.stringify('Rime'));  // legacy 有不同值
```

3. 重新整理頁面
4. 檢查值：
```javascript
console.log('formatOpt:', unifiedConfig.get('dictMaker.formatOpt'));
// 應該輸出: "Pime" (保留 unified 的值，不被 legacy 覆蓋)
```

---

## 驗證 D: Fallback 模式測試

### 步驟 1: 禁用 unifiedConfig
開啟 `dictMaker.html`，暫時註解掉 configIntegration.js：
```html
<!-- <script src="scripts/configIntegration.js"></script> -->
```

### 步驟 2: 測試 fallback
1. 重新整理頁面
2. 開啟 Console，檢查：
```javascript
console.log('unifiedConfig 存在?', typeof unifiedConfig !== 'undefined');
// 應輸出: false

console.log('prefs 存在?', typeof prefs !== 'undefined');
// 應輸出: true
```

3. 測試讀寫：
```javascript
prefs.set('testKey', 'fallback_value');
console.log('讀取:', prefs.get('testKey'));
// 應輸出: "fallback_value"

console.log('Legacy 位置:', localStorage.getItem('dict_maker.testKey'));
// 應輸出: "\"fallback_value\""
```

### 步驟 3: 恢復 unifiedConfig
取消註解 configIntegration.js，重新整理頁面確認正常運作。

---

## 驗證 E: formatOpt 聯動測試

### 步驟
1. 開啟 `dictMaker.html`
2. 切換格式選項：
   - 選擇 "Rime"
   - 觀察 rootOrderOpt、countOpt、separatorOpt 是否正確聯動
3. 開啟 Console，確認聯動後的值已持久化：
```javascript
console.log('formatOpt:', prefs.get('formatOpt'));
console.log('rootOrderOpt:', prefs.get('rootOrderOpt'));
console.log('countOpt:', prefs.get('countOpt'));
console.log('separatorOpt:', prefs.get('separatorOpt'));
```

4. 重新整理頁面，確認聯動後的設定都保留了

---

## 檢查清單總結

### 必須通過的測試
- [ ] 驗證 A: 所有 5 個自動化測試都是 ✅
- [ ] 驗證 B-步驟2: 預設值正確
- [ ] 驗證 B-步驟3: 寫入到 unifiedConfig
- [ ] 驗證 B-步驟4: 持久化正常
- [ ] 驗證 B-步驟5: 無 legacy 殘留
- [ ] 驗證 C-步驟3: 遷移成功
- [ ] 驗證 C-步驟4: 不覆蓋現有值
- [ ] 驗證 D: Fallback 模式正常運作
- [ ] 驗證 E: formatOpt 聯動與持久化正常

### 預期 Console 訊息
載入 dictMaker.html 時應看到：
```
UnifiedConfigManager 初始化完成
✅ prefs.js 模組已載入
✅ prefs 已完成向 unifiedConfig 遷移  (首次有 legacy 資料時)
統一配置管理器已就緒
```

### 成功標準
✅ **所有測試都通過 = 實作成功**

---

## 問題排查

### 問題: 看不到 unifiedConfig
**原因:** configIntegration.js 未載入或載入失敗
**解決:** 檢查 HTML 中的 script 標籤順序和路徑

### 問題: 寫入還在 legacy 位置
**原因:** prefs._hasUnifiedConfig() 返回 false
**解決:** 
1. 確認 configIntegration.js 在 prefs.js 之前載入
2. 檢查 Console 是否有錯誤訊息
3. 執行 `console.log(prefs._hasUnifiedConfig())` 確認偵測結果

### 問題: 遷移沒有執行
**原因:** _migrated 標記已設定或沒有觸發 get/set
**解決:**
1. 重置標記: `prefs._migrated = false`
2. 觸發任一 get 操作: `prefs.get('formatOpt')`
3. 檢查 Console 是否有遷移完成訊息

### 問題: UI 元素沒有恢復設定
**原因:** PrefsManager.init() 未執行或執行時機不對
**解決:**
1. 確認 dictMaker.js 中有呼叫 `PrefsManager.init()`
2. 確認呼叫時 DOM 已經載入完成
3. 檢查 Console 是否有錯誤訊息

---

## 效能基準測試 (可選)

### 測試遷移效能
```javascript
console.time('遷移時間');
prefs._migrated = false;
prefs._migrateToUnified();
console.timeEnd('遷移時間');
// 預期: < 5ms
```

### 測試讀寫效能
```javascript
console.time('寫入時間');
for (let i = 0; i < 1000; i++) {
  prefs.set('testKey', `value_${i}`);
}
console.timeEnd('寫入時間');
// 預期: < 50ms

console.time('讀取時間');
for (let i = 0; i < 1000; i++) {
  prefs.get('testKey');
}
console.timeEnd('讀取時間');
// 預期: < 10ms
```

---

## 完成確認

驗證完成後，請在此打勾：

- [ ] 所有自動化測試通過
- [ ] dictMaker.html 實際使用正常
- [ ] 資料遷移正確執行
- [ ] Fallback 模式正常
- [ ] formatOpt 聯動正常
- [ ] 無 Console 錯誤
- [ ] 效能符合預期

✅ **全部打勾 = 可以上線使用**
